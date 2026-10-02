import React, { useState } from 'react';
import { Play, Zap, Flame, RotateCcw } from 'lucide-react';

interface TrafficGeneratorProps {
  apiGatewayUrl: string;
}

export const TrafficGenerator: React.FC<TrafficGeneratorProps> = ({ apiGatewayUrl }) => {
  const [rps, setRps] = useState(10);
  const [durationSec, setDurationSec] = useState(15);
  const [targetService, setTargetService] = useState<'orders' | 'restaurants'>('orders');
  const [statusMessage, setStatusMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const startTraffic = async (customRps?: number, customDuration?: number) => {
    setIsGenerating(true);
    const targetRps = customRps || rps;
    const targetDur = customDuration || durationSec;

    try {
      const res = await fetch(`${apiGatewayUrl}/api/control/traffic/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rps: targetRps, durationSec: targetDur, targetService })
      });
      const json = await res.json();
      setStatusMessage(`Active: Generating ${targetRps} req/s to /${targetService} for ${targetDur}s`);
    } catch (e: any) {
      setStatusMessage(`Error starting load: ${e.message}`);
    } finally {
      setTimeout(() => setIsGenerating(false), targetDur * 1000);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">Synthetic Traffic Generator</h3>
        </div>
        {statusMessage && (
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {statusMessage}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* RPS Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">Throughput (Req / Sec)</span>
            <span className="text-indigo-400 font-mono">{rps} RPS</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={rps}
            onChange={(e) => setRps(Number(e.target.value))}
            className="w-full accent-indigo-500 bg-slate-900 rounded-lg cursor-pointer h-2"
          />
        </div>

        {/* Duration Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-300">Duration (Seconds)</span>
            <span className="text-indigo-400 font-mono">{durationSec} Sec</span>
          </div>
          <input
            type="range"
            min="5"
            max="60"
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
            className="w-full accent-indigo-500 bg-slate-900 rounded-lg cursor-pointer h-2"
          />
        </div>

        {/* Target Service Selection */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">Target Service</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTargetService('orders')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                targetService === 'orders'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Order Service
            </button>
            <button
              onClick={() => setTargetService('restaurants')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                targetService === 'restaurants'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Restaurant Service
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={() => startTraffic()}
          disabled={isGenerating}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          <span>Launch Traffic Test</span>
        </button>

        <button
          onClick={() => startTraffic(35, 10)}
          disabled={isGenerating}
          className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-xs flex items-center space-x-2 disabled:opacity-50"
        >
          <Flame className="w-4 h-4" />
          <span>Trigger 35 RPS Burst</span>
        </button>
      </div>
    </div>
  );
};
