# AuraScribe AI Copilot 🧠⚡

> **The stealth AI copilot for technical interviews, live meetings, and real-time learning.**  
> AuraScribe listens to your screen audio, understands questions instantly, and delivers structured, interview-quality answers — all while remaining invisible to screen share.

---

## 📸 What It Does

AuraScribe runs as a transparent overlay on your desktop. During a technical interview or meeting:

1. **Voice Mode** — It listens to the call audio in real-time, detects when a question is asked, and shows glanceable bullet-point talking points within seconds
2. **Chat Mode** — You type any question and receive a deeply structured, multi-section answer with prose explanations, key points, and complete working code — like having a senior engineer beside you

---

## ✨ Feature Overview

### 🎙️ Voice Mode — Real-Time Interview Assist
- **Ultra-fast transcription** via Groq's `whisper-large-v3-turbo` — near-zero latency STT
- **Smart question detection** — automatically identifies interview questions from system audio
- **STAR-method behavioral answers** — bullets formatted as Situation → Action → Result
- **Big-O aware technical bullets** — keyword-dense talking points with complexity notation
- **Spoken response** — a confident 1–2 sentence verbal answer you can say immediately
- **Hallucination filter** — 30+ common Whisper false transcriptions are auto-removed
- **Technical term correction** — fixes common Whisper mishearings (`virtual dome` → `virtual DOM`, etc.)

### 💬 Chat Mode — Deep Learning & Interview Prep
- **Type any question** — no microphone needed; works while voice mode is off
- **3-Phase AI Pipeline** (see architecture below):
  1. **Difficulty Classifier** — routes question to the right prompt style
  2. **Adaptive Answer Generator** — structured multi-section response
  3. **Self-Verification** — second LLM checks hard/system-design answers for errors
- **Structured section cards** — each answer is divided into titled sections (not a wall of text):
  - Concept questions → *What It Is / How It Works / Trade-offs / When To Use*
  - Comparison questions → *X Overview / Y Overview / Key Differences / When To Use Which*
  - Coding questions → *Problem Understanding / Approach & Logic / Complexity Analysis + Code*
  - Behavioral questions → *Situation / What I Did / Result & Learnings*
- **Complete code blocks** — syntax-highlighted with language label and Copy button
- **Key takeaways** — 2–4 crisp one-liners per section for quick scanning
- **Copy full answer** — exports entire response as clean markdown to clipboard
- **Keyboard shortcut (`Ctrl+Shift+Space`)** — focuses chat input without touching the mouse

### 🕵️ Stealth Mode — Invisible During Screen Share
- **`setContentProtection(true)`** — window is invisible in Zoom, Teams, OBS, and all screen share tools
- **Click-through ON by default** — cursor passes through the overlay, no mouse movement visible to interviewer
- **`Ctrl+Shift+Space`** to focus chat (keyboard-only — cursor stays exactly where it was)
- **`Esc` to blur** — instantly re-enables click-through after typing
- **`Ctrl+Shift+H`** to hide/show the entire widget
- **`Ctrl+Shift+X`** to manually toggle click-through

### 🎭 Meeting Personas
Switch the AI's focus based on your context:
| Persona | Focus |
|---|---|
| **Technical Interviewer** | Architecture decisions, Big-O complexity, production trade-offs, edge cases |
| **Executive Assistant** | Business impact, action items, strategic decisions, communication clarity |
| **Language Translator** | Accurate translation with cultural context and tone preservation |

### 🧠 Personalized Grounding
- **Resume upload** — paste your resume to get answers tailored to your specific projects and stack
- **Job Description (JD)** — paste the JD to align all answers to the role's requirements
- Both are sent as context with every API request for deeply personalized responses

### 📊 Session Experience
- **Live audio visualizer** — waveform confirms capture is active
- **Q&A history panel** — all questions and answers from the session
- **Older answers fade** — latest answer is full brightness; earlier ones fade to 30%
- **History export** — download session as `.txt` for post-interview review
- **Clear session** — wipe history with one click

---

## 🤖 AI Architecture (Chat Mode Pipeline)

```
User Question (typed)
        │
        ▼
┌──────────────────────────────────────┐
│  STEP 1: Difficulty Classifier        │  llama-3.1-8b-instant  ~100ms
│  → type: concept | coding |           │  temperature: 0.1
│          system_design | behavioral   │
│  → difficulty: easy | medium | hard   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  STEP 2: Adaptive Prompt Builder      │
│  • Section structure from type       │
│  • Depth instructions from difficulty│
│  • Persona & Resume/JD context       │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  STEP 3: Answer Generator             │  llama-3.3-70b-versatile  ~2-3s
│  • Structured sections[] JSON        │  temperature: 0.4
│  • title + content + points[] per    │  response_format: json_object
│    section                           │
│  • code + codeLanguage if needed     │
└──────────────────┬───────────────────┘
                   │
         [if hard or system_design]
                   │
                   ▼
┌──────────────────────────────────────┐
│  STEP 4: Self-Verification            │  llama-3.1-8b-instant  ~300ms
│  • Checks: Big-O errors, hallucinated│  temperature: 0.2
│    APIs, missing edge cases, facts   │
│  • Returns improved sections if wrong│
└──────────────────┬───────────────────┘
                   │
                   ▼
        Structured Response
   rendered as section cards in UI
```

**Voice Mode Pipeline:**
```
System Audio → Whisper STT → Transcript Buffer → Question Detection
→ llama-3.1-8b-instant (temperature: 0.3) → STAR/Big-O bullets + spoken
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A **Groq API Key** — free at [console.groq.com](https://console.groq.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/aurascribe.git
cd aurascribe

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root (see `.env.example`):

```env
GROQ_API_KEY=your_groq_api_key_here
```

> Your API key can also be entered live inside the app's Settings panel — no restart needed.

---

## ▶️ Running AuraScribe

### 1️⃣ Run for Development (Browser)
Best for quick testing UI changes or browser-based interviews (Google Meet).

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

> ⚠️ When starting a Voice session: check **"Also share tab audio"** in the browser capture dialog.

### 2️⃣ Run as Desktop App (Local Dev)
Most powerful — captures system-wide audio from Zoom, Teams, Slack, any app. Runs the Node backend and Electron wrapper simultaneously.

```bash
npm run electron:dev
```

### 3️⃣ Generate Native `.exe` Installer (Production)
To package AuraScribe into a standalone, installable `.exe` file that works on any Windows device without needing Node.js, code editors, or a terminal:

```bash
npm run dist
```

**What happens during the build pipeline?**
1. **`build:ui`**: Compiles the React frontend via Vite.
2. **`build:server`**: Bundles the `server.ts` Node backend using `tsup` into a lightweight, standalone `server.cjs` script.
3. **`electron-builder`**: Wraps the UI, the compiled Node backend, and the Electron browser engine into a single unified NSIS installer block.

Once the terminal process finishes (it usually takes 2-3 minutes to download the initial Electron binaries), you will find the setup file located exactly here: 
👉 `release/AuraScribe Setup 0.0.0.exe`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Space` | **Focus chat input** (stealth — no mouse movement) |
| `Enter` | Submit chat question + auto-return to click-through |
| `Esc` | Blur chat input / re-enable click-through |
| `Ctrl+Shift+X` | Toggle click-through mode on/off |
| `Ctrl+Shift+H` | Hide / Show the overlay completely |

---

## ⚙️ Settings Panel

Click the **Gear icon** to configure:

| Setting | Description |
|---|---|
| **Groq API Key** | Your personal key (stored locally, never sent to our servers) |
| **AI Model** | `llama-3.3-70b-versatile` (recommended) · `llama-3.1-8b-instant` (fast) |
| **Whisper Model** | Speech-to-text model for voice transcription |
| **Meeting Persona** | Technical Interviewer / Executive Assistant / Language Translator |
| **Resume** | Paste resume for personalized answers |
| **Job Description** | Paste JD to align answers to the role |
| **Opacity** | Adjust widget transparency (10%–100%) |
| **Hotkeys** | Customize hide/show and click-through shortcuts |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Tailwind CSS v4, Lucide Icons, Motion |
| **Backend** | Node.js, Express 4, TypeScript |
| **Dev Server** | Vite 6 (middleware mode inside Express) |
| **Desktop** | Electron 41 |
| **AI — STT** | Groq SDK → `whisper-large-v3-turbo` |
| **AI — LLM (Chat)** | Groq SDK → `llama-3.3-70b-versatile` |
| **AI — LLM (Voice/Classify/Verify)** | Groq SDK → `llama-3.1-8b-instant` |
| **AI — TTS** | Google GenAI (`@google/genai`) |
| **Audio Capture** | Web Audio API + WebRTC `getDisplayMedia` |
| **Process Management** | `tsx watch` (hot-reload), `concurrently`, `wait-on` |
| **Styling utilities** | `clsx` + `tailwind-merge` |

---

## 📁 Project Structure

```
aurascribe/
├── electron/
│   └── main.cjs              # Electron main process
│                               # — Window config (transparent, always-on-top)
│                               # — Global hotkeys (Ctrl+Shift+Space/H/X)
│                               # — Click-through IPC (chat-input-focused/blurred)
│                               # — Screen capture permission handler
│                               # — Content protection (invisible on screen share)
│
├── src/
│   ├── components/
│   │   ├── OverlayWidget.tsx  # Main UI component
│   │   │                        # — Voice/Chat tab switch
│   │   │                        # — Chat input + history
│   │   │                        # — Section card renderer
│   │   │                        # — Code block with copy button
│   │   │                        # — Settings panel
│   │   │                        # — History panel + export
│   │   └── Visualizer.tsx     # Real-time audio waveform
│   │
│   ├── hooks/
│   │   ├── useAIAssistant.ts  # Chat & voice AI logic
│   │   │                        # — askQuestion() for chat mode
│   │   │                        # — processTranscript() for voice mode
│   │   │                        # — TTS playback via Google GenAI
│   │   └── useTabAudioCapture.ts  # System audio capture + Whisper STT
│   │                               # — getDisplayMedia loopback
│   │                               # — Chunked audio recording
│   │                               # — Rate limit handling
│   │
│   ├── App.tsx                # Root component
│   ├── main.tsx               # React entry point
│   └── index.css              # Global styles
│
├── server.ts                  # Express backend
│                               # — /api/health
│                               # — /api/transcribe (Whisper STT)
│                               # — /api/analyze (Chat + Voice AI)
│                               #     ├── Difficulty Classifier
│                               #     ├── Adaptive Prompt Builder
│                               #     ├── Answer Generator (70b)
│                               #     └── Self-Verifier (8b, hard questions only)
│
├── .env.example               # Environment variable template
├── package.json               # Scripts + dependencies
├── tsconfig.json              # TypeScript config
└── vite.config.ts             # Vite + React plugin config
```

---

## 🔒 Privacy & Security

| Concern | How AuraScribe handles it |
|---|---|
| **API Keys** | Stored in browser `localStorage` — never sent to any third-party server |
| **Audio** | Processed in real-time via Groq's API. Never stored on any server |
| **Transcripts** | Sent to Groq for processing only. Not persisted anywhere |
| **Resume/JD** | Stored in `localStorage`. Sent as LLM context only. Never logged |
| **Screen Share Visibility** | `setContentProtection(true)` makes the window invisible to OBS, Zoom, Teams, and all capture tools |

---

## 🧩 API Reference

### `POST /api/transcribe`
Transcribes base64-encoded audio using Whisper.

**Headers:** `x-api-key`, `x-voice-model`  
**Body:** `{ audioBase64: string, mimeType: string }`  
**Returns:** `{ text: string }`

### `POST /api/analyze`
Generates AI answer for voice or chat mode.

**Headers:** `x-api-key`, `x-model`, `x-persona`, `x-mode: 'voice' | 'chat'`  
**Body:** `{ transcript: string, resume?: string, jd?: string }`

**Chat mode returns:**
```json
{
  "isQuestion": true,
  "type": "concept | coding | system_design | behavioral",
  "difficulty": "easy | medium | hard",
  "sections": [
    { "title": "...", "content": "...", "points": ["..."] }
  ],
  "code": "...",
  "codeLanguage": "..."
}
```

**Voice mode returns:**
```json
{
  "isQuestion": boolean,
  "question": "...",
  "confidence": 0.95,
  "type": "technical | behavioral | general",
  "bullets": ["...", "...", "..."],
  "spoken": "..."
}
```

---

## 🗺️ Roadmap

- [ ] **Markdown rendering** in section content
- [ ] **Persistent history** across sessions (SQLite via `better-sqlite3`)
- [ ] **Streaming responses** for real-time answer generation
- [ ] **Multi-monitor support** — pin widget to a specific display
- [ ] **Custom persona builder** — define your own AI role
- [ ] **Electron security hardening** — `contextIsolation: true` + preload script
- [ ] **Auto-paste mode** — send answer directly to focused text field
- [ ] **DeepSeek / Gemini model support** via configurable provider

---

## 📝 License

MIT License — Built with ❤️ for developers who refuse to go into interviews unprepared.
