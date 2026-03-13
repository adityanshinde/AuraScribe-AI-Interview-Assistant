import { useState, useCallback, useRef } from 'react';

export function useTabAudioCapture(onTranscriptUpdate: (text: string) => void, onError?: (msg: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [transcript, setTranscript] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const autoClearTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const isElectron = /electron/i.test(navigator.userAgent);
      let stream: MediaStream;

      if (isElectron) {
        // In Electron, getDisplayMedia often throws 'Not supported'.
        // Use the native getUserMedia + desktopCapturer approach.
        const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;
        if (!ipcRenderer) throw new Error("Electron IPC not available.");

        const sourceId = await ipcRenderer.invoke('get-source-id');
        if (!sourceId) throw new Error("Failed to detect primary monitor.");

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
            }
          } as any,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId
            }
          } as any
        });
        
        // IMPORTANT: Do NOT stop video tracks!
        // In Electron desktop capture, audio loopback is tied to the video capture session.
      } else {
        // In the regular Web App, we default to browser DOM constraints
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'browser' } as any,
          audio: true,
        });
      }

      // Show debug info as toast so user can report it
      const aTracks = stream.getAudioTracks();
      const debugInfo = `Audio: ${aTracks.length} tracks. ${aTracks.map(t => `[${t.label}] live=${t.readyState === 'live'} muted=${t.muted}`).join(', ')}`;
      if (onError) onError(debugInfo); 

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        const isElectron = /electron/i.test(navigator.userAgent);
        if (onError) onError(isElectron
          ? 'System Audio Loopback failed. Ensure audio is playing and try again.'
          : 'No audio track detected! Check "Also share tab audio" in the browser popup.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Create audio-only stream for MediaRecorder
      const audioStream = new MediaStream([audioTracks[0]]);

      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsListening(true);
      clearTranscript();

      const recordNextChunk = () => {
        if (!isRecordingRef.current || !streamRef.current) return;

        // Find a supported mimeType
        let options: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }

        const recorder = new MediaRecorder(audioStream, options);

        recorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && isRecordingRef.current) {
            // DEBUG Toast
            if (onError) onError(`🎤 Chunk: ${Math.round(e.data.size/1024)}KB | mime: ${recorder.mimeType}`);

            const reader = new FileReader();
            reader.readAsDataURL(e.data);
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              const mimeType = recorder.mimeType || 'audio/webm';

              try {
                const apiKey = localStorage.getItem('groq_api_key') || '';
                const voiceModel = localStorage.getItem('groq_voice_model') || 'whisper-large-v3-turbo';

                const response = await fetch('/api/transcribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'x-voice-model': voiceModel
                  },
                  body: JSON.stringify({ audioBase64: base64data, mimeType })
                });

                if (response.status === 429) {
                  setIsRateLimited(true);
                  const data = await response.json();
                  console.warn('Rate limited:', data.error);
                  setTimeout(() => setIsRateLimited(false), (data.retryAfter || 3) * 1000);
                  return;
                }

                if (!response.ok) {
                  const errData = await response.json();
                  throw new Error(errData.error || errData.details || `Server HTTP Error: ${response.status}`);
                }

                setIsRateLimited(false);
                const data = await response.json();
                const text = data.text?.trim();

                // DEBUG Toast
                if (onError) onError(`📝 API returned: "${text || '(empty)'}"`);

                if (text && text.length > 2) {
                  setTranscript(prev => {
                    const newTranscript = prev + (prev ? ' ' : '') + text;
                    return newTranscript.length > 2000 ? newTranscript.slice(-2000) : newTranscript;
                  });
                  onTranscriptUpdate(text);

                  if (autoClearTimerRef.current) {
                    clearTimeout(autoClearTimerRef.current);
                  }
                  autoClearTimerRef.current = setTimeout(() => {
                    setTranscript('');
                  }, 15000);
                }
              } catch (error: any) {
                console.error('STT Error:', error);
                if (onError) onError(error.message || 'Speech-to-text failed. Check API keys.');
              }
            };
          } else {
            // DEBUG Toast
            if (onError) onError(`⚠️ Empty chunk: size=${e.data.size}`);
          }
        };

        recorder.start();

        // Record 5-second chunks
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            if (isRecordingRef.current) {
              recordNextChunk();
            }
          }
        }, 5000);
      };

      recordNextChunk();

      // Handle user stopping sharing via browser UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopListening();
        };
      }

    } catch (err: any) {
      console.error('Error capturing tab audio:', err);
      if (onError) onError(`Audio capture failed: ${err.message || err.name || 'Unknown error'}`);
      setIsListening(false);
    }
  }, [onTranscriptUpdate]);

  const stopListening = useCallback(() => {
    isRecordingRef.current = false;
    setIsListening(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  return { isListening, isRateLimited, transcript, startListening, stopListening, clearTranscript, stream: streamRef.current };
}
