// ResultPanel.jsx
// Route result aur algorithm comparison display karta hai

export default function ResultPanel({ result, compareResult, error, nodeLabels }) {

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Stop #${id}`;
  }

  // ─── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card">
        <div className="card-title">Result</div>
        <div className="result-box error">
          <div style={{ color: '#ef4444', fontWeight: 600 }}>❌ Error</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: '#94a3b8' }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  // ─── Single Algorithm Result ──────────────────────────────────
  if (result) {
    const { algorithm, distance, path, nodesVisited, executionTimeMs } = result;

    // ETA Calculation: Average urban delivery speed ~ 30 km/h
    // Travel time = (distance / 30) * 60 minutes + 2 mins per stop
    const travelTimeMins = Math.max(2, Math.round((distance / 30) * 60 + (path.length - 1) * 2));
    const etaFormatted = travelTimeMins >= 60
      ? `${Math.floor(travelTimeMins / 60)} hr ${travelTimeMins % 60} min`
      : `${travelTimeMins} mins`;

    // Fuel estimation (average 12 km/litre delivery van)
    const fuelLitres = (distance / 12).toFixed(1);

    return (
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Route Result — {algorithm.toUpperCase()}</span>
          {result.cached && (
            <span style={{
              background: '#064e3b',
              color: '#34d399',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              border: '1px solid #059669',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              ⚡ CACHED (RAM &lt;1ms)
            </span>
          )}
        </div>

        {/* ETA & Distance Big Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid #38bdf8',
          borderRadius: '10px',
          padding: '0.8rem 1rem',
          marginBottom: '0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⏱️ Expected Travel Time
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
              {etaFormatted}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              @ 30 km/h avg city traffic
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🚗 Total Distance
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#22c55e' }}>
              {distance} km
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              ⛽ ~{fuelLitres} L Fuel
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: '0.75rem' }}>
          <div className="stat-box">
            <div className="stat-value">{nodesVisited}</div>
            <div className="stat-label">Locations Evaluated</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{path.length}</div>
            <div className="stat-label">Stops on Route</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">
              {executionTimeMs < 1 ? '<1' : executionTimeMs.toFixed(1)}
            </div>
            <div className="stat-label">Compute Time (ms)</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#a855f7' }}>
              {Math.max(1, Math.round(distance * 12))} ₹
            </div>
            <div className="stat-label">Est. Fuel Cost</div>
          </div>
        </div>

        <div className="result-box success">
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
            Shortest Path
          </div>
          <div className="path-display">
            {path.map((node, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="path-node">{getNodeName(node)}</span>
                {i < path.length - 1 && <span className="path-arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Compare Result ───────────────────────────────────────────
  if (compareResult) {
    const { dijkstra, astar, winner, summary } = compareResult;

    return (
      <div className="card">
        <div className="card-title">Algorithm Comparison</div>

        {/* 🧵 OS Concurrency Banner */}
        {compareResult.concurrency && (
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
              <strong>🧵 OS Parallel Race:</strong> 2 Dedicated Threads (Dijkstra vs A*)
            </div>
            <span style={{ color: '#a7f3d0', fontSize: '0.68rem', border: '1px solid #059669', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
              Barrier Sync Joined
            </span>
          </div>
        )}

        {/* Winner Banner */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>🏆 Winner:</span>
          <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
            {winner.toUpperCase()}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>
            {summary.sameDistance ? 'Same distance' : 'Different distances'}
          </span>
        </div>

        {/* Comparison Table */}
        <table className="compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>
                Dijkstra
                {winner === 'dijkstra' && <span className="winner-badge">WINNER</span>}
              </th>
              <th>
                A*
                {winner === 'astar' && <span className="winner-badge">WINNER</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: '#94a3b8' }}>Distance</td>
              <td>{dijkstra.distance}</td>
              <td>{astar.distance}</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>Locations Evaluated</td>
              <td style={{ color: winner === 'dijkstra' ? '#22c55e' : '#e2e8f0' }}>
                {dijkstra.nodesVisited}
              </td>
              <td style={{ color: winner === 'astar' ? '#22c55e' : '#e2e8f0' }}>
                {astar.nodesVisited}
              </td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>Compute Time</td>
              <td>{dijkstra.executionTimeMs?.toFixed(2) || '<1'} ms</td>
              <td>{astar.executionTimeMs?.toFixed(2) || '<1'} ms</td>
            </tr>
            <tr>
              <td style={{ color: '#94a3b8' }}>Route Stops</td>
              <td>{dijkstra.path.length} stops</td>
              <td>{astar.path.length} stops</td>
            </tr>
          </tbody>
        </table>

        {/* Both Paths */}
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[dijkstra, astar].map(r => (
            <div key={r.algorithm} className="result-box success">
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                {r.algorithm.toUpperCase()} path
              </div>
              <div className="path-display">
                {r.path.map((node, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="path-node">{getNodeName(node)}</span>
                    {i < r.path.length - 1 && <span className="path-arrow">→</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────
  return (
    <div className="card">
      <div className="card-title">Result</div>
      <div style={{
        textAlign: 'center',
        padding: '1.5rem 0',
        color: '#475569',
        fontSize: '0.85rem'
      }}>
        Run an algorithm to see results here
      </div>
    </div>
  );
}
