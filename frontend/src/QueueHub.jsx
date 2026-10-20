// QueueHub.jsx
// Dedicated Hub for Queue Data Structures in Logistics & Route Optimization:
// 1. 0-1 BFS with std::deque (O(V+E) Linear Shortest Path)
// 2. Priority Queue / Min-Heap (Emergency & VIP Parcel Dispatch)
// 3. Circular Queue / Ring Buffer (Vehicle GPS Stream Telematics)
// 4. FIFO Queue (std::queue) for Minimum Signal Intersections

import { useState } from 'react';
import { calculateZeroOneBfs, calculateBfsHops, calculatePriorityDispatch } from './api';

export default function QueueHub({ graph, nodeLabels, onHighlightPath }) {
  const [activeQueueTab, setActiveQueueTab] = useState('zero_one'); // 'zero_one' | 'priority' | 'circular' | 'bfs_hops'
  const [loading, setLoading] = useState(false);

  // 1. 0-1 BFS State
  const [zeroOneSource, setZeroOneSource] = useState(graph.source || 0);
  const [zeroOneDest, setZeroOneDest] = useState(graph.destination || 5);
  const [zeroOneResult, setZeroOneResult] = useState(null);

  // 2. Priority Queue State
  const [orders, setOrders] = useState([
    { id: 1, stopId: 5, priority: 1, tier: '🔴 Emergency Medicine', distance: 12 },
    { id: 2, stopId: 1, priority: 3, tier: '📦 Standard Amazon Parcel', distance: 4 },
    { id: 3, stopId: 3, priority: 2, tier: '⚡ Instant 10-Min Grocery', distance: 7 },
    { id: 4, stopId: 2, priority: 3, tier: '📦 Standard Clothing Parcel', distance: 3 },
  ]);
  const [priorityResult, setPriorityResult] = useState(null);

  // 3. Circular Queue (Ring Buffer) State
  const CAPACITY = 8;
  const [ringBuffer, setRingBuffer] = useState([
    { id: 1, lat: 26.29, lng: 73.02, speed: 32 },
    { id: 2, lat: 26.28, lng: 73.03, speed: 38 },
    { id: 3, lat: 26.27, lng: 73.04, speed: 29 },
  ]);
  const [headPtr, setHeadPtr] = useState(0);
  const [tailPtr, setTailPtr] = useState(3);

  // 4. BFS Minimum Hops State
  const [hopsResult, setHopsResult] = useState(null);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Stop #${id}`;
  }

  // ── Handler: 0-1 BFS Deque ─────────────────────────────────────────
  async function handleRunZeroOneBfs() {
    setLoading(true);
    try {
      const res = await calculateZeroOneBfs({
        ...graph,
        source: zeroOneSource,
        destination: zeroOneDest,
      });
      if (res.success) {
        setZeroOneResult(res.data);
        if (onHighlightPath && res.data.path) {
          onHighlightPath(res.data.path);
        }
      }
    } catch (err) {
      alert('0-1 BFS calculation error');
    } finally {
      setLoading(false);
    }
  }

  // ── Handler: BFS Minimum Hops ──────────────────────────────────────
  async function handleRunBfsHops() {
    setLoading(true);
    try {
      const res = await calculateBfsHops({
        ...graph,
        source: zeroOneSource,
        destination: zeroOneDest,
      });
      if (res.success) {
        setHopsResult(res.data);
        if (onHighlightPath && res.data.path) {
          onHighlightPath(res.data.path);
        }
      }
    } catch (err) {
      alert('BFS Hops calculation error');
    } finally {
      setLoading(false);
    }
  }

  // ── Handler: Priority Dispatch ─────────────────────────────────────
  async function handleRunPriorityDispatch() {
    setLoading(true);
    try {
      const res = await calculatePriorityDispatch(0, orders, graph.nodes);
      if (res.success) {
        setPriorityResult(res.data);
        if (onHighlightPath && res.data.dispatchedOrders) {
          const path = [0, ...res.data.dispatchedOrders.map(o => o.stopId)];
          onHighlightPath(path);
        }
      }
    } catch (err) {
      alert('Priority dispatch error');
    } finally {
      setLoading(false);
    }
  }

  // ── Handler: Circular Buffer Next Ping ─────────────────────────────
  function handlePushTelemetryPing() {
    const nextId = ringBuffer.length + 1;
    const newPing = {
      id: nextId,
      lat: (26.25 + Math.random() * 0.05).toFixed(4),
      lng: (73.01 + Math.random() * 0.05).toFixed(4),
      speed: Math.round(25 + Math.random() * 20),
    };

    setRingBuffer(prev => {
      const updated = [...prev];
      if (updated.length < CAPACITY) {
        updated.push(newPing);
      } else {
        updated[headPtr] = newPing; // Overwrite oldest at head
      }
      return updated;
    });

    setTailPtr(p => (p + 1) % CAPACITY);
    if (ringBuffer.length >= CAPACITY) {
      setHeadPtr(p => (p + 1) % CAPACITY);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Sub-Tab Selector ─────────────────────────────────────── */}
      <div className="card" style={{ padding: '0.6rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeQueueTab === 'zero_one' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '130px', fontSize: '0.78rem' }}
            onClick={() => setActiveQueueTab('zero_one')}
          >
            🚀 0-1 BFS (Deque)
          </button>
          <button
            className={`btn btn-sm ${activeQueueTab === 'priority' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '130px', fontSize: '0.78rem' }}
            onClick={() => setActiveQueueTab('priority')}
          >
            🚨 Min-Heap Priority Queue
          </button>
          <button
            className={`btn btn-sm ${activeQueueTab === 'circular' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '130px', fontSize: '0.78rem' }}
            onClick={() => setActiveQueueTab('circular')}
          >
            🔄 Ring Buffer Telematics
          </button>
          <button
            className={`btn btn-sm ${activeQueueTab === 'bfs_hops' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, minWidth: '130px', fontSize: '0.78rem' }}
            onClick={() => setActiveQueueTab('bfs_hops')}
          >
            🚦 BFS Min Intersections
          </button>
        </div>
      </div>

      {/* ── TAB 1: 0-1 BFS with std::deque ────────────────────────── */}
      {activeQueueTab === 'zero_one' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>0-1 BFS with Double-Ended Queue</span>
            <span style={{ fontSize: '0.68rem', background: '#0284c7', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              O(V + E) Linear
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '0.9rem' }}>
            In urban routing with <strong>Expressways / Flyovers (Cost = 0)</strong> and <strong>City Streets (Cost = 1)</strong>, standard Dijkstra wastes time maintaining a $O((V+E)\log V)$ min-heap.
            By using a <strong>Deque (`std::deque`)</strong>, 0-cost roads are pushed to the front (`push_front`) and 1-cost roads to the back (`push_back`), finding shortest path in <strong>pure linear time $O(V+E)$</strong>!
          </p>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Origin Hub</label>
              <select value={zeroOneSource} onChange={e => setZeroOneSource(parseInt(e.target.value))}>
                {Array.from({ length: graph.nodes }, (_, i) => (
                  <option key={i} value={i}>{getNodeName(i)}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Destination Hub</label>
              <select value={zeroOneDest} onChange={e => setZeroOneDest(parseInt(e.target.value))}>
                {Array.from({ length: graph.nodes }, (_, i) => (
                  <option key={i} value={i}>{getNodeName(i)}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRunZeroOneBfs}
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? <><span className="loading-spinner" />Executing 0-1 BFS...</> : '🚀 Run 0-1 BFS Deque Search'}
          </button>

          {zeroOneResult && (
            <div style={{ marginTop: '1rem', background: '#0f172a', border: '1px solid #0284c7', borderRadius: '8px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                  ⚡ Result: {zeroOneResult.algorithm}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>
                  {zeroOneResult.executionTimeMs} ms
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>{zeroOneResult.pushFrontCount}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>push_front() [0-Cost]</div>
                </div>
                <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{zeroOneResult.pushBackCount}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>push_back() [1-Cost]</div>
                </div>
                <div style={{ background: '#1e293b', padding: '0.4rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#22c55e' }}>{zeroOneResult.nodesVisited}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Nodes Visited</div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                <strong>Route Path:</strong>{' '}
                {zeroOneResult.path.map((node, i) => (
                  <span key={i}>
                    <strong style={{ color: '#38bdf8' }}>{getNodeName(node)}</strong>
                    {i < zeroOneResult.path.length - 1 && ' ➔ '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Priority Queue / Min-Heap (Emergency & VIP Dispatch) ─ */}
      {activeQueueTab === 'priority' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>VIP & Emergency Priority Queue</span>
            <span style={{ fontSize: '0.68rem', background: '#dc2626', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              Min-Heap O(N log N)
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '0.9rem' }}>
            Blinkit, Zepto, and hospital logistics use <strong>Priority Queues</strong> to ensure that <strong>Emergency Medical Supplies (🔴 Priority 1)</strong> and <strong>10-minute SLA groceries (⚡ Priority 2)</strong> are dispatched before normal parcels (📦 Priority 3), regardless of proximity!
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.9rem' }}>
            {orders.map((ord, idx) => (
              <div key={ord.id} style={{
                background: '#1e293b',
                border: `1px solid ${ord.priority === 1 ? '#ef4444' : ord.priority === 2 ? '#f59e0b' : '#38bdf8'}`,
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.78rem',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{getNodeName(ord.stopId)}</div>
                  <div style={{ fontSize: '0.7rem', color: ord.priority === 1 ? '#fca5a5' : ord.priority === 2 ? '#fde68a' : '#94a3b8' }}>
                    {ord.tier} ({ord.distance} km)
                  </div>
                </div>

                <select
                  value={ord.priority}
                  onChange={e => {
                    const p = parseInt(e.target.value);
                    const tierName = p === 1 ? '🔴 Emergency Medicine' : p === 2 ? '⚡ Instant 10-Min' : '📦 Standard Parcel';
                    setOrders(prev => prev.map((o, i) => i === idx ? { ...o, priority: p, tier: tierName } : o));
                  }}
                  style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <option value={1}>🔴 Priority 1 (Emergency)</option>
                  <option value={2}>⚡ Priority 2 (10-Min Instant)</option>
                  <option value={3}>📦 Priority 3 (Standard)</option>
                </select>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleRunPriorityDispatch}
            disabled={loading}
            style={{ width: '100%', background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)', border: 'none' }}
          >
            {loading ? <><span className="loading-spinner" />Ordering Min-Heap...</> : '🚨 Dispatch via Priority Queue'}
          </button>

          {priorityResult && (
            <div style={{ marginTop: '1rem', background: '#0f172a', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: '0.5rem' }}>
                📋 Min-Heap Dispatch Manifest:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {priorityResult.dispatchedOrders.map((ord, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', background: '#1e293b', padding: '0.35rem 0.6rem', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 800, color: '#f59e0b', width: '20px' }}>#{i + 1}</span>
                    <span style={{ flex: 1, color: '#f1f5f9' }}>{getNodeName(ord.stopId)}</span>
                    <span style={{ color: ord.priority === 1 ? '#ef4444' : ord.priority === 2 ? '#f59e0b' : '#94a3b8', fontSize: '0.7rem' }}>
                      {ord.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Circular Queue / Ring Buffer Telematics ─────────── */}
      {activeQueueTab === 'circular' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Circular Queue / Ring Buffer</span>
            <span style={{ fontSize: '0.68rem', background: '#059669', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              O(1) Fixed RAM
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '0.9rem' }}>
            High-frequency 10 Hz vehicle GPS telematics cannot store unbounded coordinates in RAM without memory leaks.
            A <strong>Circular Buffer</strong> uses head and tail modulo pointers (`(head + 1) % Capacity`), overwriting the oldest GPS breadcrumb automatically in <strong>$O(1)$ time and $O(1)$ memory</strong>.
          </p>

          {/* Visual Ring Buffer representation */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}>
            {Array.from({ length: CAPACITY }, (_, idx) => {
              const ping = ringBuffer[idx];
              const isHead = idx === headPtr;
              const isTail = idx === tailPtr;

              return (
                <div key={idx} style={{
                  background: ping ? '#1e293b' : '#0f172a',
                  border: isHead ? '2px solid #ef4444' : isTail ? '2px solid #10b981' : '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.5rem 0.4rem',
                  textAlign: 'center',
                  fontSize: '0.7rem',
                  position: 'relative',
                }}>
                  {isHead && (
                    <span style={{ position: 'absolute', top: '-7px', left: '2px', background: '#ef4444', color: '#fff', fontSize: '0.55rem', padding: '0 3px', borderRadius: '3px' }}>
                      HEAD (Evict)
                    </span>
                  )}
                  {isTail && (
                    <span style={{ position: 'absolute', bottom: '-7px', right: '2px', background: '#10b981', color: '#fff', fontSize: '0.55rem', padding: '0 3px', borderRadius: '3px' }}>
                      TAIL (Insert)
                    </span>
                  )}
                  <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: '0.2rem' }}>Slot #{idx}</div>
                  {ping ? (
                    <div>
                      <div style={{ color: '#38bdf8', fontWeight: 600 }}>{ping.speed} km/h</div>
                      <div style={{ fontSize: '0.62rem', color: '#64748b' }}>GPS Ping #{ping.id}</div>
                    </div>
                  ) : (
                    <div style={{ color: '#475569', fontStyle: 'italic' }}>EMPTY</div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            className="btn btn-secondary"
            onClick={handlePushTelemetryPing}
            style={{ width: '100%', borderColor: '#10b981', color: '#34d399' }}
          >
            📡 Push Next Real-Time GPS Ping into Ring Buffer
          </button>
        </div>
      )}

      {/* ── TAB 4: BFS Minimum Hops / Intersections ───────────────── */}
      {activeQueueTab === 'bfs_hops' && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>FIFO Queue BFS (Minimum Intersections)</span>
            <span style={{ fontSize: '0.68rem', background: '#6366f1', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
              Fewest Red Lights
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '0.9rem' }}>
            In urban city logistics, idling at red traffic lights burns more fuel than driving an extra kilometer.
            A standard <strong>FIFO Queue (`std::queue`)</strong> runs unweighted Breadth-First Search to locate the path with the <strong>fewest signal intersections / turns</strong>.
          </p>

          <button
            className="btn btn-primary"
            onClick={handleRunBfsHops}
            disabled={loading}
            style={{ width: '100%', background: '#4f46e5', border: 'none' }}
          >
            {loading ? <><span className="loading-spinner" />Searching...</> : '🚦 Find Route with Fewest Red Lights'}
          </button>

          {hopsResult && (
            <div style={{ marginTop: '1rem', background: '#0f172a', border: '1px solid #6366f1', borderRadius: '8px', padding: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700 }}>
                  🚦 Minimum Intersections: {hopsResult.hops} stops
                </span>
                <span style={{ fontSize: '0.72rem', color: '#22c55e' }}>{hopsResult.executionTimeMs} ms</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                <strong>Path:</strong>{' '}
                {hopsResult.path.map((node, i) => (
                  <span key={i}>
                    <strong style={{ color: '#818cf8' }}>{getNodeName(node)}</strong>
                    {i < hopsResult.path.length - 1 && ' ➔ '}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
