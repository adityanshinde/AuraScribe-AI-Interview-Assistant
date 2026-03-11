import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

export interface Answer {
  bullets: string[];
  spoken: string;
}

export interface QuestionDetection {
  isQuestion: boolean;
  question: string;
  confidence: number;
  type: string;
}

export function useAIAssistant() {
  const [detectedQuestion, setDetectedQuestion] = useState<QuestionDetection | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const transcriptBufferRef = useRef<string>('');
  const lastQuestionTimeRef = useRef<number>(0);
  const lastProcessedTextRef = useRef<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      if (audioRef.current) {
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
    }
  }, []);

  const processTranscript = useCallback(async (newText: string) => {
    // Append to buffer
    transcriptBufferRef.current += ' ' + newText;
    
    // Keep buffer to last 1000 characters to avoid huge context and reduce latency
    if (transcriptBufferRef.current.length > 1000) {
      transcriptBufferRef.current = transcriptBufferRef.current.slice(-1000);
    }

    // Only process if not already processing, text has changed significantly, and we have enough text
    const currentText = transcriptBufferRef.current.trim();
    if (!isProcessing && currentText.length > 10 && currentText !== lastProcessedTextRef.current) {
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
          throw new Error(`HTTP error! status: ${response.status}`);
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

          // Clear buffer after a successful detection to prevent re-detecting the same question
          // We keep a tiny bit of context just in case
          transcriptBufferRef.current = transcriptBufferRef.current.slice(-20);
        }
        setIsProcessing(false);
      } catch (error) {
        console.error('AI Processing Error:', error);
        setIsProcessing(false);
      }
    }
  }, [isProcessing, playSpeech]);

  const resetAssistant = useCallback(() => {
    setDetectedQuestion(null);
    setAnswer(null);
    transcriptBufferRef.current = '';
    lastProcessedTextRef.current = '';
  }, []);

  return { detectedQuestion, answer, isProcessing, processTranscript, resetAssistant };
}
