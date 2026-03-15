import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Settings, Sparkles, Zap, Activity, Minimize2, Maximize2, Pin, PinOff, History, Download, EyeOff, Keyboard, MessageSquare, Send, AlertTriangle, CheckCircle, Monitor, Trash2, ChevronDown, Move, Star, Loader2 } from 'lucide-react';
import { useTabAudioCapture } from '../hooks/useTabAudioCapture';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { Visualizer } from './Visualizer';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Electron IPC helper
// Reliable Electron IPC detection for both Dev/Prod
let ipc: any = null;
if (typeof window !== 'undefined') {
  const win = window as any;
  if (win.require) {
    try {
      ipc = win.require('electron').ipcRenderer;
    } catch (e) {
      console.warn("Electron IPC not found via require", e);
    }
  }
  // Try direct access if exposed
  if (!ipc && win.electron && win.electron.ipcRenderer) {
    ipc = win.electron.ipcRenderer;
  }
  if (!ipc && win.ipcRenderer) {
    ipc = win.ipcRenderer;
  }
}

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Section {
  title: string;
  content: string;
  points?: string[];
}

interface HistoryItem {
  id: string;
  question: string;
  answer: string[];
  sections?: Section[];
  explanation?: string;
  code?: string;
  codeLanguage?: string;
  timestamp: number;
}

export default function OverlayWidget() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
  const [isTaskbarHidden, setIsTaskbarHidden] = useState(true);
  const [isAntiCaptureOn, setIsAntiCaptureOn] = useState(true);
  const [opacity, setOpacity] = useState(90);
  const [persona, setPersona] = useState('Technical Interviewer');
  const [resume, setResume] = useState('');
  const [jd, setJd] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hotkeys, setHotkeys] = useState({
    toggleHide: 'CommandOrControl+Shift+H',
    toggleClickThrough: 'CommandOrControl+Shift+X'
  });

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState('');
  const [enableTTS, setEnableTTS] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [voiceModel, setVoiceModel] = useState('whisper-large-v3-turbo');
  const [model, setModel] = useState('llama-3.3-70b-versatile');

  const [activeTab, setActiveTab] = useState<'voice' | 'chat'>('voice');
  const [chatInput, setChatInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{ status: string; isError?: boolean } | null>(null);
  const [appAlert, setAppAlert] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [screenSources, setScreenSources] = useState<{id: string, name: string, thumbnail: string}[] | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const showAlert = React.useCallback((message: string, type: 'error'|'success'|'info' = 'info') => {
    setAppAlert({ message, type });
    setTimeout(() => setAppAlert(null), 4000);
  }, []);

  const { detectedQuestion, answer, isProcessing, askQuestion, resetAssistant } = useAIAssistant(undefined, (msg) => showAlert(msg, 'error'));
  // Ensure we pass a callback that actually triggers an update if needed, but the hook holds its own state
  const { isListening, isRateLimited, transcript, startListening, stopListening, clearTranscript, stream } = useTabAudioCapture((text) => {
    // We could do secondary handling here, but the transcript state is already enough for the UI
    console.log('Voice caught:', text);
  }, (msg) => showAlert(msg, 'error'));

  const handleChatSubmit = async () => {
    const q = chatInput.trim();
    if (!q || isProcessing) return;
    setChatInput('');
    // Re-enter click-through mode after submitting — cursor stays on the other app
    ipc?.send('chat-input-blurred');
    chatInputRef.current?.blur();
    await askQuestion(q);
  };

  // ── Stealth hotkey: Ctrl+Shift+Space from Electron focuses chat input ──
  // When triggered, no mouse movement happens — purely keyboard-driven.
  useEffect(() => {
    if (!ipc) return;
    const handler = () => {
      setActiveTab('chat');
      // Small delay so tab switch renders before focus
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 60);
    };
    ipc.on('focus-chat-input', handler);
    return () => ipc.removeListener('focus-chat-input', handler);
  }, []);

  // Track the last question we added to history to prevent duplicates
  const lastProcessedQuestionRef = React.useRef<string | null>(null);

  // Save to history when a new answer is complete
  useEffect(() => {
    if (detectedQuestion && answer) {
      const questionKey = `${detectedQuestion.question}_${answer.bullets.join('|')}_${answer.explanation?.slice(0, 30)}`;
      if (lastProcessedQuestionRef.current === questionKey) return;

      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        question: detectedQuestion.question,
        answer: answer.bullets,
        sections: (answer as any).sections || [],
        explanation: answer.explanation,
        code: answer.code,
        codeLanguage: answer.codeLanguage,
        timestamp: Date.now()
      };

      setHistory(prev => {
        if (prev.length > 0 && prev[0].question === newItem.question && JSON.stringify(prev[0].answer) === JSON.stringify(newItem.answer)) {
          return prev;
        }
        return [newItem, ...prev].slice(0, 50);
      });

      lastProcessedQuestionRef.current = questionKey;
      clearTranscript();
    }
  }, [detectedQuestion, answer, clearTranscript]);


  useEffect(() => {
    const savedKey = localStorage.getItem('groq_api_key');
    const savedVoiceModel = localStorage.getItem('groq_voice_model');
    const savedModel = localStorage.getItem('groq_model');
    const savedPersona = localStorage.getItem('groq_persona');
    const savedResume = localStorage.getItem('groq_resume');
    const savedJd = localStorage.getItem('groq_jd');
    const savedOpacity = localStorage.getItem('aura_opacity');
    const savedHotkeys = localStorage.getItem('aura_hotkeys');
    const savedOutputDevice = localStorage.getItem('aura_output_device');
    const savedEnableTTS = localStorage.getItem('aura_enable_tts') === 'true';

    if (savedKey) setApiKey(savedKey);
    if (savedVoiceModel) setVoiceModel(savedVoiceModel);
    if (savedModel) setModel(savedModel);
    if (savedPersona) setPersona(savedPersona);
    if (savedResume) setResume(savedResume);
    if (savedJd) setJd(savedJd);
    if (savedOpacity) setOpacity(parseInt(savedOpacity));
    if (savedHotkeys) setHotkeys(JSON.parse(savedHotkeys));
    if (savedOutputDevice) setSelectedOutputDevice(savedOutputDevice);
    setEnableTTS(savedEnableTTS);

    // Load stealth toggles
    const savedTaskbar = localStorage.getItem('aura_stealth_taskbar');
    const savedAntiCapture = localStorage.getItem('aura_stealth_capture');
    
    if (savedTaskbar !== null) {
      const isHidden = savedTaskbar === 'true';
      setIsTaskbarHidden(isHidden);
      if (ipc) ipc.send('set-skip-taskbar', isHidden);
    } else {
      // Default stealth behavior on first load
      if (ipc) ipc.send('set-skip-taskbar', true);
    }

    if (savedAntiCapture !== null) {
      const isOn = savedAntiCapture === 'true';
      setIsAntiCaptureOn(isOn);
      if (ipc) ipc.send('set-stealth-mode', isOn);
    } else {
      // Default stealth behavior on first load
      if (ipc) ipc.send('set-stealth-mode', true);
    }

  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+H to toggle hide/show
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsHidden(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showSettings) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioDevices(outputs);
      });
    }
  }, [showSettings]);


  const saveSettings = () => {
    localStorage.setItem('groq_api_key', apiKey);
    localStorage.setItem('groq_voice_model', voiceModel);
    localStorage.setItem('groq_model', model);
    localStorage.setItem('groq_persona', persona);
    localStorage.setItem('groq_resume', resume);
    localStorage.setItem('groq_jd', jd);
    localStorage.setItem('aura_opacity', opacity.toString());
    localStorage.setItem('aura_hotkeys', JSON.stringify(hotkeys));
    localStorage.setItem('aura_output_device', selectedOutputDevice);
    localStorage.setItem('aura_enable_tts', enableTTS.toString());

    if (ipc) {
      ipc.send('update-hotkeys', hotkeys);
    }

    setShowSettings(false);
  };

  const handleClear = () => {
    clearTranscript();
    resetAssistant();
    setHistory([]);
  };

  const generateCache = async () => {
    if (!jd || jd.length < 50) return showAlert("Please enter a sufficiently long Job Description first.", "error");
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const res = await fetch('/api/generate-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ jd, resume })
      });
      const data = await res.json();
      setGenerateResult({ status: data.status, isError: !res.ok });
    } catch (e) {
      console.error(e);
      setGenerateResult({ status: "Failed to start generation pipeline.", isError: true });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleListen = async () => {
    if (isListening) {
      stopListening();
      setSessionStartTime(null);
      ipc?.send('chat-input-blurred');
    } else {
      ipc?.send('chat-input-focused');
      try {
        await startListening();
        setSessionStartTime(Date.now());
      } catch (e) {
        console.error('Start listening failed:', e);
      }
      ipc?.send('chat-input-blurred');
    }
  };

  useEffect(() => {
    if (!sessionStartTime || !isListening) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - sessionStartTime) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsedTime(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime, isListening]);

  const handleAIHelp = async () => {
    if (!transcript.trim() || isProcessing) return;
    // Just trigger the analysis on the current accumulated transcript
    await askQuestion(transcript);
  };

  const toggleAlwaysOnTop = () => {
    const newState = !isAlwaysOnTop;
    setIsAlwaysOnTop(newState);
    if (ipc) ipc.send('set-always-on-top', newState);
  };

  const toggleTaskbarHidden = () => {
    const newState = !isTaskbarHidden;
    setIsTaskbarHidden(newState);
    localStorage.setItem('aura_stealth_taskbar', newState.toString());
    if (ipc) ipc.send('set-skip-taskbar', newState);
  };

  const toggleAntiCapture = () => {
    const newState = !isAntiCaptureOn;
    setIsAntiCaptureOn(newState);
    localStorage.setItem('aura_stealth_capture', newState.toString());
    if (ipc) ipc.send('set-stealth-mode', newState);
  };

  const exportHistory = () => {
    const text = history.map(item => {
      return `Q: ${item.question}\nA: ${item.answer.join('\n')}\n[${new Date(item.timestamp).toLocaleTimeString()}]\n${'-'.repeat(20)}`;
    }).join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AuraScribe_Session_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "flex flex-col font-sans relative group transition-all duration-500 ease-in-out pointer-events-none",
        isHidden ? "h-14 w-14" : "h-full w-full",
        !isHidden && "pointer-events-auto",
        !("electron" in window) && "bg-[#050810]" // Fill background on web
      )}
      style={{ opacity: opacity / 100, webkitAppRegion: !isHidden ? 'no-drag' : 'none', padding: ("electron" in window) ? '4px' : '0' } as any}
    >
      {/* Global Toast Alert */}
      {appAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={cn("px-4 py-2.5 rounded-lg shadow-2xl border text-xs font-bold flex items-center gap-3 w-max max-w-[90vw]",
             appAlert.type === 'error' ? "bg-red-500/20 border-red-500/50 text-red-100 backdrop-blur-md" :
             appAlert.type === 'success' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-100 backdrop-blur-md" :
             "bg-cyan-500/20 border-cyan-500/50 text-cyan-100 backdrop-blur-md"
          )}>
             {appAlert.type === 'error' ? <AlertTriangle size={16} className="text-red-400"/> : <CheckCircle size={16} className={appAlert.type === 'success' ? 'text-emerald-400' : 'text-cyan-400'} />}
             <span className="opacity-90 leading-tight">{appAlert.message}</span>
             <button onClick={() => setAppAlert(null)} className="ml-2 hover:bg-white/10 p-1 rounded-full transition-colors"><X size={14}/></button>
          </div>
        </div>
      )}

      {isHidden ? (
        <button
          onClick={() => setIsHidden(false)}
          className="w-12 h-12 rounded-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:scale-110 transition-transform group/btn"
          title="Show AuraScribe (Ctrl+Shift+H)"
        >
          <div className="w-8 h-8 flex items-center justify-center overflow-hidden drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] group-hover/btn:scale-110 transition-transform">
            <img src="/icon.png" alt="AuraScribe" className="w-full h-full object-contain" />
          </div>
        </button>
      ) : (
        <div className="flex-1 bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-slate-200 relative">

          {/* Header (Parakeet Styled) */}
          <div className="drag-region h-[56px] flex items-center justify-between px-3 border-b border-white/5 bg-white/[0.01] shrink-0 gap-2">
            <div className="flex items-center gap-2 no-drag shrink-0 pr-2 border-r border-white/5">
               <div className="w-7 h-7 flex items-center justify-center p-1 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg border border-white/10">
                 <img src="/icon.png" alt="PS" className="w-full h-full object-contain" />
               </div>
               <div className="flex flex-col hide-sm">
                 <span className="font-black text-[11px] tracking-tight text-white/90 leading-tight">AuraScribe</span>
                 {isListening && <span className="text-[8px] font-bold text-red-500 animate-pulse uppercase leading-none">Recording</span>}
               </div>
            </div>

            <div className="flex items-center gap-1.5 no-drag flex-1 justify-center px-1">
              {/* AI Help */}
              <button
                onClick={handleAIHelp}
                disabled={!isListening || isProcessing}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black transition-all border shrink-0",
                  isProcessing 
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    : isListening 
                      ? "bg-black/80 border-white/20 text-white hover:bg-white hover:text-black hover:border-white shadow-lg"
                      : "bg-white/5 border-transparent text-slate-700 cursor-not-allowed"
                )}
              >
                <Sparkles size={13} className={isProcessing ? "animate-spin" : ""} />
                <span className="hide-sm">AI Help</span>
              </button>

              {/* Chat Button */}
              <button
                onClick={() => setActiveTab(activeTab === 'chat' ? 'voice' : 'chat')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black transition-all border shrink-0 shadow-lg",
                  activeTab === 'chat'
                    ? "bg-white text-black border-white"
                    : "bg-black/80 border-white/20 text-white hover:bg-white/10"
                )}
              >
                <MessageSquare size={13} />
                <span className="hide-sm">Chat</span>
              </button>
            </div>

            <div className="flex gap-1.5 no-drag items-center shrink-0 pl-2 border-l border-white/5">
              {isListening && (
                <span className="text-[10px] font-mono text-cyan-400/80 font-black px-1.5 hide-sm">{elapsedTime}</span>
              )}

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn("p-1.5 rounded-lg transition-all", showSettings ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]" : "text-white/40 hover:text-white hover:bg-white/5")}
                title="Settings"
              >
                <Settings size={14} />
              </button>

              <button 
                onClick={toggleListen}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-xl",
                  isListening ? "bg-red-500 text-white hover:bg-red-400" : "bg-white text-black hover:bg-slate-200"
                )}
                title={isListening ? "Stop Capturing" : "Start Capturing"}
              >
                 {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              <button 
                onClick={() => {
                  console.log('Triggering Hard Exit...');
                  if (ipc) {
                    ipc.send('QUIT_NOW');
                    ipc.send('close-app');
                  }
                  // Final direct fallback - should trigger window-all-closed in main
                  window.close();
                }}
                className="p-1.5 px-2 rounded-lg transition-all text-white/50 hover:text-white hover:bg-red-600 active:scale-90 group/exit shadow-lg"
                title="Force Close AuraScribe"
              >
                 <X size={20} strokeWidth={3} className="transition-transform group-hover/exit:rotate-90" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">

            {/* History Overlay */}
            {showHistory && (
              <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col no-drag">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <h2 className="text-sm font-bold text-white tracking-wide">Session History</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setHistory([])}
                      className="text-[10px] font-bold text-red-400/70 hover:text-red-400 uppercase tracking-wider mr-2"
                      title="Clear All History"
                    >
                      Clear All
                    </button>
                    <button onClick={exportHistory} className="text-slate-400 hover:text-white"><Download size={14} /></button>
                    <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                      <History size={32} className="mb-2" />
                      <p className="text-xs">No history yet</p>
                    </div>
                  ) : (
                    history.map(item => (
                      <div key={item.id} className="space-y-2">
                        <div className="text-[10px] text-slate-500 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</div>
                        <div className="text-xs font-bold text-white">{item.question}</div>
                        <div className="text-xs text-slate-400 space-y-1">
                          {item.answer.map((b, i) => <div key={i}>• {b}</div>)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Settings Overlay */}
            {showSettings ? (
              <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col no-drag">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <h2 className="text-sm font-bold text-white tracking-wide">Configuration</h2>
                  <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                </div>

                <div className="p-5 flex flex-col gap-5 overflow-y-auto scrollbar-hide">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Groq API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="gsk_..."
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Meeting Persona</label>
                    <select
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    >
                      <option value="Technical Interviewer">Technical Interviewer</option>
                      <option value="Executive Assistant">Executive Assistant</option>
                      <option value="Language Translator">Language Translator</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Your Resume (Context)</label>
                    <textarea
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                      placeholder="Paste your resume text here for personalized answers..."
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors h-24 resize-none scrollbar-hide"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Job Description (JD)</label>
                    <textarea
                      value={jd}
                      onChange={(e) => setJd(e.target.value)}
                      placeholder="Paste the job description here..."
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors h-24 resize-none scrollbar-hide"
                    />
                    <div className="flex justify-end relative bottom-1">
                      <button 
                        onClick={generateCache}
                        disabled={isGenerating || !jd || jd.length < 50}
                        className={cn(
                          "text-[10px] px-3 py-1.5 rounded transition-colors uppercase tracking-wider font-bold shadow-md",
                          isGenerating 
                             ? "bg-slate-800 text-slate-500 cursor-not-allowed border-transparent"
                             : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
                        )}
                      >
                        {isGenerating ? "Generating Cache..." : "Generate Interview Cache ⚡"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-400">Stealth Mode (Opacity)</label>
                      <span className="text-[10px] text-cyan-400 font-mono">{opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={opacity}
                      onChange={(e) => setOpacity(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-lg border border-white/10 my-2">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><EyeOff size={14}/> Stealth Capabilities</label>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">Hide from Taskbar / Alt+Tab</span>
                      <button onClick={toggleTaskbarHidden} className={cn("w-8 h-4 rounded-full relative transition-colors", isTaskbarHidden ? "bg-cyan-500" : "bg-slate-700")}>
                        <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", isTaskbarHidden ? "left-4.5" : "left-0.5")} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">Anti-Screenshare Shield</span>
                      <button onClick={toggleAntiCapture} className={cn("w-8 h-4 rounded-full relative transition-colors", isAntiCaptureOn ? "bg-cyan-500" : "bg-slate-700")}>
                        <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", isAntiCaptureOn ? "left-4.5" : "left-0.5")} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-2"><Keyboard size={12} /> Global Hotkeys</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase">Hide/Show</span>
                        <input
                          value={hotkeys.toggleHide}
                          onChange={(e) => setHotkeys({ ...hotkeys, toggleHide: e.target.value })}
                          className="bg-black/50 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase">Click-Through</span>
                        <input
                          value={hotkeys.toggleClickThrough}
                          onChange={(e) => setHotkeys({ ...hotkeys, toggleClickThrough: e.target.value })}
                          className="bg-black/50 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Intelligence Model</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    >
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (Super Fast)</option>
                      <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill 70B</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-slate-400">Voice Model (STT)</label>
                    <select
                      value={voiceModel}
                      onChange={(e) => setVoiceModel(e.target.value)}
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                    >
                      <option value="whisper-large-v3-turbo">Whisper Large V3 Turbo (Recommended)</option>
                      <option value="whisper-large-v3">Whisper Large V3</option>
                      <option value="distil-whisper-large-v3-en">Distil Whisper V3 (English Only)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-slate-400">Audio Output (TTS)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 uppercase">{enableTTS ? 'On' : 'Off'}</span>
                        <button
                          onClick={() => setEnableTTS(!enableTTS)}
                          className={cn(
                            "w-8 h-4 rounded-full relative transition-colors",
                            enableTTS ? "bg-cyan-500" : "bg-slate-700"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                            enableTTS ? "left-4.5" : "left-0.5"
                          )} />
                        </button>
                      </div>
                    </div>
                    {enableTTS && (
                      <select
                        value={selectedOutputDevice}
                        onChange={(e) => setSelectedOutputDevice(e.target.value)}
                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                      >
                        <option value="">Default Output</option>
                        {audioDevices.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Output ${device.deviceId.slice(0, 5)}...`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    onClick={saveSettings}
                    disabled={isGenerating}
                    className={cn(
                      "mt-2 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.15)]",
                      isGenerating
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-white text-black hover:bg-slate-200"
                    )}
                  >
                    Save Changes
                  </button>
                </div>

                {/* Styled Generation Popup / Loading Overlay inside Settings */}
                {isGenerating && (
                  <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center shadow-inner pt-20">
                    <div className="h-10 w-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
                    <h3 className="text-white font-bold text-lg mb-2">Generating Priority Vector Cache</h3>
                    <p className="text-slate-400 text-xs">Simulating 35 distinct potential interview scenarios. Please do not close...</p>
                  </div>
                )}
                
                {generateResult && !isGenerating && (
                  <div className="absolute inset-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center shadow-inner pt-20">
                    <div className={cn(
                      "h-12 w-12 rounded-full mb-4 flex items-center justify-center border-2",
                      generateResult.isError ? "bg-red-500/10 border-red-500 text-red-500" : "bg-emerald-500/10 border-emerald-500 text-emerald-500"
                    )}>
                      {generateResult.isError ? <X size={24} /> : <Sparkles size={24} />}
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">{generateResult.isError ? 'Cache Generation Failed' : 'Cache Optimized Successfully'}</h3>
                    <p className="text-slate-400 text-xs mb-6 max-w-xs">{generateResult.status}</p>
                    <button
                      onClick={() => setGenerateResult(null)}
                      className="px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Content Sections Container */}
                <div className="px-4 pt-1 flex items-center justify-between no-drag shrink-0 bg-transparent">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                       <Mic size={12} className={cn(isListening ? "text-red-400" : "text-slate-500")} />
                       <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Live Session</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isListening && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {isRateLimited && <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                            {isRateLimited ? 'Rate Limited' : 'Recording...'}
                          </span>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleClear}
                      className="text-[10px] font-bold text-slate-600 hover:text-white transition-colors uppercase tracking-widest bg-white/5 px-3 py-1 rounded-md"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {isMiniMode ? (
                  /* Mini Mode Content */
                  <div className="flex-1 p-4 flex flex-col gap-2 overflow-hidden bg-gradient-to-b from-indigo-900/10 to-transparent">
                    {detectedQuestion ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-white leading-snug border-l-2 border-cyan-500 pl-2 line-clamp-2">
                          {detectedQuestion.question}
                        </div>
                        {answer && (
                          <div className="text-[11px] text-slate-300 line-clamp-3 bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
                            {answer.bullets[0]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-2">
                        <Visualizer stream={stream} isListening={isListening} />
                        <Sparkles size={20} className="text-slate-500" />
                      </div>
                    )}
                  </div>
                ) : activeTab === 'chat' ? (
                  /* ── CHAT TAB ── */
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Chat answers area */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-10 no-drag">
                      {isProcessing && !answer && (
                        <div className="flex items-center gap-3 text-sm text-cyan-400/70 animate-pulse pt-4">
                          <div className="h-4 w-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin shrink-0"></div>
                          Aura is thinking deeply...
                        </div>
                      )}

                      {history.length > 0 ? (
                        history.map((item, index) => {
                          // Normalise: prefer sections[], fall back to legacy explanation
                          const sections: Section[] = (item.sections && item.sections.length > 0)
                            ? item.sections
                            : item.explanation
                              ? [{ title: 'Answer', content: item.explanation, points: item.answer }]
                              : [];

                          return (
                            <div key={item.id} className={cn(
                              "flex flex-col gap-4 transition-all duration-500 relative",
                              index === 0 ? "opacity-100" : "opacity-30 hover:opacity-70"
                            )}>
                              {index === 0 && (
                                <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 to-transparent rounded-full" />
                              )}

                              {/* Timestamp */}
                              <div className="text-[10px] font-bold text-cyan-500/40 uppercase tracking-widest">
                                {index === 0 ? 'Latest Answer' : `Earlier (${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                              </div>

                              {/* Question bubble */}
                              <div className="self-end max-w-[88%] bg-indigo-600/25 border border-indigo-500/30 rounded-2xl rounded-tr-sm px-4 py-3">
                                <p className={cn("text-sm leading-snug font-medium", index === 0 ? "text-white" : "text-slate-400")}>{item.question}</p>
                              </div>

                              {/* Structured Sections */}
                              {sections.map((section, si) => (
                                <div key={si} className={cn(
                                  "rounded-xl border overflow-hidden",
                                  index === 0 ? "border-white/8" : "border-white/[0.04]"
                                )}>
                                  {/* Section header */}
                                  <div className={cn(
                                    "px-4 py-2.5 border-b",
                                    index === 0
                                      ? "bg-cyan-950/60 border-cyan-500/20"
                                      : "bg-white/[0.02] border-white/[0.04]"
                                  )}>
                                    <span className={cn(
                                      "text-[11px] font-bold uppercase tracking-widest",
                                      index === 0 ? "text-cyan-400" : "text-slate-600"
                                    )}>{section.title}</span>
                                  </div>

                                  {/* Section body */}
                                  <div className={cn(
                                    "px-4 py-3 flex flex-col gap-3",
                                    index === 0 ? "bg-slate-900/50" : "bg-white/[0.01]"
                                  )}>
                                    {/* Prose paragraph */}
                                    <p className={cn(
                                      "text-sm leading-6",
                                      index === 0 ? "text-slate-200" : "text-slate-600"
                                    )}>{section.content}</p>

                                    {/* Key points as compact pills */}
                                    {section.points && section.points.length > 0 && (
                                      <div className="flex flex-col gap-1.5 pt-1">
                                        {section.points.map((pt, pi) => (
                                          <div key={pi} className="flex items-start gap-2">
                                            <div className={cn(
                                              "w-1 h-1 rounded-full mt-2 shrink-0",
                                              index === 0 ? "bg-cyan-400" : "bg-slate-700"
                                            )} />
                                            <span className={cn(
                                              "text-xs leading-5",
                                              index === 0 ? "text-slate-400" : "text-slate-700"
                                            )}>{pt}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {/* Code Block — shown after sections if present */}
                              {item.code && (
                                <div className={cn(
                                  "rounded-xl border overflow-hidden",
                                  index === 0 ? "border-cyan-500/20" : "border-white/5"
                                )}>
                                  <div className="flex items-center justify-between px-4 py-2 bg-black/70 border-b border-white/5">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                      {item.codeLanguage || 'code'}
                                    </span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(item.code || '')}
                                      className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-wider font-bold"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <pre className="p-4 overflow-x-auto bg-black/80">
                                    <code className={cn(
                                      "text-[12px] font-mono leading-6",
                                      index === 0 ? "text-emerald-300" : "text-slate-700"
                                    )}>{item.code}</code>
                                  </pre>
                                </div>
                              )}

                              {/* Copy full answer */}
                              {index === 0 && sections.length > 0 && (
                                <button
                                  onClick={() => {
                                    const text = sections.map(s =>
                                      `## ${s.title}\n${s.content}${s.points?.length ? '\n' + s.points.map(p => `• ${p}`).join('\n') : ''}`
                                    ).join('\n\n') + (item.code ? `\n\n\`\`\`${item.codeLanguage}\n${item.code}\n\`\`\`` : '');
                                    navigator.clipboard.writeText(text);
                                  }}
                                  className="self-start text-[10px] text-slate-600 hover:text-cyan-400 transition-colors uppercase tracking-widest font-bold"
                                >
                                  Copy full answer
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : !isProcessing && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 opacity-50 py-10">
                          <MessageSquare size={28} />
                          <span className="text-xs font-medium text-center px-10 leading-relaxed">
                            Type a question to get a detailed, interview-ready answer with code examples
                          </span>
                        </div>
                      )}
                    </div>




                    {/* Chat Input */}
                    <div className="shrink-0 p-4 border-t border-white/5 bg-black/20 no-drag">
                      <div className="flex items-end gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 focus-within:border-cyan-500/50 transition-colors">
                        <textarea
                          ref={chatInputRef}
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onFocus={() => ipc?.send('chat-input-focused')}
                          onBlur={() => ipc?.send('chat-input-blurred')}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleChatSubmit();
                            }
                            // Esc to blur / re-enter click-through
                            if (e.key === 'Escape') {
                              ipc?.send('chat-input-blurred');
                              chatInputRef.current?.blur();
                            }
                          }}
                          placeholder="Ask anything... (Ctrl+Shift+Space to focus, Enter to send)"
                          rows={1}
                          className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 resize-none focus:outline-none leading-relaxed max-h-32 overflow-auto scrollbar-hide"
                          style={{ fieldSizing: 'content' } as React.CSSProperties}
                        />
                        <button
                          onClick={handleChatSubmit}
                          disabled={!chatInput.trim() || isProcessing}
                          className={cn(
                            "shrink-0 p-2 rounded-lg transition-all",
                            chatInput.trim() && !isProcessing
                              ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                              : "bg-white/5 text-slate-600 cursor-not-allowed"
                          )}
                        >
                          {isProcessing
                            ? <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            : <Send size={14} />}
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-700 mt-1.5 px-1">Persona: <span className="text-slate-500">{persona}</span></p>
                    </div>
                  </div>
                ) : (
                  /* Full Mode Content */
                  <>
                    {/* Transcript Area (Top Half) */}
                    <div className="flex-[0.6] flex flex-col overflow-hidden bg-black/20 border-b border-white/5 no-drag group/trans relative">
                      {/* Transcript Action Bar (Matches Parakeet) */}
                      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02]">
                         <div className="flex-1 overflow-hidden pr-4">
                            <div className="text-xs text-slate-300 font-medium truncate italic opacity-80">
                               {transcript || "Speak to start capturing..."}
                            </div>
                         </div>
                         <div className="flex items-center gap-1 shrink-0">
                            <button onClick={handleClear} className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors" title="Clear">
                               <Trash2 size={13} />
                            </button>
                            <button className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors">
                               <ChevronDown size={13} />
                            </button>
                            <button className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors">
                               <X size={13} />
                            </button>
                         </div>
                      </div>
                      
                      <div className="flex-1 p-4 overflow-y-auto text-sm text-slate-400 font-mono leading-relaxed bg-black/10">
                        {transcript ? (
                          <span>{transcript}</span>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-600 italic">
                             <Activity size={12} className={isListening ? "animate-pulse" : ""} />
                             Waiting for audio input...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Copilot Area (Bottom Half) - Parakeet Styled Answer UI */}
                    <div className="flex-1 p-5 overflow-y-auto no-drag bg-gradient-to-b from-[#111111] to-black scrollbar-hide">
                      {isProcessing && !answer && (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {transcript && (
                            <div className="flex items-start gap-2.5">
                               <MessageSquare size={16} className="text-white mt-0.5 shrink-0" />
                               <div className="text-[15px] font-bold text-white leading-snug">
                                  {transcript.slice(-120)}
                               </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2.5 text-slate-500 pl-6">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-[13px] font-medium italic">Loading...</span>
                          </div>
                        </div>
                      )}

                      {history.length > 0 ? (
                        <div className="flex flex-col gap-10">
                          {history.map((item, index) => (
                            <div key={item.id} className={cn(
                              "flex flex-col gap-4 transition-all duration-500 relative pb-4",
                              index === 0 ? "opacity-100" : "opacity-30 hover:opacity-100 grayscale-[0.5] hover:grayscale-0"
                            )}>
                              {/* Question Section */}
                              <div className="flex items-start gap-2.5">
                                 <MessageSquare size={16} className="text-white mt-1 shrink-0" />
                                 <div className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
                                    Question: {item.question}
                                 </div>
                              </div>

                              {/* Answer Section */}
                              <div className="flex flex-col gap-3">
                                 <div className="flex items-center gap-2">
                                    <Star size={16} className="text-amber-400 fill-amber-400" />
                                    <span className="text-[14px] font-bold text-white">Answer:</span>
                                 </div>
                                 <div className="flex flex-col gap-2.5 pl-6">
                                    {item.answer.map((bullet, i) => (
                                      <div key={i} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full mt-2.5 shrink-0 bg-white" />
                                        <span className="text-[14px] leading-relaxed font-medium text-slate-200">
                                          {bullet}
                                        </span>
                                      </div>
                                    ))}
                                 </div>
                              </div>
                              
                              {/* Inline loading state for manual trigger */}
                              {index === 0 && isProcessing && (
                                <div className="flex items-center gap-2.5 text-slate-500 pl-6 mt-2">
                                  <Loader2 size={14} className="animate-spin" />
                                  <span className="text-[12px] font-medium italic">Loading...</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : !isProcessing && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 opacity-50 py-10">
                          <Activity size={24} className={isListening ? "animate-pulse" : ""} />
                          <span className="text-xs font-medium text-center px-10">
                            {isListening
                              ? `Listening for ${persona.toLowerCase()} context...`
                              : "Start listening to begin analysis"}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!isHidden && (
        <div className="absolute bottom-1 right-1 pointer-events-none text-slate-500 opacity-20 group-hover:opacity-100 transition-opacity">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="rotate-0 shadow-lg">
            <path d="M12 0L12 12L0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 6L12 12L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
