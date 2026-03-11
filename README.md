# Parakeet AI Copilot

Parakeet AI Copilot is an intelligent, real-time interview and meeting assistant. It listens to your system audio or browser tabs, transcribes the conversation live using Whisper, detects questions, and uses LLMs (like Llama 3) to generate perfect, bulleted hints and verbal responses instantly.

## 🌟 Features

- **Real-Time Transcription**: Uses Groq's ultra-fast Whisper API to transcribe audio with near-zero latency.
- **Smart Question Detection**: Automatically identifies when you are being asked a question.
- **Instant Answers**: Generates bulleted hints and a suggested spoken response.
- **Customizable AI**: Bring your own Groq API key and choose your preferred model (Llama 3, Mixtral, Gemma).
- **Cross-Platform**: Works as a Web App, a native Windows/macOS Desktop App, and on Mobile devices.

---

## 🚀 How to Use (By Platform)

### 1. Windows / macOS Desktop App (Recommended for Interviews)

The desktop app is the most powerful way to use Parakeet AI. It runs as a floating, transparent widget that is **invisible to screen sharing** (like Zoom, Teams, or Google Meet).

**Setup:**
1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Download and extract the project ZIP.
3. Open a terminal in the project folder and run:
   ```bash
   npm install
   ```
4. Start the desktop app:
   ```bash
   npm run electron:dev
   ```

**Usage:**
1. Click the **Settings (Gear)** icon in the top right.
2. Enter your **Groq API Key** (get one free at [console.groq.com](https://console.groq.com)).
3. Select your preferred AI Model and click **Save Settings**.
4. Click **Start Session**. The app will automatically capture your system audio (no popup required!).
5. **Pro Tip:** You can drag the window by the top header and resize it from the edges.
6. **Ghost Mode:** Press `Ctrl + Shift + X` (or `Cmd + Shift + X` on Mac) to make the window unclickable so it doesn't interfere with your coding or typing. Press it again to make it clickable.

### 2. Web Browser (Chrome, Edge, Firefox)

You can use Parakeet AI directly in your browser without installing anything. This is perfect for browser-based meetings (like Google Meet).

**Setup:**
1. Run the development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` in your browser.

**Usage:**
1. Click the **Settings (Gear)** icon and enter your Groq API Key.
2. Click **Start Session**.
3. Your browser will ask you what you want to share.
4. Select the **Chrome Tab** where your meeting is happening.
5. ⚠️ **CRITICAL:** You MUST check the **"Also share tab audio"** switch at the bottom of the dialog before clicking Share!
6. The AI will now listen to that tab and provide live answers.

### 3. Mobile App (iOS / Android)

Since this is a web-based PWA (Progressive Web App) architecture, you can use it on your phone!

**Setup:**
1. Host the application on a public server (e.g., Vercel, Render, or Cloud Run).
2. Open the URL on your mobile browser (Safari on iOS, Chrome on Android).

**Usage:**
1. Tap the **Settings** icon to add your API Key.
2. Tap **Start Session**.
3. On mobile, the browser will request Microphone permissions. Allow it.
4. Place your phone near your computer speakers during an interview. The phone's microphone will pick up the interviewer's voice and generate answers on your phone screen!

---

## ⚙️ Configuration & Settings

You can configure the app by clicking the **Settings (Gear)** icon in the top right of the widget.

- **Groq API Key**: Required to run the AI models. You can get a free key from [Groq Console](https://console.groq.com/keys).
- **Voice Model (Transcription)**: Choose the model that listens and converts speech to text.
  - `Whisper Large V3 Turbo`: Fastest, highly recommended for real-time interviews.
  - `Whisper Large V3`: Slightly slower, but the most accurate.
  - `Distil Whisper`: Great for English-only conversations.
- **Text Model (AI Copilot)**: Choose the brain behind your copilot that generates answers.
  - `Llama 3.3 70B (Recommended)`: Best overall reasoning and speed.
  - `Mixtral 8x7B`: Great alternative for fast, concise answers.
  - `Gemma 2 9B`: Lightweight and highly accurate for technical questions.

These settings are saved locally on your device (`localStorage`) and are never sent to any external servers other than Groq.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express
- **Desktop Wrapper**: Electron
- **AI / LLM**: Groq SDK (Whisper for STT, Llama 3 for LLM)
- **Audio Capture**: WebRTC (`getDisplayMedia` / `getUserMedia`)

## 📝 License
MIT License. Free to use and modify.
