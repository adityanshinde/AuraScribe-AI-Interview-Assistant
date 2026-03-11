import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  app.use(express.json({ limit: '50mb' }));

  function getGroq(customKey?: string) {
    const key = customKey || process.env.GROQ_API_KEY;
    if (!key) throw new Error("API key is required. Please provide it in settings or set GROQ_API_KEY environment variable.");
    return new Groq({ apiKey: key });
  }

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post("/api/transcribe", async (req, res) => {
    let tmpFilePath = '';
    try {
      const customKey = req.headers['x-api-key'] as string;
      const customVoiceModel = req.headers['x-voice-model'] as string;
      const groq = getGroq(customKey);
      
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: "No audio provided" });
      }

      const ext = mimeType?.includes('mp4') ? 'mp4' : 'webm';
      tmpFilePath = path.join(os.tmpdir(), `audio-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`);
      fs.writeFileSync(tmpFilePath, Buffer.from(audioBase64, 'base64'));

      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tmpFilePath),
        model: customVoiceModel || "whisper-large-v3-turbo",
        response_format: "json",
      });

      let text = transcription.text || "";
      
      // Filter out common Whisper hallucinations on silence or background noise
      const hallucinations = [
        "thank you",
        "thanks for watching",
        "thank you for watching",
        "please subscribe",
        "subscribed",
        "www.openai.com",
        "you",
        "bye",
        "goodbye",
        "oh",
        "uh",
        "um",
        "i'm sorry",
        "i don't know",
        "the end",
        "watching",
        "be sure to like and subscribe",
        "thanks for listening",
        "thank you so much",
        "subtitle by",
        "subtitles by",
        "amara.org",
        "english subtitles",
        "re-edited by",
        "translated by",
        "you guys",
        "peace",
        "see you in the next one",
        "god bless",
        "thank you for your time",
        "i'll see you next time",
        "don't forget to like",
        "hit the bell icon",
        "thanks for the support",
        "i'll see you in the next video",
        "thanks for joining",
        "have a great day",
        "see you soon",
        "take care",
        "stay tuned",
        "welcome back",
        "let's get started",
        "in this video",
        "today we are going to",
        "if you enjoyed this",
        "leave a comment",
        "share this video"
      ];

      const cleanText = text.trim().toLowerCase().replace(/[.,!?;:]/g, "");
      
      // Technical term corrections (Whisper often mishears these)
      const corrections: Record<string, string> = {
        "virtual dome": "virtual DOM",
        "react.js": "React",
        "view.js": "Vue.js",
        "node.js": "Node.js",
        "next.js": "Next.js",
        "typescript": "TypeScript",
        "javascript": "JavaScript",
        "tailwind": "Tailwind CSS",
        "postgress": "PostgreSQL",
        "mongo db": "MongoDB",
        "graphql": "GraphQL",
        "rest api": "REST API",
        "dockerize": "Dockerize",
        "kubernetes": "Kubernetes",
        "aws": "AWS",
        "azure": "Azure",
        "gcp": "GCP",
        "eaml": "YAML",
        "travel inheritance": "types of inheritance",
        "travel inheritances": "types of inheritance",
      };

      let correctedText = text;
      Object.entries(corrections).forEach(([wrong, right]) => {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        correctedText = correctedText.replace(regex, right);
      });
      text = correctedText;

      // If the text is just one of the hallucinations and very short, discard it
      // But don't discard if it's part of a longer sentence
      const isHallucination = hallucinations.some(h => cleanText === h && text.length < 20);
      
      if (isHallucination || text.length < 2) {
        text = "";
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Transcription error:", error);
      const status = error.status || 500;
      const message = error.message || "Transcription failed";
      
      if (status === 429) {
        return res.status(429).json({ 
          error: "Rate limit reached. Please wait a moment.",
          retryAfter: error.headers?.['retry-after'] || 3
        });
      }
      
      res.status(status).json({ error: message });
    } finally {
      if (tmpFilePath && fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const customKey = req.headers['x-api-key'] as string;
      const customModel = req.headers['x-model'] as string;
      const persona = req.headers['x-persona'] as string || 'Technical Interviewer';
      const groq = getGroq(customKey);
      
      const { transcript, resume, jd } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "No transcript provided" });
      }

      let systemPrompt = `You are an expert AI assistant acting as a ${persona}.
Analyze the transcript for questions. If a question is found, provide a high-quality answer optimized for an interview setting.

CONTEXT:
- User Resume: ${resume || 'Not provided'}
- Job Description: ${jd || 'Not provided'}

INSTRUCTIONS:
1. Detect if the transcript contains a question.
2. If yes, provide a "Short but Detailed" answer.
3. FORMATTING:
   - Use 3-4 "Glanceable" bullet points.
   - Each bullet should be a "Talking Point" (max 10-12 words).
   - For behavioral questions, use the STAR method (Situation, Task, Action, Result) in the bullets.
   - For technical questions, include specific keywords, Big O, or snippets.
4. Use the Resume and JD context to personalize the answer.
5. "spoken" field should be a punchy 1-2 sentence "Elevator Pitch" response.

Output JSON structure:
{
  "isQuestion": boolean,
  "question": "the detected question",
  "confidence": 0.0-1.0,
  "type": "behavioral/technical",
  "bullets": ["Bullet 1: Action-oriented", "Bullet 2: Technical detail", "Bullet 3: Result/Impact"],
  "spoken": "punchy 1-2 sentence response"
}
Only output valid JSON.`;

      if (resume) {
        systemPrompt += `\n\nUSER RESUME CONTEXT:\n${resume}`;
      }
      if (jd) {
        systemPrompt += `\n\nJOB DESCRIPTION CONTEXT:\n${jd}`;
      }

      if (persona === 'Technical Interviewer') {
        systemPrompt += `\n\nFocus on glanceable technical talking points, Big O complexity, and edge cases. Keep bullets extremely punchy so the user can expand on them naturally.`;
      } else if (persona === 'Executive Assistant') {
        systemPrompt += `\n\nFocus on summarizing action items, key decisions, and high-level strategy.`;
      } else if (persona === 'Language Translator') {
        systemPrompt += `\n\nFocus on translating the dialogue accurately while maintaining tone.`;
      }

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Transcript: "${transcript}"`
          }
        ],
        model: customModel || "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || "{}";
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: error.message || "Analysis failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
