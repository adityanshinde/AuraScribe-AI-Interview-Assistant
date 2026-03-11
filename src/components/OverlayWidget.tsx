import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Mic, MicOff, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { useTabAudioCapture } from '../hooks/useTabAudioCapture';
import { useAIAssistant } from '../hooks/useAIAssistant';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function OverlayWidget() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [opacity, setOpacity] = useState(0.85);
  const [showSettings, setShowSettings] = useState(false);
  
  const { detectedQuestion, answer, isProcessing, processTranscript } = useAIAssistant();
  const { isListening, transcript, startListening, stopListening } = useTabAudioCapture(processTranscript);

  const toggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <motion.div 
      drag
      dragMomentum={false}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl transition-all",
        isExpanded ? "w-[400px]" : "w-[300px]",
        "bg-slate-900/90 text-white"
      )}
      style={{ opacity }}
      initial={{ top: 20, right: 20 }}
    >
      {/* Header / Drag Handle */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 cursor-move">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium tracking-wide">Parakeet AI Copilot</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="rounded-md p-1.5 hover:bg-white/10 transition-colors">
            <Settings className="h-4 w-4 text-slate-300" />
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="rounded-md p-1.5 hover:bg-white/10 transition-colors">
            {isExpanded ? <Minimize2 className="h-4 w-4 text-slate-300" /> : <Maximize2 className="h-4 w-4 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-white/10 bg-slate-800/50 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Opacity</label>
            <input 
              type="range" 
              min="0.2" max="1" step="0.05" 
              value={opacity} 
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">Audio Source</label>
            <div className="bg-slate-900 border border-white/10 rounded-md px-3 py-2 text-sm text-slate-300">
              Browser Tab Audio (Screen Share)
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              When you click Start, select the tab with your meeting and check "Also share tab audio".
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 p-4 gap-4 max-h-[600px] overflow-y-auto">
        
        {/* Controls */}
        <div className="flex items-center justify-between">
          <button 
            onClick={toggleListen}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              isListening 
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" 
                : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30"
            )}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? "Stop Session" : "Start Session"}
          </button>
          
          {isListening && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-xs font-medium text-slate-400">Live</span>
            </div>
          )}
        </div>

        {/* Transcript Area */}
        {isExpanded && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Transcript</h3>
            <div className="bg-black/20 rounded-xl p-3 min-h-[80px] max-h-[150px] overflow-y-auto border border-white/5 font-mono text-sm text-slate-300 leading-relaxed flex flex-col-reverse">
              {transcript ? (
                <span>{transcript}</span>
              ) : (
                <span className="text-slate-600 italic">Waiting for speech...</span>
              )}
            </div>
          </div>
        )}

        {/* AI Answer Area */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              AI Copilot
              {isProcessing && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full animate-pulse">Thinking...</span>}
            </h3>
          </div>
          
          {detectedQuestion ? (
            <div className="bg-indigo-950/40 rounded-xl p-4 border border-indigo-500/20 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <div className="bg-indigo-500/20 p-1.5 rounded-md mt-0.5">
                  <Settings className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-indigo-300 mb-1">Detected Question ({Math.round(detectedQuestion.confidence * 100)}%)</p>
                  <p className="text-sm font-medium text-white leading-snug">{detectedQuestion.question}</p>
                </div>
              </div>
              
              {answer ? (
                <div className="mt-2 space-y-3 border-t border-indigo-500/20 pt-3">
                  <div>
                    <p className="text-xs font-medium text-emerald-400 mb-1.5 uppercase tracking-wider">Key Points</p>
                    <ul className="space-y-1.5">
                      {answer.bullets.map((bullet, i) => (
                        <li key={i} className="text-sm text-slate-200 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span className="leading-snug">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {isExpanded && (
                    <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Suggested Response</p>
                      <p className="text-sm text-slate-300 italic leading-relaxed">"{answer.spoken}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 border-t border-indigo-500/20 pt-3 flex items-center gap-2 text-indigo-300 text-sm">
                  <div className="h-4 w-4 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
                  Generating perfect answer...
                </div>
              )}
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 text-center">
              <p className="text-sm text-slate-500">Listening for questions...</p>
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}
