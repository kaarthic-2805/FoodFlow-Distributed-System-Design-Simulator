import React from 'react';
import { Server, Database, HardDrive, Layers, Activity, Cpu, ShieldAlert } from 'lucide-react';

interface ArchitectureMapProps {
  telemetry: any;
  chaosConfig: any;
  onSelectNode: (nodeId: string) => void;
}

export const ArchitectureMap: React.FC<ArchitectureMapProps> = ({
  telemetry,
  chaosConfig,
  onSelectNode
}) => {
  const getNodeStatus = (nodeId: string) => {
    if (chaosConfig?.serviceDown?.[nodeId]) return 'DOWN';
    if (nodeId === 'redis' && chaosConfig?.redisDown) return 'DOWN';
    if (chaosConfig?.serviceDelayMs?.[nodeId] > 0) return 'DEGRADED';
    return 'HEALTHY';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DOWN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">DOWN</span>;
      case 'DEGRADED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">DEGRADED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HEALTHY</span>;
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Live Topology & Traffic Flow Map</span>
          </h2>
          <p className="text-xs text-slate-400">Sub-second state of microservices, event streams, and caches</p>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Active Packet Flow</span>
          </div>
        </div>
      </div>

      {/* SVG Topology Nodes Grid */}
      <div className="relative p-6 bg-slate-950/60 rounded-xl border border-white/5 space-y-8 overflow-x-auto">
        {/* Layer 1: API Gateway */}
        <div className="flex justify-center">
          <div
            onClick={() => onSelectNode('api-gateway')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-indigo-500/40 hover:border-indigo-400 transition-all w-72 shadow-xl hover:shadow-indigo-500/10 group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-sm text-white group-hover:text-indigo-300">API Gateway</span>
              </div>
              {getStatusBadge('HEALTHY')}
            </div>
            <div className="text-xs text-slate-400 font-mono space-y-0.5">
              <div>Routing & Rate Limiting</div>
              <div className="text-indigo-300">Round-Robin Load Balancer</div>
            </div>
          </div>
        </div>

        {/* Dynamic Connector SVG Lines */}
        <div className="flex justify-center">
          <svg className="w-full max-w-2xl h-10 stroke-indigo-500/40" fill="none">
            <line x1="50%" y1="0" x2="20%" y2="100%" strokeWidth="2" className="animate-flow" />
            <line x1="50%" y1="0" x2="50%" y2="100%" strokeWidth="2" className="animate-flow" />
            <line x1="50%" y1="0" x2="80%" y2="100%" strokeWidth="2" className="animate-flow" />
          </svg>
        </div>

        {/* Layer 2: Core Microservices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Restaurant Services */}
          <div
            onClick={() => onSelectNode('restaurant-service')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">Restaurant Service</span>
              {getStatusBadge(getNodeStatus('restaurant-service-1'))}
            </div>
            <div className="text-[11px] text-slate-400 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Inst #1 (4001)</span>
                {getStatusBadge(getNodeStatus('restaurant-service-1'))}
              </div>
              <div className="flex justify-between">
                <span>Inst #2 (4002)</span>
                {getStatusBadge(getNodeStatus('restaurant-service-2'))}
              </div>
              <div className="text-emerald-400 pt-1">Pattern: Redis Cache-Aside</div>
            </div>
          </div>

          {/* Order Services */}
          <div
            onClick={() => onSelectNode('order-service')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">Order Service</span>
              {getStatusBadge(getNodeStatus('order-service-1'))}
            </div>
            <div className="text-[11px] text-slate-400 font-mono space-y-1">
              <div className="flex justify-between">
                <span>Inst #1 (4004)</span>
                {getStatusBadge(getNodeStatus('order-service-1'))}
              </div>
              <div className="flex justify-between">
                <span>Inst #2 (4005)</span>
                {getStatusBadge(getNodeStatus('order-service-2'))}
              </div>
              <div className="text-indigo-400 pt-1">Role: Kafka Event Producer</div>
            </div>
          </div>

          {/* User Service */}
          <div
            onClick={() => onSelectNode('user-service')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-white/10 hover:border-indigo-500/40 transition-all space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">User Service</span>
              {getStatusBadge(getNodeStatus('user-service-1'))}
            </div>
            <div className="text-[11px] text-slate-400 font-mono space-y-1">
              <div>Port 4003</div>
              <div className="text-slate-400">JWT Auth & Profiles</div>
            </div>
          </div>
        </div>

        {/* Dynamic Connector SVG Lines */}
        <div className="flex justify-center">
          <svg className="w-full max-w-2xl h-10 stroke-indigo-500/40" fill="none">
            <line x1="20%" y1="0" x2="20%" y2="100%" strokeWidth="2" className="animate-flow" />
            <line x1="50%" y1="0" x2="50%" y2="100%" strokeWidth="2" className="animate-flow" />
            <line x1="80%" y1="0" x2="80%" y2="100%" strokeWidth="2" className="animate-flow" />
          </svg>
        </div>

        {/* Layer 3: Persistence & Event Stream */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Redis Cache */}
          <div
            onClick={() => onSelectNode('redis')}
            className={`cursor-pointer p-4 rounded-xl bg-slate-900 border transition-all ${
              getNodeStatus('redis') === 'DOWN' ? 'border-rose-500/50 bg-rose-950/20' : 'border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Redis Cache</span>
              </div>
              {getStatusBadge(getNodeStatus('redis'))}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              <div>Port 6379 (ioredis)</div>
              <div>Menu Cache + Rate Limit</div>
            </div>
          </div>

          {/* Kafka Broker */}
          <div
            onClick={() => onSelectNode('kafka')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-indigo-500/30 hover:border-indigo-400 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-xs text-white">Kafka Broker</span>
              </div>
              {getStatusBadge('HEALTHY')}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              <div>Topic: foodflow.orders</div>
              <div>Partitions: 3</div>
            </div>
          </div>

          {/* MySQL Database */}
          <div
            onClick={() => onSelectNode('mysql')}
            className="cursor-pointer p-4 rounded-xl bg-slate-900 border border-blue-500/30 hover:border-blue-400 transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-xs text-white">MySQL DB</span>
              </div>
              {getStatusBadge('HEALTHY')}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              <div>Port 3306 (Prisma)</div>
              <div>Normalized SSOT</div>
            </div>
          </div>
        </div>

        {/* Connector to Workers */}
        <div className="flex justify-center">
          <svg className="w-full max-w-2xl h-10 stroke-indigo-500/40" fill="none">
            <line x1="50%" y1="0" x2="50%" y2="100%" strokeWidth="2" className="animate-flow" />
          </svg>
        </div>

        {/* Layer 4: Kafka Async Workers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-[11px] font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-200">Payment Worker</span>
              {getStatusBadge(getNodeStatus('payment-worker'))}
            </div>
            <div className="text-slate-500">Group: payment-group</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-[11px] font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-200">Kitchen Worker</span>
              {getStatusBadge(getNodeStatus('kitchen-worker'))}
            </div>
            <div className="text-slate-500">Group: kitchen-group</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-[11px] font-mono space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-200">Delivery Worker</span>
              {getStatusBadge(getNodeStatus('delivery-worker'))}
            </div>
            <div className="text-slate-500">Group: delivery-group</div>
          </div>
        </div>
      </div>
    </div>
  );
};
