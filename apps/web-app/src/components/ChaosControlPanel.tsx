import React, { useState } from 'react';
import { ShieldAlert, Power, HardDrive, Clock, Radio, Activity } from 'lucide-react';

interface ChaosControlPanelProps {
  chaosConfig: any;
  apiGatewayUrl: string;
  onChaosUpdate: () => void;
}

export const ChaosControlPanel: React.FC<ChaosControlPanelProps> = ({
  chaosConfig,
  apiGatewayUrl,
  onChaosUpdate
}) => {
  const [redisDown, setRedisDown] = useState(chaosConfig?.redisDown || false);
  const [chaosModeActive, setChaosModeActive] = useState(chaosConfig?.chaosModeActive || false);
  const [serviceDelay, setServiceDelay] = useState(0);

  const toggleChaosSetting = async (update: any) => {
    try {
      await fetch(`${apiGatewayUrl}/api/control/chaos/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      onChaosUpdate();
    } catch (e) {
      console.error('Failed to update chaos state', e);
    }
  };

  const handleRedisToggle = () => {
    const nextState = !redisDown;
    setRedisDown(nextState);
    toggleChaosSetting({ redisDown: nextState });
  };

  const handleChaosModeToggle = () => {
    const nextState = !chaosModeActive;
    setChaosModeActive(nextState);
    toggleChaosSetting({ chaosModeActive: nextState });
  };

  const handleInstanceToggle = (instanceName: string) => {
    const currentDown = chaosConfig?.serviceDown?.[instanceName] || false;
    toggleChaosSetting({
      serviceDown: {
        ...(chaosConfig?.serviceDown || {}),
        [instanceName]: !currentDown
      }
    });
  };

  const handleWorkerLagChange = (workerName: string, lagMs: number) => {
    toggleChaosSetting({
      workerLagMs: {
        ...(chaosConfig?.workerLagMs || {}),
        [workerName]: lagMs
      }
    });
  };

  const handleServiceDelayChange = (serviceName: string, delayMs: number) => {
    setServiceDelay(delayMs);
    toggleChaosSetting({
      serviceDelayMs: {
        ...(chaosConfig?.serviceDelayMs || {}),
        [serviceName]: delayMs
      }
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6 border border-amber-500/20">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-white">Failure Injection & Chaos Engineering</h3>
            <p className="text-xs text-slate-400">Inject real process downtime, cache failures, and consumer lag</p>
          </div>
        </div>

        {/* Global Chaos Mode Toggle */}
        <button
          onClick={handleChaosModeToggle}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-bold flex items-center space-x-2 transition-all ${
            chaosModeActive
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 animate-pulse'
              : 'bg-slate-800 text-slate-400 hover:text-white border border-white/10'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>CHAOS MODE: {chaosModeActive ? 'ACTIVE' : 'OFF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Redis Cache Downtime */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-xs text-white">Redis Cache Access</span>
            </div>
            <button
              onClick={handleRedisToggle}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                redisDown
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {redisDown ? 'FORCE OFFLINE' : 'ONLINE'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {redisDown
              ? 'Redis blocked! System falling back to MySQL DB (Increased Latency & Cache Misses).'
              : 'Cache operating normally (Cache-Aside pattern active).'}
          </p>
        </div>

        {/* 2. Microservice Instance Kill Switch */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-3">
          <div className="flex items-center space-x-2">
            <Power className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-xs text-white">Kill Instance (Load Balancer Test)</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">restaurant-service-2 (4002)</span>
              <button
                onClick={() => handleInstanceToggle('restaurant-service-2')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  chaosConfig?.serviceDown?.['restaurant-service-2']
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {chaosConfig?.serviceDown?.['restaurant-service-2'] ? 'DEAD' : 'KILL'}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">order-service-2 (4005)</span>
              <button
                onClick={() => handleInstanceToggle('order-service-2')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  chaosConfig?.serviceDown?.['order-service-2']
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-slate-300 border border-white/10'
                }`}
              >
                {chaosConfig?.serviceDown?.['order-service-2'] ? 'DEAD' : 'KILL'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Artificial Latency Slider */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-white">Gateway Delay</span>
            </div>
            <span className="font-mono text-amber-400">{serviceDelay}ms</span>
          </div>
          <input
            type="range"
            min="0"
            max="3000"
            step="100"
            value={serviceDelay}
            onChange={(e) => handleServiceDelayChange('restaurant', Number(e.target.value))}
            className="w-full accent-amber-500 bg-slate-950 rounded-lg cursor-pointer h-2"
          />
          <p className="text-[11px] text-slate-400">Inject artificial network delay across HTTP proxy routing.</p>
        </div>
      </div>
    </div>
  );
};
