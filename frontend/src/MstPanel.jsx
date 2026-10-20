// MstPanel.jsx
// Displays Kruskal's Minimum Spanning Tree (MST) and Disjoint Set Union (DSU) stats
export default function MstPanel({ result, error, nodeLabels, loading, onComputeMst, graph }) {
  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Node #${id}`;
  }

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Infrastructure Backbone (MST)</span>
        <span style={{
          background: '#064e3b',
          color: '#34d399',
          fontSize: '0.65rem',
          fontWeight: 700,
          padding: '0.15rem 0.4rem',
          borderRadius: '4px',
          border: '1px solid #059669',
        }}>
          Kruskal + DSU
        </span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
        Computes the minimum connected network required to link all {graph.nodes} delivery hubs with zero redundant cycles and lowest total construction/maintenance cost.
      </div>

      <button
        className="btn btn-primary"
        onClick={() => onComputeMst(graph)}
        disabled={loading}
        style={{ marginBottom: '0.8rem', background: '#059669', border: 'none' }}
      >
        {loading ? <><span className="loading-spinner" />Computing MST...</> : '🌲 Compute Minimum Transit Backbone'}
      </button>

      {error && (
        <div className="result-box error">
          <span style={{ color: '#ef4444' }}>❌ {error}</span>
        </div>
      )}

      {result && (
        <>
          {/* Summary Stats */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '0.8rem 1rem',
            marginBottom: '0.8rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#a7f3d0', textTransform: 'uppercase' }}>
                Total Backbone Weight
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6ee7b7' }}>
                {result.totalMstWeight} km
              </div>
              <div style={{ fontSize: '0.68rem', color: '#6ee7b7' }}>
                Time: {result.executionTimeMs.toFixed(2)} ms
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: '#a7f3d0', textTransform: 'uppercase' }}>
                Spanning Edges
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
                {result.mstEdges.length} / {graph.edges.length}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#a7f3d0' }}>
                Cycles Eliminated: {graph.edges.length - result.mstEdges.length}
              </div>
            </div>
          </div>

          {/* DSU Interview Badges */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#1e293b', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              ⚡ Path Compression: O(α(V))
            </span>
            <span style={{ background: '#1e293b', border: '1px solid #a855f7', color: '#c084fc', fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              ⚡ Union by Rank: Balanced Trees
            </span>
          </div>

          {/* Selected MST Edges List */}
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.4rem' }}>
            Selected Minimum Backbone Roads:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
            {result.mstEdges.map(([u, v, w], i) => (
              <div
                key={i}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: '#f8fafc' }}>
                  🌲 {getNodeName(u)} ↔ {getNodeName(v)}
                </span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>
                  {w} km
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
