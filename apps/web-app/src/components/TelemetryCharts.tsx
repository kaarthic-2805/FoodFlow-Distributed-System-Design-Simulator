import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { Gauge, Zap, HardDrive, BarChart3 } from 'lucide-react';

interface TelemetryChartsProps {
  telemetry: any;
}

interface LatencyPoint {
  time: string;
  p50: number;
  p95: number;
  p99: number;
  rps: number;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ telemetry }) => {
  const [history, setHistory] = useState<LatencyPoint[]>([]);

  useEffect(() => {
    if (!telemetry) return;
    const nowStr = new Date().toLocaleTimeString().split(' ')[0];
    const newPoint: LatencyPoint = {
      time: nowStr,
      p50: telemetry.p50 || 0,
      p95: telemetry.p95 || 0,
      p99: telemetry.p99 || 0,
      rps: telemetry.rps || 0
    };

    setHistory((prev) => [...prev.slice(-20), newPoint]);
  }, [telemetry]);

  const lbData = Object.entries(telemetry?.lbDistribution || {}).map(([instance, count]) => ({
    instance,
    count
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: p50 / p95 / p99 Latency */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gauge className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">System Latency (p50 / p95 / p99)</h3>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-emerald-400">p50: {telemetry?.p50 || 0}ms</span>
            <span className="text-amber-400">p95: {telemetry?.p95 || 0}ms</span>
            <span className="text-rose-400">p99: {telemetry?.p99 || 0}ms</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="p95Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="p99Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#64748B" fontSize={10} />
              <YAxis stroke="#64748B" fontSize={10} unit="ms" />
              <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="p50" stroke="#10B981" fillOpacity={1} fill="url(#p50Grad)" name="p50 Latency" />
              <Area type="monotone" dataKey="p95" stroke="#F59E0B" fillOpacity={1} fill="url(#p95Grad)" name="p95 Latency" />
              <Area type="monotone" dataKey="p99" stroke="#EF4444" fillOpacity={1} fill="url(#p99Grad)" name="p99 Latency" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Throughput (RPS) & Redis Cache Split */}
      <div className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">System Throughput & Redis Hit Ratio</h3>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold text-white font-mono">{telemetry?.rps || 0} req/s</div>
              <div className="text-xs text-slate-400">Current Load</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">Redis Cache Hit Ratio</span>
              <span className="text-emerald-400 font-bold">{telemetry?.cacheHitRatio || 100}%</span>
            </div>

            {/* Visual Cache Bar */}
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-white/5">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${telemetry?.cacheHitRatio || 100}%` }}
                title={`Cache Hits: ${telemetry?.cacheHits || 0}`}
              />
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${100 - (telemetry?.cacheHitRatio || 100)}%` }}
                title={`Cache Misses: ${telemetry?.cacheMisses || 0}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Hits: {telemetry?.cacheHits || 0}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Misses (MySQL): {telemetry?.cacheMisses || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Load Balancer Histogram */}
        <div className="pt-4 border-t border-white/10 space-y-2">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-200">Load Balancer Request Distribution</h4>
          </div>
          <div className="h-28 w-full">
            {lbData.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">Generating traffic to view LB distribution...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lbData}>
                  <XAxis dataKey="instance" stroke="#64748B" fontSize={10} />
                  <YAxis stroke="#64748B" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} name="Requests Handled" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
