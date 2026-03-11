import { useState, useCallback, useRef } from 'react';

export function useTabAudioCapture(onTranscriptUpdate: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [transcript, setTranscript] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        alert('No audio track found. Please make sure to check "Also share tab audio" when selecting the tab.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const audioStream = new MediaStream([audioTracks[0]]);

      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsListening(true);
      setTranscript(''); // Clear previous transcript

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
                  // Auto-reset rate limit after a few seconds
                  setTimeout(() => setIsRateLimited(false), (data.retryAfter || 3) * 1000);
                  return;
                }

                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }

                setIsRateLimited(false);
                const data = await response.json();
                const text = data.text?.trim();
                
                if (text && text.length > 2) {
                  setTranscript(prev => {
                    const newTranscript = prev + (prev ? ' ' : '') + text;
                    // Keep only last 2000 characters for UI performance
                    return newTranscript.length > 2000 ? newTranscript.slice(-2000) : newTranscript;
                  });
                  onTranscriptUpdate(text);
                }
              } catch (error) {
                console.error('STT Error:', error);
              }
            };
          }
        };

        recorder.start();

        // Stop and start a new chunk every 5 seconds to avoid rate limits while reducing lag
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
      stream.getVideoTracks()[0].onended = () => {
        stopListening();
      };

    } catch (err: any) {
      console.error('Error capturing tab audio:', err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        alert('Permission denied. Please allow screen sharing and check "Also share tab audio" to capture audio.');
      }
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

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return { isListening, isRateLimited, transcript, startListening, stopListening, clearTranscript, stream: streamRef.current };
}
