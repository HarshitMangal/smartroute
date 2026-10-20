// GraphBuilder.jsx
// Left sidebar — user yahan graph banata hai:
//   1. Nodes count set karo
//   2. Edges add karo (from → to, weight)
//   3. Source aur destination choose karo
//   4. Algorithm select karo
//   5. Run / Compare karo

import { useState } from 'react';

// Default sample graph — agar user directly test karna chahe
const DEFAULT_NODES = 6;
const DEFAULT_EDGES = [
  [0, 1, 4], [0, 2, 2], [1, 2, 1],
  [1, 3, 5], [2, 3, 8], [2, 4, 10],
  [3, 4, 2], [3, 5, 6], [4, 5, 3],
];

export default function GraphBuilder({ graph, nodeLabels, onChange, onRun, onCompare, loading }) {
  const { nodes, edges, source, destination } = graph;
  const [algorithm, setAlgo] = useState('dijkstra');
  const [newEdge, setNewEdge] = useState({ from: '', to: '', weight: '' });

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Location N${id}`;
  }

  function setNodes(n) {
    onChange({
      ...graph,
      nodes: n,
      edges: graph.edges.filter(([u, v]) => u < n && v < n),
      source: Math.min(graph.source, n - 1),
      destination: Math.min(graph.destination, n - 1),
    });
  }

  function setSource(s) {
    onChange({ ...graph, source: s });
  }

  function setDest(d) {
    onChange({ ...graph, destination: d });
  }

  function addEdge() {
    const { from, to, weight } = newEdge;
    const u = parseInt(from), v = parseInt(to), w = parseInt(weight);

    if (isNaN(u) || isNaN(v) || isNaN(w)) return alert('Edge values must be numbers');
    if (u < 0 || u >= nodes || v < 0 || v >= nodes)
      return alert(`Node must be between 0 and ${nodes - 1}`);
    if (w < 0) return alert('Weight cannot be negative');
    if (u === v) return alert('Self-loop not allowed');

    onChange({
      ...graph,
      edges: [...edges, [u, v, w]],
    });
    setNewEdge({ from: '', to: '', weight: '' });
  }

  function removeEdge(index) {
    onChange({
      ...graph,
      edges: edges.filter((_, i) => i !== index),
    });
  }

  function clearGraph() {
    onChange({
      ...graph,
      edges: [],
    });
  }

  // ─── Graph data banao aur callback call karo ────────────────
  function getGraphData() {
    return { nodes, edges, source, destination };
  }

  function handleRun() {
    if (edges.length === 0) return alert('Add at least one edge');
    onRun(getGraphData(), algorithm);
  }

  function handleCompare() {
    if (edges.length === 0) return alert('Add at least one edge');
    onCompare(getGraphData());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Graph Config ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Graph Setup</div>

        <div className="form-group">
          <label>Total Nodes (intersections)</label>
          <input
            type="number" min="2" max="50" value={nodes}
            onChange={e => {
              const n = parseInt(e.target.value) || 2;
              setNodes(n);
              setEdges([]);
              setSource(0);
              setDest(Math.min(1, n - 1));
            }}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>📍 Source Location (Start)</label>
            <select value={source} onChange={e => setSource(parseInt(e.target.value))}>
              {Array.from({ length: nodes }, (_, i) => (
                <option key={i} value={i}>{getNodeName(i)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>🏁 Destination Location (End)</label>
            <select value={destination} onChange={e => setDest(parseInt(e.target.value))}>
              {Array.from({ length: nodes }, (_, i) => (
                <option key={i} value={i}>{getNodeName(i)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Algorithm</label>
          <select value={algorithm} onChange={e => setAlgo(e.target.value)}>
            <option value="dijkstra">Dijkstra — Guaranteed shortest path</option>
            <option value="astar">A* — Goal-directed search</option>
          </select>
        </div>
      </div>

      {/* ── Add Edge ──────────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Add Road (Edge)</div>

        <div className="form-row">
          <div className="form-group">
            <label>From</label>
            <input
              type="number" placeholder="0" min="0" max={nodes - 1}
              value={newEdge.from}
              onChange={e => setNewEdge(p => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>To</label>
            <input
              type="number" placeholder="1" min="0" max={nodes - 1}
              value={newEdge.to}
              onChange={e => setNewEdge(p => ({ ...p, to: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Distance</label>
            <input
              type="number" placeholder="5" min="0"
              value={newEdge.weight}
              onChange={e => setNewEdge(p => ({ ...p, weight: e.target.value }))}
            />
          </div>
        </div>

        <button className="btn btn-secondary" onClick={addEdge}>+ Add Edge</button>

        {/* Edge List */}
        {edges.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              {edges.length} edge{edges.length !== 1 ? 's' : ''} added
            </div>
            <div className="edge-list">
              {edges.map(([u, v, w], i) => (
                <div key={i} className="edge-item">
                  <span>{u} → {v} &nbsp;<strong style={{ color: '#e2e8f0' }}>({w})</strong></span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeEdge(i)}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn-danger"
          style={{ marginTop: '0.5rem' }}
          onClick={clearGraph}
        >
          Clear All Edges
        </button>
      </div>

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={loading}
        >
          {loading ? (
            <><span className="loading-spinner" />Calculating...</>
          ) : (
            `▶ Run ${algorithm === 'dijkstra' ? 'Dijkstra' : 'A*'}`
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleCompare}
          disabled={loading}
        >
          {loading ? 'Running...' : '⚖ Compare Dijkstra vs A*'}
        </button>
      </div>

    </div>
  );
}
