// VrpPanel.jsx
// Multi-Vehicle Capacitated VRP Results Display
import { useState } from 'react';
import DriverManifestModal from './DriverManifestModal';

export const VEHICLE_COLORS = [
  '#38bdf8', // Van 1: Sky Blue
  '#f97316', // Van 2: Orange
  '#a855f7', // Van 3: Purple
  '#10b981', // Van 4: Emerald
];

export default function VrpPanel({ result, error, nodeLabels }) {
  if (error) {
    return (
      <div className="card">
        <div className="card-title">Fleet Optimization Error</div>
        <div className="result-box error">
          <span style={{ color: '#ef4444' }}>❌ {error}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card">
        <div className="card-title">Fleet Delivery (CVRP)</div>
        <div style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
          Select vehicle count and capacity, then click "Optimize Fleet"
        </div>
      </div>
    );
  }

  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const { routes, totalFleetDistance, maxRouteDistance, executionTimeMs } = result;

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `N${id}`;
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Fleet Dispatch Summary (CVRP)</div>

        {/* 📄 Print Driver Manifest Button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setIsManifestOpen(true)}
          style={{
            width: '100%',
            marginBottom: '0.75rem',
            background: '#0284c7',
            color: '#ffffff',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            padding: '0.45rem',
          }}
        >
          <span>📄</span> Print / Export Driver Run-Sheet
        </button>

      {/* 🚀 Live Simulation Notification Banner */}
      <div style={{
        background: '#0f172a',
        border: '1px solid #38bdf8',
        borderRadius: '8px',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.75rem',
        fontSize: '0.72rem',
        color: '#e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>📍 Routes optimized! Check bottom of map:</span>
        <span style={{ color: '#38bdf8', fontWeight: 700 }}>▶ Live Simulation HUD</span>
      </div>

      {/* 🧵 OS Concurrency Banner */}
      {result.concurrency && (
        <div style={{
          background: '#042f2e',
          border: '1px solid #14b8a6',
          borderRadius: '8px',
          padding: '0.45rem 0.75rem',
          marginBottom: '0.75rem',
          fontSize: '0.72rem',
          color: '#5eead4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <strong>🧵 OS Concurrency:</strong> {result.concurrency.threadsSpawned} Worker Threads Parallel
          </div>
          <span style={{ color: '#a7f3d0', fontSize: '0.68rem', border: '1px solid #059669', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
            🔒 Mutex LockGuard
          </span>
        </div>
      )}

      {/* Fleet Stats Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid #38bdf8',
        borderRadius: '10px',
        padding: '0.8rem 1rem',
        marginBottom: '0.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            🚛 Total Fleet Distance
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>
            {totalFleetDistance} km
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Time: {executionTimeMs.toFixed(2)} ms
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            ⏱️ Bottleneck (Max Route)
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>
            {maxRouteDistance} km
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            ~{Math.round((maxRouteDistance / 30) * 60)} mins shift
          </div>
        </div>
      </div>

      {/* Per-Vehicle Routes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {routes.map((vRoute, idx) => {
          const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
          const estTime = Math.max(3, Math.round((vRoute.totalCost / 30) * 60 + (vRoute.stops.length - 1) * 3));

          return (
            <div
              key={vRoute.vehicleId}
              className="result-box"
              style={{ borderLeft: `4px solid ${color}`, background: '#0f172a' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 700, color: color, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🚚 Van #{vRoute.vehicleId} ({vRoute.stops.length} stops)</span>
                  {vRoute.threadId && (
                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                      [TID: {vRoute.threadId}]
                    </span>
                  )}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  <strong style={{ color: '#f8fafc' }}>{vRoute.totalCost} km</strong> · ~{estTime} mins
                </span>
              </div>

              {/* Stop chips */}
              <div className="path-display" style={{ marginTop: '0.3rem' }}>
                {vRoute.stops.map((stopNode, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span
                      className="path-node"
                      style={{
                        borderColor: color,
                        color: color,
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.4rem',
                      }}
                    >
                      {getNodeName(stopNode)}
                    </span>
                    {i < vRoute.stops.length - 1 && <span className="path-arrow">→</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>

    <DriverManifestModal
      isOpen={isManifestOpen}
      onClose={() => setIsManifestOpen(false)}
      vrpResult={result}
      nodeLabels={nodeLabels}
    />
  </>
  );
}
