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
        "translated by"
      ];

      const cleanText = text.trim().toLowerCase().replace(/[.,!?;:]/g, "");
      
      // If the text is just one of the hallucinations and very short, discard it
      // But don't discard if it's part of a longer sentence
      const isHallucination = hallucinations.some(h => cleanText === h && text.length < 20);
      
      if (isHallucination || text.length < 2) {
        text = "";
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: error.message || "Transcription failed" });
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
Analyze the transcript for questions. If a question is found, provide a high-quality answer.
Output JSON structure:
{
  "isQuestion": boolean,
  "question": "the detected question",
  "confidence": 0.0-1.0,
  "type": "behavioral/technical",
  "bullets": ["key point 1", "key point 2"],
  "spoken": "concise 2-3 sentence verbal response"
}
Only output valid JSON.`;

      if (resume) {
        systemPrompt += `\n\nUSER RESUME CONTEXT:\n${resume}`;
      }
      if (jd) {
        systemPrompt += `\n\nJOB DESCRIPTION CONTEXT:\n${jd}`;
      }

      if (persona === 'Technical Interviewer') {
        systemPrompt += `\n\nFocus on code snippets, Big O complexity, and edge cases. If a resume is provided, tailor the answer to the user's specific experience.`;
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
