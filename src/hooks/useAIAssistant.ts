import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

export interface Answer {
  bullets: string[];
  spoken: string;
  explanation?: string;
  code?: string;
  codeLanguage?: string;
}

export interface QuestionDetection {
  isQuestion: boolean;
  question: string;
  confidence: number;
  type: string;
}

export function useAIAssistant(onQuestionDetected?: () => void, onError?: (msg: string) => void) {
  const [detectedQuestion, setDetectedQuestion] = useState<QuestionDetection | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const transcriptBufferRef = useRef<string>('');
  const lastQuestionTimeRef = useRef<number>(0);
  const lastProcessedTextRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();

    const handleStart = () => setIsSpeaking(true);
    const handleEnd = () => setIsSpeaking(false);

    if (audioRef.current) {
      audioRef.current.addEventListener('play', handleStart);
      audioRef.current.addEventListener('ended', handleEnd);
      audioRef.current.addEventListener('pause', handleEnd);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handleStart);
        audioRef.current.removeEventListener('ended', handleEnd);
        audioRef.current.removeEventListener('pause', handleEnd);
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playSpeech = useCallback(async (text: string) => {
    const enableTTS = localStorage.getItem('aura_enable_tts') === 'true';
    const outputDeviceId = localStorage.getItem('aura_output_device') || '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!enableTTS || !apiKey || !text || !audioRef.current) return;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBlob = await fetch(`data:audio/wav;base64,${base64Audio}`).then(res => res.blob());
        const audioUrl = URL.createObjectURL(audioBlob);

        if (audioRef.current) {
          // Set output device if supported
          if (outputDeviceId && (audioRef.current as any).setSinkId) {
            try {
              await (audioRef.current as any).setSinkId(outputDeviceId);
            } catch (err) {
              console.error('Error setting sink ID:', err);
            }
          }

          audioRef.current.src = audioUrl;
          await audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      setIsSpeaking(false);
    }
  }, []);

  const processTranscript = useCallback(async (newText: string) => {
    // If AI is speaking, ignore the transcript to avoid feedback loops
    if (isSpeaking) return;

    // Append to buffer
    transcriptBufferRef.current += ' ' + newText;

    // Keep buffer to last 1000 characters to avoid huge context and reduce latency
    if (transcriptBufferRef.current.length > 1000) {
      transcriptBufferRef.current = transcriptBufferRef.current.slice(-1000);
    }

    const currentText = transcriptBufferRef.current.trim();
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
    }

    // Smart Debouncing: Wait 800ms of "silence" before we consider sending the text
    debounceTimerRef.current = setTimeout(async () => {
      // Only process if not already processing, text has changed significantly, and we have enough text
      if (!isProcessing && currentText.length > 15 && currentText !== lastProcessedTextRef.current) {
        
        // ── Heuristics Pre-filter ──
        // Check if it looks remotely like a question to avoid wasting LLM/API calls
        const lowerText = currentText.toLowerCase();
        
        // Look for question marks OR common question framing words
        const hasQuestionMark = currentText.includes('?');
        const hasQuestionWord = /\b(what|how|why|when|where|who|can you|could you|explain|describe|tell me|is it|does it|are there|would you|should we)\b/.test(lowerText);
        
        if (!hasQuestionMark && !hasQuestionWord) {
            // Not a question, skip processing entirely.
            console.log("[Client] Heuristic filter skipped non-question:", currentText.slice(-50));
            return;
        }
      try {
        setIsProcessing(true);
        lastProcessedTextRef.current = currentText;

        const apiKey = localStorage.getItem('groq_api_key') || '';
        const model = localStorage.getItem('groq_model') || 'llama-3.1-8b-instant';
        const persona = localStorage.getItem('groq_persona') || 'Technical Interviewer';
        const resume = localStorage.getItem('groq_resume') || '';
        const jd = localStorage.getItem('groq_jd') || '';

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'x-model': model,
            'x-persona': persona
          },
          body: JSON.stringify({
            transcript: transcriptBufferRef.current,
            resume,
            jd
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || errData.details || `Server HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.isQuestion && data.confidence > 0.6 && data.question) {
          setDetectedQuestion({
            isQuestion: data.isQuestion,
            question: data.question,
            confidence: data.confidence,
            type: data.type || 'general'
          });

          if (data.bullets && data.spoken) {
            setAnswer({
              bullets: data.bullets,
              spoken: data.spoken
            });

            // Play speech if enabled
            playSpeech(data.spoken);
          }

          // Call the callback to clear the UI transcript
          if (onQuestionDetected) {
            onQuestionDetected();
          }

          // Clear buffer after a successful detection to prevent re-detecting the same question
          // We keep a tiny bit of context just in case
          transcriptBufferRef.current = transcriptBufferRef.current.slice(-20);
        }
        setIsProcessing(false);
      } catch (error: any) {
        console.error('AI Processing Error:', error);
        setIsProcessing(false);
        if (onError) onError(error.message || 'AI Processing failed. Check API key format.');
      }
    }
    }, 800); // Wait 800ms between transcript updates before processing
  }, [isProcessing, isSpeaking, playSpeech, onQuestionDetected]);

  const askQuestion = useCallback(async (questionText: string) => {
    if (!questionText.trim() || isProcessing) return;
    try {
      setIsProcessing(true);

      const apiKey = localStorage.getItem('groq_api_key') || '';
      const model = localStorage.getItem('groq_model') || 'llama-3.1-8b-instant';
      const persona = localStorage.getItem('groq_persona') || 'Technical Interviewer';
      const resume = localStorage.getItem('groq_resume') || '';
      const jd = localStorage.getItem('groq_jd') || '';

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-model': model,
          'x-persona': persona,
          'x-mode': 'chat'
        },
        body: JSON.stringify({ transcript: questionText, resume, jd })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.details || `Server HTTP Error: ${response.status}`);
      }

      const data = await response.json();

      // For manual chat, we always treat it as a question regardless of detection
      const detectedQ = {
        isQuestion: true,
        question: questionText,
        confidence: 1.0,
        type: data.type || 'general'
      };
      setDetectedQuestion(detectedQ);

      // Always store the answer — server guarantees at least sections or explanation or bullets
      const ans: Answer = {
        bullets: Array.isArray(data.bullets) ? data.bullets : [],
        spoken: data.spoken || '',
        explanation: data.explanation || data.answer || data.response || '',
        code: data.code || '',
        codeLanguage: data.codeLanguage || data.language || '',
        sections: data.sections || [],
      } as any;
      setAnswer(ans);
      playSpeech(data.spoken || '');


      setIsProcessing(false);
    } catch (error: any) {
      console.error('Chat AI Error:', error);
      setIsProcessing(false);
      if (onError) onError(error.message || 'Chat prompt failed. Check API key format.');
    }
  }, [isProcessing, playSpeech]);

  const resetAssistant = useCallback(() => {
    setDetectedQuestion(null);
    setAnswer(null);
    transcriptBufferRef.current = '';
    lastProcessedTextRef.current = '';
  }, []);

  return { detectedQuestion, answer, isProcessing, processTranscript, askQuestion, resetAssistant };
}
