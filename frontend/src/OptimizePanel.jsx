export default function OptimizePanel({ result, error, nodeLabels }) {

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Stop #${id}`;
  }
  if (error) {
    return (
      <div className="card">
        <div className="card-title">Optimize Result</div>
        <div className="result-box error">
          <span style={{ color: '#ef4444' }}>❌ {error}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card">
        <div className="card-title">Route Optimization (NN + 2-opt)</div>
        <div style={{ color: '#475569', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
          Add delivery stops and click Optimize
        </div>
      </div>
    );
  }

  const {
    nearestNeighborOrder,
    nearestNeighborCost,
    twoOptOrder,
    twoOptCost,
    improvementPercent,
    executionTimeMs,
  } = result;

  const improved = twoOptCost < nearestNeighborCost;

  return (
    <div className="card">
      <div className="card-title">Route Optimization</div>

      {/* Improvement banner */}
      <div style={{
        background: improved ? '#052e16' : '#1e293b',
        border: `1px solid ${improved ? '#22c55e' : '#475569'}`,
        borderRadius: '8px',
        padding: '0.6rem 1rem',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.2rem' }}>{improved ? '🎉' : '➖'}</span>
        <div>
          <div style={{ fontWeight: 700, color: improved ? '#22c55e' : '#e2e8f0' }}>
            {improved
              ? `2-opt improved by ${improvementPercent.toFixed(1)}%`
              : 'Already optimal (2-opt = NN)'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Time: {executionTimeMs.toFixed(2)}ms
          </div>
        </div>
      </div>

      {/* Cost & Travel Time comparison */}
      {(() => {
        const timeMins = Math.max(3, Math.round((twoOptCost / 30) * 60 + (twoOptOrder.length - 1) * 3));
        const etaFormatted = timeMins >= 60
          ? `${Math.floor(timeMins / 60)} hr ${timeMins % 60} min`
          : `${timeMins} mins`;
        const savedKm = Math.max(0, nearestNeighborCost - twoOptCost);

        return (
          <>
            <div style={{
              background: '#0f172a',
              border: '1px solid #22c55e',
              borderRadius: '8px',
              padding: '0.6rem 0.9rem',
              marginBottom: '0.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>⏱️ Total Delivery ETA</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>{etaFormatted}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>🚗 Optimized Distance</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22c55e' }}>{twoOptCost} km</div>
              </div>
            </div>

            <div className="stats-grid" style={{ marginBottom: '0.75rem' }}>
              <div className="stat-box">
                <div className="stat-value" style={{ color: '#f59e0b' }}>{nearestNeighborCost} km</div>
                <div className="stat-label">Initial Distance</div>
              </div>
              <div className="stat-box">
                <div className="stat-value" style={{ color: '#22c55e' }}>
                  {savedKm > 0 ? `-${savedKm} km` : 'Optimal'}
                </div>
                <div className="stat-label">Saved by 2-Opt</div>
              </div>
            </div>
          </>
        );
      })()}

      {/* NN Route */}
      <div className="result-box" style={{ marginBottom: '0.5rem', borderLeft: '3px solid #f59e0b' }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
          Nearest Neighbor order (initial)
        </div>
        <div className="path-display">
          {nearestNeighborOrder.map((node, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className="path-node" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>
                {getNodeName(node)}
              </span>
              {i < nearestNeighborOrder.length - 1 && <span className="path-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* 2-opt Route */}
      <div className="result-box" style={{ borderLeft: '3px solid #22c55e' }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
          2-opt optimized order ✨
        </div>
        <div className="path-display">
          {twoOptOrder.map((node, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className="path-node">
                {getNodeName(node)}
              </span>
              {i < twoOptOrder.length - 1 && <span className="path-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
