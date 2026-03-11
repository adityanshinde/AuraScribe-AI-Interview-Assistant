# AuraScribe AI Copilot 🚀

AuraScribe is an advanced, real-time AI assistant designed for interviews, meetings, and live translations. It captures audio from your system or browser, transcribes it instantly using ultra-fast models, and provides intelligent, context-aware insights.

---

## ✨ Key Features

### 🎙️ Real-Time Intelligence
- **Ultra-Fast Transcription**: Powered by Groq's Whisper Large V3 Turbo for near-zero latency speech-to-text.
- **Smart Question Detection**: Automatically identifies when you're being asked a question and triggers the AI Copilot.
- **Instant Copilot Answers**: Provides concise bullet points and a suggested verbal response within seconds.

### 🎭 Meeting Personas
Tailor the AI's "personality" and focus based on your meeting type:
- **Technical Interviewer**: Focuses on code snippets, Big O complexity, and deep technical edge cases.
- **Executive Assistant**: Summarizes action items, key decisions, and high-level strategy.
- **Language Translator**: Accurately translates dialogue while maintaining the original tone and context.

### 🧠 Personalized Grounding
- **Resume-Based Training**: Paste your resume in settings to receive answers tailored to your specific experience and background.
- **JD Contextualization**: Paste the Job Description (JD) to ensure the AI aligns its suggestions with the role's requirements.

### 🕵️ Stealth & Productivity
- **Stealth Mode (Opacity)**: Adjust the widget's transparency (10% to 100%) to keep it subtle on your screen.
- **Mini Mode**: A compact view that takes up minimal screen real estate while still showing the most critical insights.
- **Always on Top**: Keep the widget visible over all other windows (Zoom, Teams, IDEs).
- **Click-Through Mode**: Make the window unclickable so it doesn't interfere with your typing or coding.

### 📊 Session Management
- **Live Visualizer**: Real-time waveform feedback to confirm audio capture is active.
- **Session History**: Review all questions and answers from your current session.
- **History Export**: Download your entire session log as a `.txt` file for post-meeting review.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A **Groq API Key** (Get it free at [console.groq.com](https://console.groq.com))

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/aurascribe.git

# Navigate to the project
cd aurascribe

# Install dependencies
npm install
```

### 3. Running the App

#### **Web Version (Browser)**
Perfect for Google Meet or browser-based calls.
```bash
npm run dev
```
1. Open `http://localhost:3000`.
2. Click **Start Session** and select the tab you want to capture.
3. **Important**: Ensure "Also share tab audio" is checked in the browser dialog.

#### **Desktop Version (Electron)**
The most powerful mode for system-wide capture (Zoom, Teams, Slack).
```bash
npm run electron:dev
```

---

## ⌨️ Global Hotkeys

AuraScribe supports system-wide hotkeys (customizable in Settings):
- **Hide/Show Widget**: `Ctrl + Shift + H` (Default)
- **Toggle Click-Through**: `Ctrl + Shift + X` (Default)

---

## ⚙️ Configuration

Click the **Gear Icon** in the widget to configure:
- **Groq API Key**: Your personal key for AI processing.
- **Audio Output (TTS)**: Select a specific device for the AI's spoken responses.
- **Intelligence Model**: Choose between Llama 3.3 70B (Recommended), Llama 3.1 8B (Fast), or DeepSeek R1.
- **Meeting Persona**: Select the focus of the AI.
- **Resume & JD**: Paste your details for personalized grounding.
- **Stealth Mode**: Adjust the slider for transparency.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Node.js, Express
- **Desktop**: Electron
- **AI Engine**: Groq SDK (Whisper for STT, Llama/DeepSeek for LLM)
- **Audio**: Web Audio API & WebRTC

---

## 🛡️ Privacy & Security
- **Local Storage**: Your API keys and settings are stored locally on your device.
- **No Data Persistence**: AuraScribe does not store your audio or transcripts on any server. Data is processed in real-time and cleared when the session ends (unless you export history).

---

## 📝 License
MIT License. Created with ❤️ for the developer community.
