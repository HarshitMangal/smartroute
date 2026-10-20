// SimulationBar.jsx
// Controls real-time vehicle dispatch & WebSocket telematics
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = 'http://localhost:5000';

export default function SimulationBar({
  routes,             // Array of { vehicleId, stops, color }
  nodeLabels,
  positions,          // Array of [lat, lng] for all nodes
  onTelemetryUpdate,  // Callback to update vehicle markers on map
  onStopDelivered,    // Callback when a stop is delivered
}) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [telemetry, setTelemetry] = useState([]);
  const [statusText, setStatusText] = useState('Ready to dispatch fleet');

  // Initialize Socket.io client
  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 5,
      timeout: 3000,
    });

    s.on('connect', () => {
      setIsConnected(true);
      console.log('📡 Connected to Live Telematics WebSocket server');
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('fleet_telemetry', data => {
      if (data && data.vehicles) {
        setTelemetry(data.vehicles);
        if (onTelemetryUpdate) onTelemetryUpdate(data.vehicles);
      }
    });

    s.on('delivery_milestone', milestone => {
      setStatusText(`📦 Van #${milestone.vehicleId} delivered at ${milestone.stopName}`);
      if (onStopDelivered) onStopDelivered(milestone);
    });

    s.on('simulation_completed', () => {
      setIsPlaying(false);
      setStatusText('🎉 All deliveries completed successfully!');
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Node #${id}`;
  }

  // Convert routes into waypoints for socket or local ticker
  function getPreparedRoutes() {
    if (!routes || routes.length === 0) return [];

    return routes.map(r => {
      const waypoints = (r.stops || []).map(nodeId => positions[nodeId]).filter(Boolean);
      const stopNames = (r.stops || []).map(nodeId => getNodeName(nodeId));
      return {
        vehicleId: r.vehicleId || 1,
        waypoints,
        stopNames,
      };
    });
  }

  function handleStart() {
    const preparedRoutes = getPreparedRoutes();
    if (preparedRoutes.length === 0) return;

    setIsPlaying(true);
    setStatusText('🚚 Fleet in transit — live telemetry streaming...');

    if (socket && isConnected) {
      socket.emit('start_simulation', {
        routes: preparedRoutes,
        speed: speed,
      });
    } else {
      // Local fallback ticker if socket is disconnected
      runLocalSimulation(preparedRoutes);
    }
  }

  function handlePause() {
    setIsPlaying(false);
    setStatusText('⏸ Simulation paused');
    if (socket && isConnected) {
      socket.emit('pause_simulation');
    }
  }

  function handleReset() {
    setIsPlaying(false);
    setStatusText('Ready to dispatch fleet');
    setTelemetry([]);
    if (onTelemetryUpdate) onTelemetryUpdate([]);
    if (socket && isConnected) {
      socket.emit('reset_simulation');
    }
  }

  // Fallback in-memory simulation loop in case of offline/network issues
  function runLocalSimulation(preparedRoutes) {
    let vehicles = preparedRoutes.map(r => ({
      vehicleId: r.vehicleId,
      waypoints: r.waypoints,
      stopNames: r.stopNames,
      currentSegment: 0,
      segmentProgress: 0.0,
      currentCoords: r.waypoints[0] || [26.2389, 73.0243],
      isCompleted: false,
      deliveredStops: [0],
      currentSpeedKmH: 32,
    }));

    const interval = setInterval(() => {
      let allDone = true;
      vehicles.forEach(v => {
        if (v.isCompleted || v.waypoints.length < 2) return;
        allDone = false;
        v.segmentProgress += 0.03 * speed;

        const p1 = v.waypoints[v.currentSegment];
        const p2 = v.waypoints[v.currentSegment + 1];
        if (p1 && p2) {
          const lat = p1[0] + (p2[0] - p1[0]) * v.segmentProgress;
          const lng = p1[1] + (p2[1] - p1[1]) * v.segmentProgress;
          v.currentCoords = [lat, lng];

          if (v.segmentProgress >= 1.0) {
            v.segmentProgress = 0.0;
            v.currentSegment++;
            v.deliveredStops.push(v.currentSegment);
            if (v.currentSegment >= v.waypoints.length - 1) {
              v.isCompleted = true;
            }
          }
        }
      });

      const telem = vehicles.map(v => ({
        vehicleId: v.vehicleId,
        currentCoords: v.currentCoords,
        currentSegment: v.currentSegment,
        isCompleted: v.isCompleted,
        deliveredStops: v.deliveredStops,
        currentSpeedKmH: v.currentSpeedKmH,
        nextStopName: v.stopNames[v.currentSegment + 1] || 'Completed',
      }));

      setTelemetry(telem);
      if (onTelemetryUpdate) onTelemetryUpdate(telem);

      if (allDone) {
        clearInterval(interval);
        setIsPlaying(false);
        setStatusText('🎉 All deliveries completed!');
      }
    }, 100);
  }

  if (!routes || routes.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #38bdf8',
      borderRadius: '12px',
      padding: '0.75rem 1rem',
      margin: '0.5rem 0',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    }}>
      {/* Top row: controls + live status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>📡</span>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Live Fleet Tracking</span>
              <span style={{
                background: isConnected ? '#064e3b' : '#334155',
                color: isConnected ? '#34d399' : '#94a3b8',
                fontSize: '0.62rem',
                fontWeight: 600,
                padding: '0.1rem 0.4rem',
                borderRadius: '999px',
                border: `1px solid ${isConnected ? '#059669' : '#475569'}`,
              }}>
                {isConnected ? '● WebSocket Online' : '○ Standalone'}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {statusText}
            </div>
          </div>
        </div>

        {/* Buttons & Speed controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {!isPlaying ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleStart}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
            >
              ▶ Start Live Run
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePause}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
            >
              ⏸ Pause
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
          >
            ⏹ Reset
          </button>

          {/* Speed switcher */}
          <div style={{ display: 'flex', background: '#1e293b', borderRadius: '6px', padding: '0.15rem' }}>
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                style={{
                  background: speed === s ? '#0284c7' : 'transparent',
                  color: speed === s ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.15rem 0.4rem',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live Telemetry Chips per vehicle */}
      {telemetry.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
          {telemetry.map(v => (
            <div
              key={v.vehicleId}
              style={{
                flex: '1 1 180px',
                background: '#090d16',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.72rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                  🚚 Van #{v.vehicleId}
                </span>
                <span style={{ color: '#94a3b8', marginLeft: '0.4rem' }}>
                  {v.isCompleted ? '✅ Delivered' : `→ ${v.nextStopName}`}
                </span>
              </div>
              <div style={{ color: '#22c55e', fontWeight: 600 }}>
                {v.isCompleted ? 'Done' : `${v.currentSpeedKmH} km/h`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
