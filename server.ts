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
      const mode = req.headers['x-mode'] as string || 'voice';
      const groq = getGroq(customKey);

      const supportsLogprobs = (model: string) => {
        // Define models that are known to support logprobs or skip it completely
        const supported = ['llama3-8b-8192'];
        return supported.includes(model);
      };

      const { transcript, resume, jd } = req.body;
      if (!transcript) {
        return res.status(400).json({ error: "No transcript provided" });
      }

      // ════════════════════════════════════════════════════════════════
      // CHAT MODE — Adaptive Prompting + Self-Verification Pipeline
      // ════════════════════════════════════════════════════════════════
      if (mode === 'chat') {

        // ── STEP 1: Difficulty Classifier (cheap + fast) ──────────────
        let questionType = 'concept';
        let difficulty = 'medium';

        try {
          const classifyCompletion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `You are a classifier. Return ONLY valid JSON, nothing else.
Schema: {"type": "concept | coding | system_design | behavioral", "difficulty": "easy | medium | hard"}
Rules:
- concept: definitions, explanations, comparisons of technologies
- coding: algorithm, data structure, write code, implement
- system_design: architecture, distributed systems, scalability, design a system
- behavioral: experience, soft skills, tell me about a time
- easy: basic definitions, junior-level
- medium: trade-offs, algorithms, intermediate
- hard: system design, architecture, advanced algorithms`
              },
              { role: "user", content: `Classify: ${transcript}` }
            ],
            model: "llama-3.1-8b-instant",
            response_format: { type: "json_object" },
            temperature: 0.1,
          });
          let classifyData: any = {};
          try { classifyData = JSON.parse(classifyCompletion.choices[0]?.message?.content || "{}"); } catch { }
          questionType = classifyData.type || 'concept';
          difficulty = classifyData.difficulty || 'medium';
        } catch { /* use defaults */ }

        // ── STEP 2: Build Adaptive Prompt ─────────────────────────────
        // Section structure hint based on question type
        const sectionHint = questionType === 'coding'
          ? `Sections MUST be: "Problem Understanding", "Approach & Logic", "Complexity Analysis". Always fill the code field with complete working code.`
          : questionType === 'behavioral'
            ? `Sections MUST be: "Situation", "What I Did", "Result & Learnings". Write in confident first-person.`
            : questionType === 'system_design'
              ? `Sections: "Architecture Overview", "Core Components", "Trade-offs & Bottlenecks", "Scaling Strategy". Focus on distributed systems thinking.`
              : `If comparing TWO things: "X Overview", "Y Overview", "Key Differences", "When To Use Which". If one concept: "What It Is", "How It Works", "Trade-offs", "When To Use".`;

        // Difficulty-aware depth instructions
        const depthHint = difficulty === 'easy'
          ? `DEPTH: Focus on clarity and intuition. Avoid unnecessary complexity. Prioritize simple, memorable explanations a junior can follow.`
          : difficulty === 'hard'
            ? `DEPTH: Break down reasoning deeply. Discuss scalability, reliability, and bottlenecks. Mention trade-offs between approaches. Cite Big-O where relevant.`
            : `DEPTH: Include practical engineering trade-offs. Mention complexity where relevant. Balance theory with real-world usage.`;

        const chatSystemPrompt = `You are a senior software engineer, system design mentor, and interview coach.

Your task: answer the user's question in a clear, structured, interview-ready format.

STRICT OUTPUT RULE:
Return ONLY valid JSON. Do NOT include markdown, code fences, commentary, or any text outside the JSON object.

JSON SCHEMA (match exactly):
{
  "sections": [
    {
      "title": "Short section title (2-5 words)",
      "content": "2-4 sentences explaining this section clearly. Use confident first-person tone (I typically... / In my experience...). NO bullet points inside content.",
      "points": [
        "Short key takeaway (max 12 words)",
        "Short key takeaway (max 12 words)"
      ]
    }
  ],
  "code": "Complete working code if question asks for coding. Otherwise empty string. No markdown fences.",
  "codeLanguage": "language name (csharp, python, javascript, java, sql, etc.) or empty string"
}

SECTION RULES:
${sectionHint}
- Minimum 2 sections, maximum 5 sections.
- Each "content": 2-4 sentences, natural prose, NO nested bullets.
- Each "points": 2-4 items, max 12 words each, crisp and scannable.
- Titles: short, bold-worthy (e.g. "Lambda Syntax", "Time Complexity", "Key Trade-offs").

CODE RULES:
- Only include code if the question asks to write, implement, create, or demonstrate code.
- If code is included: complete and runnable, comments on key lines, handle edge cases (null, empty, etc.).
- No markdown fences inside the "code" field.

${depthHint}

CONTEXT:
Resume: ${resume || 'Not provided'}
Job Description: ${jd || 'Not provided'}
Persona: ${persona}

PERSONA ADJUSTMENTS:
${persona === 'Technical Interviewer' ? '- Emphasize architecture decisions, Big-O complexity, trade-offs, and production concerns.' : ''}
${persona === 'Executive Assistant' ? '- Emphasize business impact, strategic implications, and communication clarity.' : ''}
${persona === 'Language Translator' ? '- Emphasize language nuance, cultural context, and translation accuracy.' : ''}

FINAL RULE: Return ONLY the JSON object. No markdown. No explanations outside JSON.`;

        // ── STEP 3: Generate Answer ────────────────────────────────────
        const chatModel = "llama-3.3-70b-versatile";
        const chatParams: any = {
          messages: [
            { role: "system", content: chatSystemPrompt },
            { role: "user", content: `Question: ${transcript}` }
          ],
          model: chatModel,
          response_format: { type: "json_object" },
          temperature: 0.4, // Lower = more accurate, less hallucination
        };

        if (supportsLogprobs(chatModel)) {
          chatParams.logprobs = true;
        }

        const chatCompletion = await groq.chat.completions.create(chatParams);

        let chatData: any = { sections: [] };
        try {
          chatData = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");
        } catch {
          chatData = { sections: [] };
        }

        // Compute confidence (logprob or self-estimation fallback)
        let confidence = 1.0;
        const tokens = (chatCompletion.choices[0] as any)?.logprobs?.content;
        if (tokens && Array.isArray(tokens) && tokens.length > 0) {
          const avgLogProb = tokens.reduce((s: number, t: any) => s + (t.logprob || 0), 0) / tokens.length;
          confidence = Math.exp(avgLogProb);
          console.log(`[Chat] Answer generated with logprob confidence: ${confidence.toFixed(2)}`);
        } else {
          try {
            const confCompletion = await groq.chat.completions.create({
              model: "llama-3.1-8b-instant",
              messages: [
                { role: "system", content: "You are evaluating the quality and correctness of an AI's answer to an interview question. Rate your confidence that the answer correctly and fully addresses the question. Output ONLY a JSON object: {\"confidence\": number} where the number is a float between 0.0 (completely wrong/irrelevant) and 1.0 (perfectly accurate/highly relevant)." },
                { role: "user", content: `Question: ${transcript}\nAnswer: ${JSON.stringify(chatData)}` }
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
            });
            const confData = JSON.parse(confCompletion.choices[0]?.message?.content || "{}");
            if (typeof confData.confidence === 'number') {
              confidence = confData.confidence;
              console.log(`[Chat] Answer generated with LLM self-confidence: ${confidence.toFixed(2)}`);
            }
          } catch {
             console.log(`[Chat] Answer generated with default confidence: 1.0`);
          }
        }

        // ── STEP 4: Self-Verification for hard/system_design questions ─
        // Use logprobs trick: ONLY run verification if confidence is low (< 0.8)
        if ((difficulty === 'hard' || questionType === 'system_design') && confidence < 0.8) {
          try {
            const verifyCompletion = await groq.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: `You are a senior engineer reviewing an AI-generated interview answer for correctness.
Check for: factual errors, incorrect Big-O complexity, hallucinated APIs or syntax, missing important edge cases.
Return ONLY valid JSON: {"valid": boolean, "issues": ["issue description"], "improvedSections": <same sections array format, or null if valid>}`
                },
                {
                  role: "user",
                  content: `Original Question: ${transcript}\nGenerated Answer: ${JSON.stringify(chatData)}`
                }
              ],
              model: "llama-3.1-8b-instant", // Fast + cheap for verification
              response_format: { type: "json_object" },
              temperature: 0.2,
            });

            let verifyData: any = { valid: true };
            try { verifyData = JSON.parse(verifyCompletion.choices[0]?.message?.content || "{}"); } catch { }

            if (!verifyData.valid && Array.isArray(verifyData.improvedSections) && verifyData.improvedSections.length > 0) {
              chatData.sections = verifyData.improvedSections;
              console.log(`[Verify] Fixed issues: ${verifyData.issues?.join(', ')}`);
            }
          } catch { /* use original answer if verification fails */ }
        }

        // ── STEP 5: Normalize + Return ─────────────────────────────────
        const sections = Array.isArray(chatData.sections) ? chatData.sections : [];
        // Fallback: if model returned old-style explanation, wrap it
        if (sections.length === 0 && (chatData.explanation || chatData.answer)) {
          sections.push({
            title: "Answer",
            content: chatData.explanation || chatData.answer || "",
            points: Array.isArray(chatData.bullets) ? chatData.bullets : []
          });
        }

        return res.json({
          isQuestion: true,
          question: transcript,
          confidence: 1.0,
          type: questionType,
          difficulty,
          sections,
          code: chatData.code || "",
          codeLanguage: chatData.codeLanguage || chatData.language || "",
          bullets: [],
          spoken: chatData.spoken || "",
        });

        // ════════════════════════════════════════════════════════════════
        // VOICE MODE — Low Latency, High Signal Density
        // ════════════════════════════════════════════════════════════════
      } else {
        const voiceSystemPrompt = `You are an AI assistant helping a candidate during a live interview.
Analyze the transcript and determine if the interviewer asked a REAL interview question.
Ignore conversational filler, pleasantries, or technical difficulties (e.g., "Can you hear me?", "How are you?").

Return ONLY valid JSON. No markdown. No extra text.

JSON FORMAT:
{
  "isQuestion": boolean,
  "question": "Detected question or empty string",
  "confidence": 0.0-1.0,
  "type": "technical | behavioral | general",
  "bullets": [
    "Short talking point (max 10 words)",
    "Short talking point (max 10 words)",
    "Short talking point (max 10 words)",
    "Short talking point (max 10 words)"
  ],
  "spoken": "1-2 sentence confident answer the user could say aloud."
}

DETECTION RULES:
- If transcript contains a genuine interview question: isQuestion = true, extract the main question
- If it's just filler/pleasantries (e.g. "I can see your screen", "Let's get started"): isQuestion = false
- If no question detected: isQuestion = false, return empty bullets array

BULLET STYLE — TECHNICAL QUESTIONS:
Include keyword-dense talking points with:
• Algorithm or pattern name
• Big-O complexity (e.g. O(n log n))
• Key trade-offs
• Production/edge case consideration
Examples: "HashMap lookup O(1) average case" | "Avoid nested loops, use sorting O(n log n)" | "Handle null and empty input edge cases"

BULLET STYLE — BEHAVIORAL QUESTIONS (STAR method):
• Situation: what was the context?
• Task: what was your responsibility?
• Action: what did you specifically do?
• Result: measurable outcome
Examples: "Legacy API slowed under heavy traffic" | "Led async processing refactor" | "Reduced latency by 60%" | "Improved reliability 99.9% uptime"

SPOKEN FIELD: A confident, complete 1-2 sentence answer the user can say out loud immediately.

CONTEXT:
Resume: ${resume || 'Not provided'}
Job Description: ${jd || 'Not provided'}
Persona: ${persona}
${persona === 'Technical Interviewer' ? '\nFocus on engineering depth, Big-O complexity, and edge cases.' : ''}
${persona === 'Executive Assistant' ? '\nFocus on business impact, decision making, and strategy.' : ''}
${persona === 'Language Translator' ? '\nTranslate accurately while maintaining tone and cultural context.' : ''}

Return ONLY JSON.`;

        const selectedVoiceModel = customModel || "llama-3.1-8b-instant";
        const voiceParams: any = {
          messages: [
            { role: "system", content: voiceSystemPrompt },
            { role: "user", content: `Transcript: "${transcript}"` }
          ],
          model: selectedVoiceModel,
          response_format: { type: "json_object" },
          temperature: 0.3, // Low temperature = fast, accurate, deterministic
        };

        if (supportsLogprobs(selectedVoiceModel)) {
          voiceParams.logprobs = true;
        }

        const voiceCompletion = await groq.chat.completions.create(voiceParams);

        // Calculate actual logprob confidence or use LLM self-estimation
        const voiceTokens = (voiceCompletion.choices[0] as any)?.logprobs?.content;
        let logprobConfidence = -1;
        if (voiceTokens && Array.isArray(voiceTokens) && voiceTokens.length > 0) {
          const avgLogProb = voiceTokens.reduce((s: number, t: any) => s + (t.logprob || 0), 0) / voiceTokens.length;
          logprobConfidence = Math.exp(avgLogProb);
          console.log(`[Voice] Question detection API completed with avg logprob confidence: ${logprobConfidence.toFixed(2)}`);
        } else {
          try {
            const confCompletion = await groq.chat.completions.create({
              model: "llama-3.1-8b-instant",
              messages: [
                { role: "system", content: "You are evaluating an audio transcript to determine if it contains a genuine interview question or just filler conversation. Rate your confidence that the transcript contains a real question. Return ONLY a JSON object: {\"confidence\": number} where the number is a float between 0.0 (definitely just filler/no question) and 1.0 (definitely a clear question)." },
                { role: "user", content: `Transcript: "${transcript}"` }
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
            });
            const confData = JSON.parse(confCompletion.choices[0]?.message?.content || "{}");
            if (typeof confData.confidence === 'number') {
              logprobConfidence = confData.confidence;
              console.log(`[Voice] Question detection API completed with LLM self-confidence: ${logprobConfidence.toFixed(2)}`);
            }
          } catch {
             console.log(`[Voice] Question detection API fallback to default confidence`);
          }
        }

        let voiceData: any = { isQuestion: false };
        try {
          voiceData = JSON.parse(voiceCompletion.choices[0]?.message?.content || "{}");
          
          if (logprobConfidence >= 0) {
            voiceData.confidence = logprobConfidence; // Override self-reported LLM confidence
          }
        } catch {
          voiceData = { isQuestion: false };
        }
        
        // Anti-hallucination guard
        if (voiceData.isQuestion && voiceData.confidence < 0.2) {
           console.log(`[Voice] Rejected question due to low confidence (< 0.2)`);
           voiceData.isQuestion = false;
        }
        
        return res.json(voiceData);
      }

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
