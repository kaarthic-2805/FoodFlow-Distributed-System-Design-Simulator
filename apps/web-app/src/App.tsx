import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FoodApp } from './components/FoodApp';
import { ControlRoom } from './components/ControlRoom';
import { OrderTrackerModal } from './components/OrderTrackerModal';

const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:4000';
const CONTROL_WS_URL = import.meta.env.VITE_CONTROL_WS_URL || 'ws://localhost:4010';

export function App() {
  const [activeTab, setActiveTab] = useState<'app' | 'dashboard'>('app');
  const [isConnected, setIsConnected] = useState(false);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [kafkaData, setKafkaData] = useState<any>(null);
  const [chaosConfig, setChaosConfig] = useState<any>({});
  
  // Active Order Tracker State
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderStatus, setActiveOrderStatus] = useState<string>('CREATED');
  const [activeCourierId, setActiveCourierId] = useState<string | undefined>(undefined);
  const [activeFailureReason, setActiveFailureReason] = useState<string | undefined>(undefined);

  // Poll Order Status when Tracker Modal is open
  useEffect(() => {
    if (!activeOrderId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_GATEWAY_URL}/api/orders/${activeOrderId}`);
        const json = await res.json();
        if (json.data) {
          setActiveOrderStatus(json.data.status);
          if (json.data.courierId) setActiveCourierId(json.data.courierId);
          if (json.data.failureReason) setActiveFailureReason(json.data.failureReason);

          if (['DELIVERY_COMPLETED', 'PAYMENT_FAILED', 'CANCELLED'].includes(json.data.status)) {
            clearInterval(interval);
          }
        }
      } catch (e) {}
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrderId]);

  // Connect WebSocket to Control Service
  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(CONTROL_WS_URL);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYSTEM_TELEMETRY') {
              setTelemetryData(data.payload.telemetry);
              setKafkaData(data.payload.kafka);
              setChaosConfig(data.payload.telemetry?.chaosConfig || {});
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setIsConnected(false);
          setTimeout(connect, 3000); // Reconnect loop
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch (e) {
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const fetchChaosStatus = async () => {
    try {
      const res = await fetch(`${API_GATEWAY_URL}/api/control/chaos/status`);
      const json = await res.json();
      setChaosConfig(json);
    } catch (e) {}
  };

  const handleChaosToggle = (update: any) => {
    setChaosConfig((prev: any) => {
      const next = {
        ...prev,
        ...update,
        kafkaConsumerPause: {
          ...(prev?.kafkaConsumerPause || {}),
          ...(update?.kafkaConsumerPause || {})
        }
      };

      fetch(`${API_GATEWAY_URL}/api/control/chaos/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      }).catch(() => {});

      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isConnected={isConnected}
        chaosModeActive={chaosConfig?.chaosModeActive || false}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'app' ? (
          <FoodApp
            apiGatewayUrl={API_GATEWAY_URL}
            onOrderPlaced={(orderId) => {
              setActiveOrderId(orderId);
              setActiveOrderStatus('CREATED');
              setActiveCourierId(undefined);
              setActiveFailureReason(undefined);
            }}
          />
        ) : (
          <ControlRoom
            telemetryData={telemetryData}
            kafkaData={kafkaData}
            chaosConfig={chaosConfig}
            apiGatewayUrl={API_GATEWAY_URL}
            onRefreshChaos={fetchChaosStatus}
            onChaosToggle={handleChaosToggle}
          />
        )}
      </main>

      {/* Order Tracker Modal */}
      {activeOrderId && (
        <OrderTrackerModal
          orderId={activeOrderId}
          orderStatus={activeOrderStatus}
          courierId={activeCourierId}
          failureReason={activeFailureReason}
          onClose={() => setActiveOrderId(null)}
        />
      )}
    </div>
  );
}

export default App;
