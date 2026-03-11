import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    if (now - lastQuestionTimeRef.current > 15000) { // 15 seconds debounce to avoid rate limits
      try {
        // 1. Detect Question
        const detectResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analyze the following transcript and determine if the speaker is asking a question that requires an answer (e.g., an interview question, a technical question, or a request for explanation).
          
Transcript: "${newText}"`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isQuestion: { type: Type.BOOLEAN },
                question: { type: Type.STRING, description: 'The extracted question' },
                confidence: { type: Type.NUMBER, description: 'Confidence score between 0 and 1' },
                type: { type: Type.STRING, description: 'e.g., behavioral, technical, HR' }
              },
              required: ['isQuestion', 'question', 'confidence', 'type']
            }
          }
        });

        const detection = JSON.parse(detectResponse.text || '{}');

        if (detection.isQuestion && detection.confidence > 0.6) {
          lastQuestionTimeRef.current = now;
          
          setDetectedQuestion(detection);
          setIsProcessing(true);

          // 2. Generate Answer
          const answerResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `You are an expert AI interview assistant. The user is being asked a question.
Provide a concise, excellent answer.

Context of conversation:
${transcriptBufferRef.current}

Question:
${detection.question}

Provide your response in JSON format with two fields:
1. "bullets": An array of 3-5 short bullet points (hints).
2. "spoken": A short 2-3 sentence verbal answer the user could say.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                  spoken: { type: Type.STRING }
                },
                required: ['bullets', 'spoken']
              }
            }
          });

          const answerData = JSON.parse(answerResponse.text || '{}');
          setAnswer(answerData);
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('AI Processing Error:', error);
        setIsProcessing(false);
      }
    }
  }, []);

  return { detectedQuestion, answer, isProcessing, processTranscript };
}
