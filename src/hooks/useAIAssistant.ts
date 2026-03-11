import { useState, useRef, useCallback } from 'react';

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

  const processTranscript = useCallback(async (newText: string) => {
    // Append to buffer
    transcriptBufferRef.current += ' ' + newText;
    
    // Keep buffer to last 1500 characters to avoid huge context
    if (transcriptBufferRef.current.length > 1500) {
      transcriptBufferRef.current = transcriptBufferRef.current.slice(-1500);
    }

    const now = Date.now();
    if (now - lastQuestionTimeRef.current > 10000) { // 10 seconds debounce to avoid rate limits
      lastQuestionTimeRef.current = now; // Update immediately to prevent concurrent calls
      try {
        setIsProcessing(true);
        
        const apiKey = localStorage.getItem('groq_api_key') || '';
        const model = localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile';

        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'x-model': model
          },
          body: JSON.stringify({ transcript: transcriptBufferRef.current })
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
          }
        }
        setIsProcessing(false);
      } catch (error) {
        console.error('AI Processing Error:', error);
        setIsProcessing(false);
      }
    }
  }, []);

  return { detectedQuestion, answer, isProcessing, processTranscript };
}
