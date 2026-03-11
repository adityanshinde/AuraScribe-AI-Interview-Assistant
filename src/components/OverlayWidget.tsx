import React, { useState, useEffect } from 'react';
import { Mic, X, Settings, Sparkles, Zap, Activity, ChevronRight, Minimize2, Maximize2, Pin, PinOff, History, Download, Eye, EyeOff, Keyboard } from 'lucide-react';
import { useTabAudioCapture } from '../hooks/useTabAudioCapture';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { Visualizer } from './Visualizer';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Electron IPC helper
const ipc = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface HistoryItem {
  id: string;
  question: string;
  answer: string[];
  timestamp: number;
}

export default function OverlayWidget() {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);
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
  
  const { detectedQuestion, answer, isProcessing, processTranscript, resetAssistant } = useAIAssistant();
  const { isListening, isRateLimited, transcript, startListening, stopListening, clearTranscript, stream } = useTabAudioCapture(processTranscript);

  // Save to history when a new answer is complete
  useEffect(() => {
    if (detectedQuestion && answer) {
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        question: detectedQuestion.question,
        answer: answer.bullets,
        timestamp: Date.now()
      };
      
      setHistory(prev => {
        // Avoid duplicate entries for the same question
        if (prev.length > 0 && prev[0].question === newItem.question) return prev;
        return [newItem, ...prev].slice(0, 50); // Keep last 50 items
      });
      
      // Clear transcript after detection
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
  }, []);

  useEffect(() => {
    if (showSettings) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const outputs = devices.filter(device => device.kind === 'audiooutput');
        setAudioDevices(outputs);
      });
    }
  }, [showSettings]);

  // Add to history when answer is received
  useEffect(() => {
    if (detectedQuestion && answer) {
      const newItem: HistoryItem = {
        id: Math.random().toString(36).substring(7),
        question: detectedQuestion.question,
        answer: answer.bullets,
        timestamp: Date.now()
      };
      setHistory(prev => [newItem, ...prev].slice(0, 50)); // Keep last 50
    }
  }, [detectedQuestion, answer]);

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

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleAlwaysOnTop = () => {
    const newState = !isAlwaysOnTop;
    setIsAlwaysOnTop(newState);
    if (ipc) {
      ipc.send('set-always-on-top', newState);
    }
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
        "p-2 flex flex-col font-sans relative group transition-all duration-300 ease-in-out",
        isMiniMode ? "h-[180px] w-[350px]" : "h-full w-full"
      )}
      style={{ opacity: opacity / 100 }}
    >
      {/* Main Widget Container */}
      <div className="flex-1 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-slate-200 relative">
        
        {/* Header (Draggable via Electron) */}
        <div className="drag-region h-12 flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-white/90">AuraScribe</span>
          </div>
          <div className="flex gap-2 no-drag items-center">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              title="Session History"
              className={cn("p-1.5 hover:bg-white/5 rounded-md transition-colors", showHistory && "text-cyan-400")}
            >
              <History size={14} />
            </button>
            
            <button 
              onClick={toggleAlwaysOnTop}
              title={isAlwaysOnTop ? "Disable Always on Top" : "Enable Always on Top"}
              className="p-1.5 hover:bg-white/5 rounded-md transition-colors"
            >
              {isAlwaysOnTop ? <Pin size={14} className="text-cyan-400" /> : <PinOff size={14} className="text-slate-400" />}
            </button>

            <button 
              onClick={() => setIsMiniMode(!isMiniMode)}
              title={isMiniMode ? "Exit Mini Mode" : "Enter Mini Mode"}
              className="p-1.5 hover:bg-white/5 rounded-md transition-colors"
            >
              {isMiniMode ? <Maximize2 size={14} className="text-slate-400" /> : <Minimize2 size={14} className="text-slate-400" />}
            </button>

            <Settings 
              size={14} 
              className={cn("cursor-pointer transition-colors p-0.5", showSettings ? "text-cyan-400" : "text-slate-400 hover:text-white")} 
              onClick={() => setShowSettings(!showSettings)} 
            />
            <X size={16} className="text-slate-400 hover:text-white cursor-pointer transition-colors" onClick={() => window.close()} />
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

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-2"><Keyboard size={12} /> Global Hotkeys</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">Hide/Show</span>
                      <input 
                        value={hotkeys.toggleHide}
                        onChange={(e) => setHotkeys({...hotkeys, toggleHide: e.target.value})}
                        className="bg-black/50 border border-white/10 rounded-md px-2 py-1.5 text-[10px] text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">Click-Through</span>
                      <input 
                        value={hotkeys.toggleClickThrough}
                        onChange={(e) => setHotkeys({...hotkeys, toggleClickThrough: e.target.value})}
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
                  className="mt-2 bg-white text-black hover:bg-slate-200 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Status Bar */}
              <div className="px-5 py-3 border-b border-white/5 bg-black/20 flex justify-between items-center no-drag shrink-0">
                <div className="flex items-center gap-3">
                  {isRateLimited ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  ) : isListening ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-400">
                      {isRateLimited ? (
                        <span className="text-amber-400 animate-pulse">Rate Limited...</span>
                      ) : (
                        isListening ? 'Listening...' : 'Ready'
                      )}
                    </span>
                    <span className="text-[8px] text-slate-600 uppercase tracking-tighter">{persona}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleClear}
                    className="text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
                  >
                    Clear
                  </button>
                  <button
                    onClick={toggleListen}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300",
                      isListening
                        ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                        : "bg-white text-black hover:bg-slate-200 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                    )}
                  >
                    {isListening ? 'Stop' : 'Start'}
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
              ) : (
                /* Full Mode Content */
                <>
                  {/* Transcript Area (Top Half) */}
                  <div className="flex-[0.8] p-5 flex flex-col gap-3 overflow-hidden border-b border-white/5 no-drag bg-white/[0.01] relative">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                      <div className="flex items-center gap-2"><Mic size={10} /> Live Transcript</div>
                      {isListening && <div className="w-24 h-4"><Visualizer stream={stream} isListening={isListening} /></div>}
                    </div>
                    <div className="flex-1 overflow-y-auto text-sm text-slate-300 font-mono leading-relaxed pr-2 mask-fade-out">
                      {transcript ? (
                        <span>{transcript}</span>
                      ) : (
                        <span className="italic text-slate-600">Waiting for speech...</span>
                      )}
                    </div>
                  </div>

                  {/* AI Copilot Area (Bottom Half) */}
                  <div className="flex-[1.2] p-5 bg-gradient-to-b from-indigo-900/10 to-transparent flex flex-col gap-4 overflow-y-auto no-drag">
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Zap size={10} className={cn(isProcessing ? "text-cyan-400 animate-pulse" : "text-cyan-400")} /> 
                        AI Copilot
                        {isProcessing && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className="flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
                            </span>
                            <span className="animate-pulse text-cyan-300/70 text-[9px] font-medium normal-case tracking-normal">Aura is thinking...</span>
                          </div>
                        )}
                      </div>
                      {answer && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(answer.bullets.join('\n'))}
                          className="text-[9px] hover:text-white transition-colors"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                    
                    {history.length > 0 ? (
                      <div className="flex flex-col gap-6">
                        {history.map((item, index) => (
                          <div key={item.id} className={cn(
                            "flex flex-col gap-3 transition-all duration-500",
                            index === 0 ? "opacity-100 scale-100" : "opacity-60 scale-[0.98] hover:opacity-100"
                          )}>
                            <div className="text-sm font-medium text-white leading-snug border-l-2 border-cyan-500 pl-3">
                              "{item.question}"
                            </div>
                            
                            <div className="flex flex-col gap-2.5">
                              {item.answer.map((bullet, i) => (
                                <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 hover:bg-white/[0.05] transition-colors">
                                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                                  <span className="text-sm text-slate-200 leading-relaxed">{bullet}</span>
                                </div>
                              ))}
                            </div>
                            
                            <div className="text-[9px] text-slate-600 font-mono mt-1 flex justify-end">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            
                            {index < history.length - 1 && (
                              <div className="h-px bg-white/5 mt-2 w-full" />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : detectedQuestion ? (
                      <div className="flex flex-col gap-4">
                        <div className="text-sm font-medium text-white leading-snug border-l-2 border-cyan-500 pl-3">
                          "{detectedQuestion.question}"
                        </div>
                        <div className="flex items-center gap-3 text-xs text-cyan-400/70 mt-2">
                          <div className="h-3.5 w-3.5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                          Generating optimal response...
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 opacity-50">
                        <Activity size={24} className={isListening ? "animate-pulse" : ""} />
                        <span className="text-xs font-medium">Listening for {persona.toLowerCase()} context...</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle Indicator (Bottom Right) */}
      <div className="absolute bottom-3 right-3 pointer-events-none text-slate-500 opacity-30 group-hover:opacity-100 transition-opacity">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0L0 12H12V0Z" fill="currentColor"/>
        </svg>
      </div>
    </div>
  );
}
