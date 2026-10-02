import React from 'react';
import { CheckCircle2, Clock, X, AlertTriangle, Truck, ChefHat, CreditCard, PackageCheck } from 'lucide-react';

interface OrderTrackerModalProps {
  orderId: string;
  orderStatus: string;
  courierId?: string;
  failureReason?: string;
  onClose: () => void;
}

const STAGES = [
  { key: 'CREATED', label: 'Order Created', icon: PackageCheck, desc: 'Emitted to foodflow.orders' },
  { key: 'PAYMENT_SUCCESS', label: 'Payment Processed', icon: CreditCard, desc: 'Consumed by payment-group' },
  { key: 'KITCHEN_PREPARING', label: 'Preparing in Kitchen', icon: ChefHat, desc: 'Consumed by kitchen-group' },
  { key: 'KITCHEN_READY', label: 'Food Ready for Pickup', icon: ChefHat, desc: 'Kitchen prep finished' },
  { key: 'DELIVERY_ASSIGNED', label: 'Courier Assigned', icon: Truck, desc: 'Consumed by delivery-group' },
  { key: 'DELIVERY_COMPLETED', label: 'Delivered!', icon: CheckCircle2, desc: 'Order Lifecycle Complete' }
];

export const OrderTrackerModal: React.FC<OrderTrackerModalProps> = ({
  orderId,
  orderStatus,
  courierId,
  failureReason,
  onClose
}) => {
  const getStageIndex = (status: string) => {
    switch (status) {
      case 'CREATED': return 0;
      case 'PAYMENT_PENDING': return 0;
      case 'PAYMENT_SUCCESS': return 1;
      case 'KITCHEN_PREPARING': return 2;
      case 'KITCHEN_READY': return 3;
      case 'DELIVERY_ASSIGNED': return 4;
      case 'DELIVERY_IN_TRANSIT': return 4;
      case 'DELIVERY_COMPLETED': return 5;
      default: return 0;
    }
  };

  const currentIdx = getStageIndex(orderStatus);
  const isFailed = orderStatus === 'PAYMENT_FAILED' || orderStatus === 'CANCELLED';
  const isCompleted = orderStatus === 'DELIVERY_COMPLETED';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 space-y-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live Kafka Order Stream
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Order #{orderId.slice(0, 8)}</h2>
          <p className="text-xs text-slate-400 font-mono">Current State: {orderStatus}</p>
        </div>

        {isCompleted && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Order Delivered Successfully!</span>
            </div>
            <p className="text-xs text-emerald-400/80">Your order has arrived and the order lifecycle is complete.</p>
          </div>
        )}

        {isFailed ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Order Execution Failed</span>
            </div>
            <p className="text-xs text-rose-300">{failureReason || 'Payment declined or order cancelled.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {STAGES.map((stage, idx) => {
              const isDone = isCompleted ? true : idx < currentIdx;
              const isCurrent = isCompleted ? false : idx === currentIdx;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex items-start space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                      isDone
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : isCurrent
                        ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse shadow-lg shadow-indigo-500/30'
                        : 'bg-slate-900 border-white/10 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 pb-2">
                    <div className={`text-sm font-semibold ${isCurrent ? 'text-white font-bold' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>
                      {stage.label}
                    </div>
                    <div className="text-xs text-slate-400">{stage.desc}</div>
                    {stage.key === 'DELIVERY_ASSIGNED' && courierId && (isDone || isCurrent) && (
                      <div className="text-xs font-mono text-indigo-400 mt-0.5">Assigned to: {courierId}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-white/10 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
