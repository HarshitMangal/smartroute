// DriverManifestModal.jsx
// Generates a professional printable dispatch manifest (run-sheet) for drivers
export default function DriverManifestModal({ isOpen, onClose, vrpResult, nodeLabels }) {
  if (!isOpen || !vrpResult) return null;

  const { routes, totalFleetDistance, maxRouteDistance } = vrpResult;

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Stop #${id}`;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}>
      <div style={{
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print" style={{
          padding: '1rem 1.5rem',
          background: '#0f172a',
          color: '#ffffff',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h4 style={{ margin: 0, color: '#38bdf8' }}>📄 Driver Dispatch Manifest</h4>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Print or Save as PDF for logistics dispatch operations
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🖨️ Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Printable Paper Document */}
        <div style={{
          padding: '2rem',
          overflowY: 'auto',
          flex: 1,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {/* Document Header */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: '0 0 0.3rem 0', color: '#0369a1', fontSize: '1.6rem', fontWeight: 800 }}>
                SmartRoute Logistics
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                Jodhpur Regional Logistics & Fleet Dispatch Center
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Depot: Clock Tower (Ghanta Ghar), Jodhpur, Rajasthan
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#334155' }}>
              <div><strong>Manifest ID:</strong> SR-JOD-{Date.now().toString().slice(-6)}</div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              <div><strong>Dispatch Time:</strong> {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Fleet Summary Banner */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>TOTAL VEHICLES</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{routes.length} Delivery Vans</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>TOTAL FLEET DISTANCE</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{totalFleetDistance} km</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600 }}>MAX SHIFT LENGTH</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{maxRouteDistance} km</div>
            </div>
          </div>

          {/* Individual Van Tables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {routes.map(vRoute => (
              <div key={vRoute.vehicleId} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#0f172a', color: '#ffffff', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    🚚 DELIVERY VAN #{vRoute.vehicleId}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {vRoute.stops.length} Stops · Total: {vRoute.totalCost} km
                  </span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem', width: '50px' }}>Seq</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Destination Landmark</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '80px' }}>Status</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '120px' }}>Customer Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vRoute.stops.map((stopId, sIdx) => (
                      <tr key={sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#64748b' }}>
                          #{sIdx + 1}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                          {getNodeName(stopId)}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: sIdx === 0 ? '#15803d' : '#0369a1', fontWeight: sIdx === 0 ? 700 : 400 }}>
                          {sIdx === 0 ? '🏢 Depot' : '📦 Delivery'}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '1.5px solid #64748b', borderRadius: '3px' }} />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px dashed #cbd5e1' }}>
                          &nbsp;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Signatures Footer */}
          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #cbd5e1', fontSize: '0.8rem', color: '#475569' }}>
            <div>
              <div>____________________________</div>
              <div style={{ marginTop: '0.2rem' }}>Dispatcher Signature & Stamp</div>
            </div>
            <div>
              <div>____________________________</div>
              <div style={{ marginTop: '0.2rem' }}>Fleet Supervisor Signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
