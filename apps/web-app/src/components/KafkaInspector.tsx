import React from 'react';
import { Layers, ArrowRight, PauseCircle, PlayCircle, Clock } from 'lucide-react';

interface KafkaInspectorProps {
  kafkaData: any;
  chaosConfig: any;
  onToggleConsumerPause: (groupId: string, pause: boolean) => void;
}

export const KafkaInspector: React.FC<KafkaInspectorProps> = ({
  kafkaData,
  chaosConfig,
  onToggleConsumerPause
}) => {
  const topics = kafkaData?.topics || {};
  const consumerGroups = ['payment-group', 'kitchen-group', 'delivery-group'];

  return (
    <div className="glass-panel p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-base font-bold text-white">Kafka Event Stream & Consumer Group Lag</h3>
            <p className="text-xs text-slate-400">Partition offsets and async consumer group processing</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
          Broker: localhost:9094
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Topics & Partitions Inspector */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Active Kafka Topics</h4>
          <div className="space-y-3">
            {Object.keys(topics).length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-500">
                Connected to Kafka Broker. Waiting for topic metrics...
              </div>
            ) : (
              Object.entries(topics).map(([topicName, details]: [string, any]) => (
                <div key={topicName} className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-300">{topicName}</span>
                    <span className="text-slate-400">{details.partitions} Partitions</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    {details.offsets?.map((p: any) => (
                      <div key={p.partition} className="p-2 rounded bg-slate-950 border border-white/5 text-center">
                        <div className="text-[10px] text-slate-500">Partition #{p.partition}</div>
                        <div className="text-xs font-bold text-white mt-0.5">Offset: {p.offset || p.high || 0}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Consumer Groups & Lag Inspector */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Consumer Groups & Lag</h4>
          <div className="space-y-3">
            {consumerGroups.map((group) => {
              const isPaused = chaosConfig?.kafkaConsumerPause?.[group] || false;
              const lag = chaosConfig?.workerLagMs?.[group.replace('-group', '-worker')] || 0;

              return (
                <div key={group} className="p-4 rounded-xl bg-slate-900/80 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{group}</div>
                      <div className="text-[11px] text-slate-400">
                        Worker Lag: <span className={lag > 0 ? 'text-amber-400 font-bold' : 'text-slate-300'}>{lag}ms</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleConsumerPause(group, !isPaused);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                        isPaused
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                          : 'bg-slate-800 text-slate-300 border border-white/10 hover:bg-slate-700'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Resume Group</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>Pause Group</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isPaused && (
                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 font-mono flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Consumer Group PAUSED (Messages accumulating in Kafka partition)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
