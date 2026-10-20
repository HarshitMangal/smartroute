// GraphBuilder.jsx
// User-friendly Route Planner & Road Network Manager
// Uses real landmark names instead of abstract node numbers

import { useState } from 'react';

export default function GraphBuilder({ graph, nodeLabels, onChange, onRun, onCompare, loading }) {
  const { nodes, edges, source, destination } = graph;
  const [algorithm, setAlgo] = useState('dijkstra');
  const [newEdge, setNewEdge] = useState({ from: '0', to: '1', weight: '5' });
  const [newLocationName, setNewLocationName] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Location #${id}`;
  }

  function setSource(s) {
    onChange({ ...graph, source: s });
  }

  function setDest(d) {
    onChange({ ...graph, destination: d });
  }

  function addLocation() {
    const name = newLocationName.trim() || `Location #${nodes}`;
    const newId = nodes;
    if (nodeLabels) {
      nodeLabels[newId] = name;
    }
    // Auto-connect to depot (0) with default 5km
    const newEdges = [...edges, [0, newId, 5]];
    onChange({
      ...graph,
      nodes: nodes + 1,
      edges: newEdges,
      destination: newId,
    });
    setNewLocationName('');
    setShowAddLocation(false);
  }

  function addEdge() {
    const u = parseInt(newEdge.from);
    const v = parseInt(newEdge.to);
    const w = parseFloat(newEdge.weight);

    if (isNaN(u) || isNaN(v) || isNaN(w)) return alert('Distance must be a valid number');
    if (u === v) return alert('Source and destination cannot be the same place');
    if (w <= 0) return alert('Distance must be greater than 0 km');

    // Check if edge already exists
    const exists = edges.some(([a, b]) => (a === u && b === v) || (a === v && b === u));
    if (exists) return alert('A road already connects these two locations');

    onChange({
      ...graph,
      edges: [...edges, [u, v, w]],
    });
  }

  function removeEdge(index) {
    onChange({
      ...graph,
      edges: edges.filter((_, i) => i !== index),
    });
  }

  function clearGraph() {
    if (window.confirm('Reset all roads?')) {
      onChange({
        ...graph,
        edges: [],
      });
    }
  }

  function getGraphData() {
    return { nodes, edges, source, destination };
  }

  function handleRun() {
    if (edges.length === 0) return alert('Add at least one connecting road');
    onRun(getGraphData(), algorithm);
  }

  function handleCompare() {
    if (edges.length === 0) return alert('Add at least one connecting road');
    onCompare(getGraphData());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Route Planning Card ───────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ margin: 0 }}>📍 Route Planner</div>
          <span style={{ fontSize: '0.75rem', background: '#1e293b', border: '1px solid #334155', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#94a3b8' }}>
            {nodes} Delivery Hubs
          </span>
        </div>

        {/* Source & Destination Dropdowns */}
        <div className="form-group">
          <label>🟢 Start Location (Depot / Origin)</label>
          <select value={source} onChange={e => setSource(parseInt(e.target.value))}>
            {Array.from({ length: nodes }, (_, i) => (
              <option key={i} value={i}>{getNodeName(i)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>🏁 Final Destination (Drop-off)</label>
          <select value={destination} onChange={e => setDest(parseInt(e.target.value))}>
            {Array.from({ length: nodes }, (_, i) => (
              <option key={i} value={i}>{getNodeName(i)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Routing Engine Algorithm</label>
          <select value={algorithm} onChange={e => setAlgo(e.target.value)}>
            <option value="dijkstra">Dijkstra — Exact Shortest Path Guarantee</option>
            <option value="astar">A* Search — Heuristic Goal-Directed (Fastest)</option>
          </select>
        </div>

        {/* Quick Add Custom Location Toggle */}
        <div style={{ marginTop: '0.5rem' }}>
          {!showAddLocation ? (
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', fontSize: '0.78rem' }}
              onClick={() => setShowAddLocation(true)}
            >
              ➕ Add New Delivery Location
            </button>
          ) : (
            <div style={{ background: '#0f172a', padding: '0.6rem', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: '0.35rem', fontWeight: 600 }}>
                New Landmark / Customer Address:
              </div>
              <input
                type="text"
                placeholder="e.g. Airport Road, Central Mall"
                value={newLocationName}
                onChange={e => setNewLocationName(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={addLocation}>Save Location</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddLocation(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Connect Roads Card ─────────────────────────────────── */}
      <div className="card">
        <div className="card-title">🛣️ Road Network & Distances</div>

        <div className="form-group">
          <label>Connect From</label>
          <select
            value={newEdge.from}
            onChange={e => setNewEdge(p => ({ ...p, from: e.target.value }))}
          >
            {Array.from({ length: nodes }, (_, i) => (
              <option key={i} value={i}>{getNodeName(i)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Connect To</label>
          <select
            value={newEdge.to}
            onChange={e => setNewEdge(p => ({ ...p, to: e.target.value }))}
          >
            {Array.from({ length: nodes }, (_, i) => (
              <option key={i} value={i}>{getNodeName(i)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Road Distance (km)</label>
          <input
            type="number"
            placeholder="Distance in km"
            min="1"
            max="100"
            value={newEdge.weight}
            onChange={e => setNewEdge(p => ({ ...p, weight: e.target.value }))}
          />
        </div>

        <button className="btn btn-secondary" onClick={addEdge} style={{ marginTop: '0.25rem' }}>
          + Connect Road
        </button>

        {/* Road List with Real Names */}
        {edges.length > 0 && (
          <div style={{ marginTop: '0.85rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{edges.length} active roads</span>
              <button
                onClick={clearGraph}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
              >
                Reset All Roads
              </button>
            </div>
            <div className="edge-list" style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {edges.map(([u, v, w], i) => (
                <div key={i} className="edge-item" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span title={`${getNodeName(u)} ➔ ${getNodeName(v)}`}>
                    <strong>{getNodeName(u).split(' ')[0]}</strong> ➔ <strong>{getNodeName(v).split(' ')[0]}</strong>
                    <span style={{ color: '#38bdf8', marginLeft: '0.4rem' }}>{w} km</span>
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeEdge(i)}
                    style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={loading}
          style={{ padding: '0.75rem', fontSize: '0.92rem' }}
        >
          {loading ? (
            <><span className="loading-spinner" />Optimizing Route...</>
          ) : (
            `▶ Find Shortest Route (${algorithm === 'dijkstra' ? 'Dijkstra' : 'A*'})`
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleCompare}
          disabled={loading}
          style={{ padding: '0.65rem' }}
        >
          {loading ? 'Comparing...' : '⚖ Benchmark: Dijkstra vs A*'}
        </button>
      </div>

    </div>
  );
}
