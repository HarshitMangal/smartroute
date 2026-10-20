// HistoryModal.jsx
// Displays previous route calculations and dispatch runs saved in MongoDB
import { useState, useEffect } from 'react';
import { getHistory } from './api';

export default function HistoryModal({ isOpen, onClose, nodeLabels, onSelectHistory }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await getHistory();
      if (res.success) {
        setHistory(res.data || []);
      } else {
        setError(res.error || 'Failed to load history');
      }
    } catch (e) {
      setError(e.message || 'Error connecting to MongoDB');
    } finally {
      setLoading(false);
    }
  }

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Node #${id}`;
  }

  function formatTime(iso) {
    if (!iso) return 'Just now';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.2rem 1.5rem',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📜</span> Dispatch History (MongoDB)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Persistent storage of previous route calculations and fleet dispatches
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.2rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
              <span className="loading-spinner" /> Loading dispatch logs from MongoDB...
            </div>
          )}

          {error && (
            <div style={{ background: '#451a1a', border: '1px solid #dc2626', color: '#fca5a5', padding: '0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && history.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              No dispatch history found yet. Calculate a route or optimize fleet to record logs!
            </div>
          )}

          {!loading && history.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((item, idx) => {
                const isVrp = item.algorithm === 'vrp';
                const isOpt = item.algorithm === 'optimize';
                const isComp = item.algorithm === 'compare';
                const isShort = item.algorithm === 'dijkstra' || item.algorithm === 'astar';

                return (
                  <div
                    key={item._id || idx}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: isVrp ? '#064e3b' : isOpt ? '#1e3a8a' : '#312e81',
                        color: isVrp ? '#34d399' : isOpt ? '#60a5fa' : '#a5b4fc',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                      }}>
                        {isVrp ? '🚛 Fleet VRP' : isOpt ? '📦 1-Van Optimize' : isComp ? '⚡ Algorithm Race' : `🔍 ${item.algorithm}`}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        ⏱ {formatTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Content details */}
                    {isVrp && item.vrpResult && (
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <strong>{item.vrpResult.vehicleCount || 2} Vans Dispatched</strong> · Total Distance: <strong style={{ color: '#38bdf8' }}>{item.vrpResult.totalFleetDistance} km</strong> · Max Shift: {item.vrpResult.maxRouteDistance} km
                      </div>
                    )}

                    {isOpt && item.optimizeResult && (
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        2-Opt Distance: <strong style={{ color: '#22c55e' }}>{item.optimizeResult.twoOptCost} km</strong> (Saved {item.optimizeResult.improvementPercent?.toFixed(1)}%)
                      </div>
                    )}

                    {isShort && item.result && (
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Distance: <strong style={{ color: '#38bdf8' }}>{item.result.distance} km</strong> ({item.result.nodesVisited} nodes visited in {item.result.executionTimeMs?.toFixed(2)} ms)
                      </div>
                    )}

                    {isComp && item.compareResult && (
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Winner: <strong style={{ color: '#22c55e' }}>{item.compareResult.winner?.toUpperCase()}</strong> · Distance: {item.compareResult.dijkstra?.distance} km
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.8rem 1.5rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
