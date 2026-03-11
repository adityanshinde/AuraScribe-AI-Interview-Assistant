/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OverlayWidget from './components/OverlayWidget';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center pt-20 p-4">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Parakeet AI Copilot</h1>
        <p className="text-lg text-slate-400 mb-6">
          Web-based prototype. No virtual audio cable required.
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-left shadow-xl">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <span className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">i</span>
            How to use Tab Audio Capture:
          </h2>
          <ol className="list-decimal list-inside text-slate-400 space-y-3">
            <li>Click <strong className="text-white">Start Session</strong> in the widget below.</li>
            <li>Your browser will ask you to choose what to share.</li>
            <li>Select the <strong className="text-white">Chrome Tab</strong> where your meeting/video is playing.</li>
            <li><strong className="text-red-400">CRITICAL:</strong> Toggle the <strong className="text-white">"Also share tab audio"</strong> switch ON at the bottom of the dialog!</li>
            <li>The AI will listen to the tab, transcribe it in chunks, and generate answers automatically.</li>
          </ol>
        </div>
      </div>
      <OverlayWidget />
    </div>
  );
}
