import React, { useState } from 'react';
import { ArchitectureMap } from './ArchitectureMap';
import { TelemetryCharts } from './TelemetryCharts';
import { KafkaInspector } from './KafkaInspector';
import { TrafficGenerator } from './TrafficGenerator';
import { ChaosControlPanel } from './ChaosControlPanel';
import { Radio, Terminal, Cpu } from 'lucide-react';

interface ControlRoomProps {
  telemetryData: any;
  kafkaData: any;
  chaosConfig: any;
  apiGatewayUrl: string;
  onRefreshChaos: () => void;
  onChaosToggle?: (update: any) => void;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({
  telemetryData,
  kafkaData,
  chaosConfig,
  apiGatewayUrl,
  onRefreshChaos,
  onChaosToggle
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl space-y-1">
          <div className="text-xs font-mono text-slate-400">System Throughput</div>
          <div className="text-2xl font-extrabold text-white font-mono">{telemetryData?.rps || 0} req/s</div>
          <div className="text-[11px] text-emerald-400">Live API Traffic Rate</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-1">
          <div className="text-xs font-mono text-slate-400">p50 Latency</div>
          <div className="text-2xl font-extrabold text-white font-mono">{telemetryData?.p50 || 0} ms</div>
          <div className="text-[11px] text-indigo-400">Median Request Time</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-1">
          <div className="text-xs font-mono text-slate-400">Redis Cache Hit Ratio</div>
          <div className="text-2xl font-extrabold text-white font-mono">{telemetryData?.cacheHitRatio || 100}%</div>
          <div className="text-[11px] text-emerald-400">Cache-Aside Efficiency</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl space-y-1">
          <div className="text-xs font-mono text-slate-400">Active Microservices</div>
          <div className="text-2xl font-extrabold text-white font-mono">9 Containers</div>
          <div className="text-[11px] text-indigo-400">Docker Orchestrated</div>
        </div>
      </div>

      {/* Architecture Node Map */}
      <ArchitectureMap
        telemetry={telemetryData}
        chaosConfig={chaosConfig}
        onSelectNode={(nodeId) => setSelectedNode(nodeId)}
      />

      {/* Traffic Generator Controls */}
      <TrafficGenerator apiGatewayUrl={apiGatewayUrl} />

      {/* Failure Injection & Chaos Controls */}
      <ChaosControlPanel
        chaosConfig={chaosConfig}
        apiGatewayUrl={apiGatewayUrl}
        onChaosUpdate={onRefreshChaos}
      />

      {/* Telemetry Charts (p50/p95/p99 & Load Balancer distribution) */}
      <TelemetryCharts telemetry={telemetryData} />

      {/* Kafka Event Stream & Consumer Group Inspector */}
      <KafkaInspector
        kafkaData={kafkaData}
        chaosConfig={chaosConfig}
        onToggleConsumerPause={(group, pause) => {
          const updatedPauseMap = {
            ...(chaosConfig?.kafkaConsumerPause || {}),
            [group]: pause
          };
          if (onChaosToggle) {
            onChaosToggle({ kafkaConsumerPause: updatedPauseMap });
          } else {
            fetch(`${apiGatewayUrl}/api/control/chaos/toggle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ kafkaConsumerPause: updatedPauseMap })
            }).then(onRefreshChaos);
          }
        }}
      />
    </div>
  );
};
