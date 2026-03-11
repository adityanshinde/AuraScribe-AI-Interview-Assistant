import React, { useState, useEffect } from 'react';
import { Mic, X, Settings, Sparkles, Zap, Activity, ChevronRight } from 'lucide-react';
import { useTabAudioCapture } from '../hooks/useTabAudioCapture';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function OverlayWidget() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [voiceModel, setVoiceModel] = useState('whisper-large-v3-turbo');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  
  const { detectedQuestion, answer, isProcessing, processTranscript } = useAIAssistant();
  const { isListening, transcript, startListening, stopListening } = useTabAudioCapture(processTranscript);

  useEffect(() => {
    const savedKey = localStorage.getItem('groq_api_key');
    const savedVoiceModel = localStorage.getItem('groq_voice_model');
    const savedModel = localStorage.getItem('groq_model');
    
    if (savedKey) setApiKey(savedKey);
    if (savedVoiceModel) setVoiceModel(savedVoiceModel);
    if (savedModel) setModel(savedModel);
  }, []);

  const saveSettings = () => {
    localStorage.setItem('groq_api_key', apiKey);
    localStorage.setItem('groq_voice_model', voiceModel);
    localStorage.setItem('groq_model', model);
    setShowSettings(false);
  };

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="h-full w-full p-2 flex flex-col font-sans relative group">
      {/* Main Widget Container */}
      <div className="flex-1 bg-[#0a0a0a]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-slate-200 relative">
        
        {/* Header (Draggable via Electron) */}
        <div className="drag-region h-12 flex items-center justify-between px-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-white/90">Parakeet</span>
          </div>
          <div className="flex gap-3 no-drag items-center">
            <Settings 
              size={14} 
              className={cn("cursor-pointer transition-colors", showSettings ? "text-cyan-400" : "text-slate-400 hover:text-white")} 
              onClick={() => setShowSettings(!showSettings)} 
            />
            <X size={16} className="text-slate-400 hover:text-white cursor-pointer transition-colors" onClick={() => window.close()} />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Settings Overlay */}
          {showSettings ? (
            <div className="absolute inset-0 z-50 bg-[#0a0a0a] flex flex-col no-drag">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-bold text-white tracking-wide">Configuration</h2>
              </div>
              
              <div className="p-5 flex flex-col gap-5 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-400">Groq API Key</label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_..."
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <p className="text-[10px] text-slate-500">Get your free API key from console.groq.com</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-400">Voice Model (Transcription)</label>
                  <select 
                    value={voiceModel}
                    onChange={(e) => setVoiceModel(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                  >
                    <option value="whisper-large-v3-turbo">Whisper Large V3 Turbo (Fastest)</option>
                    <option value="whisper-large-v3">Whisper Large V3 (Most Accurate)</option>
                    <option value="distil-whisper-large-v3-en">Distil Whisper (English Only)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-400">Text Model (AI Copilot)</label>
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                    <option value="gemma2-9b-it">Gemma 2 9B</option>
                  </select>
                </div>

                <button 
                  onClick={saveSettings}
                  className="mt-4 bg-white text-black hover:bg-slate-200 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Status Bar */}
              <div className="px-5 py-3 border-b border-white/5 bg-black/20 flex justify-between items-center no-drag shrink-0">
                <div className="flex items-center gap-3">
                  {isListening ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-slate-600" />
                  )}
                  <span className="text-xs font-medium text-slate-400">
                    {isListening ? 'Listening to System Audio...' : 'Ready to start'}
                  </span>
                </div>
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

              {/* Transcript Area (Top Half) */}
              <div className="flex-[0.8] p-5 flex flex-col gap-3 overflow-hidden border-b border-white/5 no-drag bg-white/[0.01]">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Mic size={10} /> Live Transcript
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
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                  <Zap size={10} /> AI Copilot
                  {isProcessing && <span className="animate-pulse text-cyan-300/70 normal-case tracking-normal ml-1">Thinking...</span>}
                </div>
                
                {detectedQuestion ? (
                  <div className="flex flex-col gap-4">
                    <div className="text-sm font-medium text-white leading-snug border-l-2 border-cyan-500 pl-3">
                      "{detectedQuestion.question}"
                    </div>
                    
                    {answer ? (
                      <div className="flex flex-col gap-2.5">
                        {answer.bullets.map((bullet, i) => (
                          <div key={i} className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 hover:bg-white/[0.05] transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                            <span className="text-sm text-slate-200 leading-relaxed">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-xs text-cyan-400/70 mt-2">
                        <div className="h-3.5 w-3.5 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                        Generating optimal response...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 opacity-50">
                    <Activity size={24} className={isListening ? "animate-pulse" : ""} />
                    <span className="text-xs font-medium">Listening for interview questions...</span>
                  </div>
                )}
              </div>
            </>
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
