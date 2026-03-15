import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline, env } from '@xenova/transformers';

// Suppress local transformer model warnings and force download
env.allowLocalModels = false;

// ════════════════════════════════════════════════════════════════
// VECTOR CACHE (Pre-Interview Generation to drastically reduce latency)
// ════════════════════════════════════════════════════════════════
let vectorCache: any[] = [];
const CACHE_FILE = path.join(os.tmpdir(), 'aurascribe_cache.json');
try {
  if (fs.existsSync(CACHE_FILE)) {
    vectorCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`Loaded ${vectorCache.length} cached answers from disk.`);
  }
} catch (e) {
  console.log('No cache found or malformed.');
}

let extractor: any = null;
async function getEmbedding(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
}

function cosineSimilarity(a: number[], b: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractJSON(content: string): any {
  if (!content) return {};
  try {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

dotenv.config();

export async function startServer(): Promise<number> {
  const app = express();
  let initialPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createServer(app);

  app.use(express.json({ limit: '50mb' }));

  function getGroq(customKey?: string) {
    const key = customKey || process.env.GROQ_API_KEY;
    if (!key) {
      const err = new Error("API key is required. Please provide it in settings or set GROQ_API_KEY environment variable in your .env file.");
      (err as any).status = 401;
      throw err;
    }
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
      // FAST LOOKUP — Vector Cache Match
      // ════════════════════════════════════════════════════════════════
      try {
        if (vectorCache.length > 0 && (mode === 'chat' || mode === 'voice')) {
          const emb = await getEmbedding(transcript);
          
          let topMatches = [];
          for (const item of vectorCache) {
            // Ignore items embedded with a different model if one changes down the line
            if (item.embeddingModel && item.embeddingModel !== 'all-MiniLM-L6-v2') continue;
            
            let maxScore = cosineSimilarity(emb, item.embedding);
            
            // Check all variants for a potentially higher similarity hit
            if (item.variantEmbeddings && Array.isArray(item.variantEmbeddings)) {
              for (const varEmb of item.variantEmbeddings) {
                const varScore = cosineSimilarity(emb, varEmb);
                if (varScore > maxScore) {
                  maxScore = varScore;
                }
              }
            }

            topMatches.push({ item, score: maxScore });
          }
          
          topMatches.sort((a, b) => b.score - a.score);
          // Look at topK = 5
          const bestMatches = topMatches.slice(0, 5);
          
          // Re-rank basic thresholding check logic
          let bestMatch = null;
          let bestScore = -1;
          for (const match of bestMatches) {
             if (match.score > bestScore) {
                bestScore = match.score;
                bestMatch = match.item;
             }
          }

          // Optimal threshold for all-MiniLM-L6-v2 context variations
          if (bestMatch && bestScore > 0.82) {
             console.log(`[Cache HIT] Score: ${bestScore.toFixed(2)} | Q: ${bestMatch.question.substring(0, 40)}`);
             if (mode === 'chat') {
                 return res.json({
                   isQuestion: true,
                   question: bestMatch.question, // Re-map nicely to the clean generated question
                   confidence: 1.0,
                   type: bestMatch.answer.type || 'concept',
                   difficulty: bestMatch.answer.difficulty || 'medium',
                   sections: bestMatch.answer.sections || [],
                   code: bestMatch.answer.code || "",
                   codeLanguage: bestMatch.answer.codeLanguage || "",
                   bullets: [],
                   spoken: bestMatch.answer.spoken || "",
                 });
             } else {
                 return res.json({
                   isQuestion: true,
                   question: bestMatch.question,
                   confidence: 1.0,
                   type: bestMatch.answer.type || 'technical',
                   bullets: bestMatch.answer.bullets || bestMatch.answer.sections?.flatMap((s: any) => s.points || []) || [],
                   spoken: bestMatch.answer.spoken || "I can definitely help with that.",
                 });
             }
          }
        }
      } catch (e) {
        console.error("Vector search failed, falling back to LLM", e);
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
      "content": "2-4 sentences explaining this clearly in a confident, narrative first-person tone. Vary your openers (e.g., 'In my projects...', 'I've found that...', 'Architecturally, I prefer...', 'One thing I prioritize is...'). Avoid repeating 'I typically' or 'In my experience' at the start of every paragraph. NO bullet points inside content.",
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
          temperature: 0.4, // Lower = more accurate, less hallucination
          response_format: { type: "json_object" },
        };

        if (supportsLogprobs(chatModel)) {
          chatParams.logprobs = true;
        }

        const chatCompletion = await groq.chat.completions.create(chatParams);

        const chatData = extractJSON(chatCompletion.choices[0]?.message?.content || "{}");

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
              temperature: 0.1,
            });
            const confData = extractJSON(confCompletion.choices[0]?.message?.content || "{}");
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

  // Background Cache Generator Endpoint
  app.post("/api/generate-cache", async (req, res) => {
    const customKey = req.headers['x-api-key'] as string;
    const { jd, resume } = req.body;

    if (!jd || jd.length < 50) {
      console.log("[Cache] JD too short or missing. Skipping.");
      return res.status(400).json({ status: "JD too short" });
    }

    try {
      const groq = getGroq(customKey);
      console.log("[Cache] Starting pre-interview cache generation...");

      // Step 1: Generate Questions
      const questionsCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a senior technical interviewer. Based on this job description, generate 35 distinct, highly likely interview questions.
Include concept questions, system design questions, coding queries, and behavioral questions.
Return ONLY a valid JSON object matching this exact schema:
{
  "questions": [
    "Explain the difference between REST and GraphQL.",
    "Design a scalable notification system.",
    "Tell me about a time you resolved a difficult bug."
  ]
}`
          },
          { role: "user", content: `Job Description:\n${jd}` }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
      });

      const data = extractJSON(questionsCompletion.choices[0]?.message?.content || "{}");
      const questions: string[] = Array.isArray(data.questions) ? data.questions : [];
      
      if (questions.length === 0) {
        console.log("[Cache] Failed to generate questions array.");
        return;
      }
      
      console.log(`[Cache] Found ${questions.length} questions. Generating answers & embeddings...`);
      vectorCache = []; // clear old cache

      // Step 2: Generate Answers & Embeddings
      // Run sequentially to keep Groq happy, but fast because 8b model
      const systemPrompt = `You are a senior software engineer and interview coach.
Answer the interview question comprehensively. Ensure you provide paraphrased variants of the question to assist vector similarity searching.
Return ONLY valid JSON matching exactly:
{
  "variants": ["Paraphrase 1", "Paraphrase 2", "Paraphrase 3"],
  "sections": [
    {
      "title": "Short section title (2-5 words)",
      "content": "2-4 sentences explaining this clearly in a confident, narrative first-person tone. Vary your openers (e.g., 'In my projects...', 'I've found that...', 'Architecturally, I prefer...', 'One thing I prioritize is...'). Avoid repeating 'I typically' or 'In my experience' at the start of every paragraph.",
      "points": ["Scannable key takeaway max 10 words", "Another short takeaway"]
    }
  ],
  "bullets": ["Technical bullet 1", "Technical bullet 2", "Technical bullet 3"],
  "code": "Complete code snippet if coding is requested, else strictly an empty string",
  "codeLanguage": "language name or empty string",
  "spoken": "A 1-2 sentence confident spoken answer.",
  "type": "concept",
  "difficulty": "medium",
  "category": "backend"
}
Keep sections to mostly 2-3 maximum. DO NOT include markdown code fences overall.
RULES:
1. "code" MUST ALWAYS be a string. Never null. Always use "" for empty code.
2. "difficulty" MUST ALWAYS be included exactly as "easy", "medium", or "hard".
3. "variants" MUST include at least 2 conversational variations of the question.`;

      for (const q of questions) {
         try {
            const ansCompletion = await groq.chat.completions.create({
              messages: [
                 { role: "system", content: systemPrompt },
                 { role: "user", content: `Question: ${q}\n\nResume Context: ${resume || 'None'}\nJob Context: ${jd.substring(0, 1000)}` }
              ],
              model: "llama-3.1-8b-instant", // Using 8b for bulk speed
              response_format: { type: "json_object" },
              temperature: 0.2, // Deterministic
            });

            let answerJson = JSON.parse(ansCompletion.choices[0]?.message?.content || "{}");
            
            // Standardize code and difficulty fallbacks mapping natively
            if (answerJson.code === null || answerJson.code === undefined) answerJson.code = "";
            if (!answerJson.difficulty) answerJson.difficulty = "medium";
            
            // Extract variants and generate embeddings
            const variants = Array.isArray(answerJson.variants) ? answerJson.variants : [];
            delete answerJson.variants; // Remove from answers to keep structure clean
            
            const variantEmbeddings: number[][] = [];
            for (const variant of variants) {
                if (typeof variant === 'string' && variant.trim().length > 5) {
                    const varEmb = await getEmbedding(variant);
                    variantEmbeddings.push(varEmb);
                }
            }

            // Create a single unique entry for the MAIN QUESTION + VARIANTS
            const emb = await getEmbedding(q);
            vectorCache.push({
               id: Math.random().toString(36).substring(7),
               question: q,
               embeddingModel: "all-MiniLM-L6-v2",
               embedding: emb,
               variants: variants,
               variantEmbeddings: variantEmbeddings,
               answer: answerJson
            });

            console.log(`[Cache] Pre-generated: ${q.substring(0, 45)}... with ${variants.length} variations`);
         } catch(e) {
           console.log(`[Cache] Skipped individual generation for: ${q}`);
         }
      }

      // Step 3: Write out buffer to cache file
      fs.writeFileSync(CACHE_FILE, JSON.stringify(vectorCache));
      console.log(`[Cache] Success! ${vectorCache.length} questions are now primed natively in vector cache.`);
      
      // Return success response to frontend
      res.json({ status: `Successfully cached ${vectorCache.length} questions!` });
    } catch(err: any) {
      console.error("[Cache] Background generation failed pipeline:", err);
      res.status(500).json({ status: "Generation failed", error: err.message });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const viteModule = await import('vite');
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    
    // SPA Fallback for React Router
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve) => {
    const startListen = (port: number) => {
      httpServer.listen(port, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${port}`);
        resolve(port);
      }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Server] Port ${port} is in use, trying ${port + 1}...`);
          startListen(port + 1);
        } else {
          console.error(err);
        }
      });
    };
    startListen(initialPort);
  });
}

// Always start in dev script
startServer().catch(console.error);
