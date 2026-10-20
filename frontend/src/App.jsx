import { useState, useEffect } from 'react';
import GraphBuilder  from './GraphBuilder';
import ResultPanel   from './ResultPanel';
import OptimizePanel from './OptimizePanel';
import VrpPanel      from './VrpPanel';
import MstPanel      from './MstPanel';
import GraphMap      from './GraphMap';
import SimulationBar from './SimulationBar';
import { getDistanceKm } from './geoUtils';
import AuthModal     from './AuthModal';
import LocationSearch from './LocationSearch';
import HistoryModal  from './HistoryModal';
import { calculateRoute, compareAlgorithms, optimizeRoute, optimizeVrp, calculateMst, getCircuitStatus, getStoredUser, logoutUser } from './api';

const SAMPLE_GRAPH = {
  nodes: 6,
  edges: [
    [0,1,4],[0,2,2],[1,2,1],
    [1,3,5],[2,3,8],[2,4,10],
    [3,4,2],[3,5,6],[4,5,3],
  ],
  source: 0,
  destination: 5,
};

const DEFAULT_NODE_NAMES = {
  0: 'Clock Tower (Ghanta Ghar)',
  1: 'Ratanada Market',
  2: 'Sardarpura 5th B Rd',
  3: 'Shastri Nagar',
  4: 'Paota Circle',
  5: 'AIIMS Jodhpur Hospital',
};

export default function App() {
  const [tab, setTab]       = useState('shortest'); // 'shortest' | 'optimize'
  const [loading, setLoading] = useState(false);

  // Real location labels
  const [nodeLabels, setNodeLabels] = useState(DEFAULT_NODE_NAMES);

  // User Auth State
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Shortest path state
  const [result, setResult]           = useState(null);
  const [compareResult, setCompare]   = useState(null);
  const [routeError, setRouteError]   = useState(null);

  // Optimize state
  const [optResult, setOptResult]     = useState(null);
  const [optError, setOptError]       = useState(null);
  const [stops, setStops]             = useState([0, 1, 3, 5]);

  // Fleet VRP (Multi-Vehicle) state
  const [vrpResult, setVrpResult]     = useState(null);
  const [vrpError, setVrpError]       = useState(null);
  const [numVehicles, setNumVehicles] = useState(2);
  const [capacity, setCapacity]       = useState(4);

  // Live WebSocket Telematics State
  const [liveVehicles, setLiveVehicles] = useState([]);

  // Dispatch History & Traffic Mode States
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [trafficMode, setTrafficMode]     = useState(false);

  // Minimum Spanning Tree (MST) & Circuit Breaker States
  const [mstResult, setMstResult]         = useState(null);
  const [mstError, setMstError]           = useState(null);
  const [circuitStatus, setCircuitStatus] = useState(null);

  // Dynamic traffic edge weight adjustment
  function getEffectiveGraph(graphData) {
    if (!trafficMode) return graphData;
    const congestedEdges = graphData.edges.map(([u, v, w]) => {
      const isJam = (
        (u === 0 && v === 1) || (u === 1 && v === 0) ||
        (u === 1 && v === 2) || (u === 2 && v === 1) ||
        (u === 2 && v === 3) || (u === 3 && v === 2)
      );
      return [u, v, isJam ? Math.round(w * 3) : w];
    });
    return { ...graphData, edges: congestedEdges };
  }

  // Graph state (custom coordinates map)
  const [graph, setGraph] = useState(SAMPLE_GRAPH);
  const [customCoords, setCustomCoords] = useState({});

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) setUser(stored);
    getCircuitStatus().then(res => {
      if (res.success) setCircuitStatus(res.data);
    }).catch(() => {});
  }, []);

  function handleLogout() {
    logoutUser();
    setUser(null);
  }

  // ── Click map to add stop & auto-connect to nearest existing node ──
  function handleAddNodeAtCoords([lat, lng]) {
    if (user && user.role === 'driver') {
      alert('Drivers can only view assigned routes. Please log in as Admin/Dispatcher to add stops.');
      return;
    }

    const newNodeId = graph.nodes;
    const newCoordsMap = { ...customCoords, [newNodeId]: [lat, lng] };
    setCustomCoords(newCoordsMap);

    // Auto-connect to closest node
    let closestNode = 0;
    let minDistance = 5; // default 5km if no prior custom coords
    if (customCoords[0]) {
      let minDist = 999999;
      Object.entries(customCoords).forEach(([nodeId, [nLat, nLng]]) => {
        const d = getDistanceKm(lat, lng, nLat, nLng);
        if (d < minDist) {
          minDist = d;
          closestNode = parseInt(nodeId);
        }
      });
      minDistance = Math.max(1, minDist);
    }

    const defaultName = `New Stop #${newNodeId} (Jodhpur)`;
    const enteredName = prompt(`Enter name for this delivery location (or press OK for default):`, defaultName);
    const chosenName = (enteredName && enteredName.trim()) ? enteredName.trim() : defaultName;

    setNodeLabels(prev => ({
      ...prev,
      [newNodeId]: chosenName,
    }));

    const newEdges = [...graph.edges, [closestNode, newNodeId, minDistance]];
    setGraph({
      ...graph,
      nodes: graph.nodes + 1,
      edges: newEdges,
    });

    // Also auto-add to delivery stops list
    setStops(prev => [...prev, newNodeId]);
  }

  // ── Handle place selected from search bar ──
  function handleLocationFromSearch({ name, lat, lng }) {
    if (user && user.role === 'driver') {
      alert('Drivers can only view assigned routes. Please log in as Admin/Dispatcher to add stops.');
      return;
    }

    const newNodeId = graph.nodes;
    const newCoordsMap = { ...customCoords, [newNodeId]: [lat, lng] };
    setCustomCoords(newCoordsMap);

    let closestNode = 0;
    let minDistance = 4;
    if (Object.keys(customCoords).length > 0) {
      let minDist = 999999;
      Object.entries(customCoords).forEach(([nodeId, [nLat, nLng]]) => {
        const d = getDistanceKm(lat, lng, nLat, nLng);
        if (d < minDist) {
          minDist = d;
          closestNode = parseInt(nodeId);
        }
      });
      minDistance = Math.max(1, minDist);
    }

    setNodeLabels(prev => ({
      ...prev,
      [newNodeId]: name,
    }));

    const newEdges = [...graph.edges, [closestNode, newNodeId, minDistance]];
    setGraph({
      ...graph,
      nodes: graph.nodes + 1,
      edges: newEdges,
      destination: newNodeId, // Auto-set destination to searched place
    });

    setStops(prev => [...prev, newNodeId]);
  }

  // Active path for map (supports shortest path & optimize mode)
  const activePath =
    tab === 'optimize'
      ? (optResult?.twoOptOrder || optResult?.nearestNeighborOrder || null)
      : (result?.path || compareResult?.dijkstra?.path || null);

  // ── Shortest handlers ──────────────────────────────────────────
  async function handleRun(graphData, algorithm) {
    setLoading(true); setRouteError(null);
    setResult(null); setCompare(null);
    const eff = getEffectiveGraph(graphData);
    setGraph(graphData);
    try {
      const res = await calculateRoute(eff, algorithm);
      res.success ? setResult(res.data) : setRouteError(res.error);
    } catch (e) {
      setRouteError(e.response?.data?.error || 'Backend not reachable — is it running?');
    } finally { setLoading(false); }
  }

  async function handleCompare(graphData) {
    setLoading(true); setRouteError(null);
    setResult(null); setCompare(null);
    const eff = getEffectiveGraph(graphData);
    setGraph(graphData);
    try {
      const res = await compareAlgorithms(eff);
      res.success ? setCompare(res.data) : setRouteError(res.error);
    } catch (e) {
      setRouteError(e.response?.data?.error || 'Backend not reachable');
    } finally { setLoading(false); }
  }

  // ── Optimize handler ───────────────────────────────────────────
  async function handleOptimize(graphData, deliveryStops) {
    setLoading(true); setOptError(null); setOptResult(null);
    const eff = getEffectiveGraph(graphData);
    setGraph(graphData);
    try {
      const res = await optimizeRoute(eff, deliveryStops);
      res.success ? setOptResult(res.data) : setOptError(res.error);
    } catch (e) {
      setOptError(e.response?.data?.error || 'Backend not reachable');
    } finally { setLoading(false); }
  }

  // ── Fleet VRP handler ───────────────────────────────────────────
  async function handleVrp(graphData, deliveryStops, vCount, cap) {
    setLoading(true); setVrpError(null); setVrpResult(null);
    const eff = getEffectiveGraph(graphData);
    setGraph(graphData);
    try {
      const res = await optimizeVrp(eff, deliveryStops, vCount, cap);
      res.success ? setVrpResult(res.data) : setVrpError(res.error);
    } catch (e) {
      setVrpError(e.response?.data?.error || 'Backend not reachable');
    } finally { setLoading(false); }
  }

  // ── Kruskal's MST Handler ───────────────────────────────────────
  async function handleComputeMst(graphData) {
    setLoading(true); setMstError(null); setMstResult(null);
    const eff = getEffectiveGraph(graphData);
    setGraph(graphData);
    try {
      const res = await calculateMst(eff);
      res.success ? setMstResult(res.data) : setMstError(res.error);
    } catch (e) {
      setMstError(e.response?.data?.error || 'Backend not reachable');
    } finally { setLoading(false); }
  }

  // Pre-calculate node positions for simulation waypoints
  const defaultCenter = [26.2389, 73.0243];
  const nodePositions = Array.from({ length: graph.nodes }, (_, i) => {
    if (customCoords && customCoords[i]) return customCoords[i];
    const [centerLat, centerLng] = defaultCenter;
    const radius = 0.025;
    const angle = (2 * Math.PI * i) / graph.nodes - Math.PI / 2;
    return [centerLat + radius * Math.cos(angle), centerLng + radius * Math.sin(angle)];
  });

  // Active routes for live delivery simulation
  const activeSimulationRoutes =
    tab === 'vrp' && vrpResult?.routes
      ? vrpResult.routes
      : (activePath && activePath.length > 1)
        ? [{ vehicleId: 1, stops: activePath }]
        : null;

  return (
    <div className="app">

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="header">
        <h1>🗺 SmartRoute</h1>
        <span>Intelligent Route Optimization</span>

        {/* Header Actions: Traffic Toggle, History, User Status */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* 🚨 Traffic Jam Toggle Button */}
          <button
            className="btn btn-sm"
            onClick={() => setTrafficMode(p => !p)}
            style={{
              width: 'auto',
              padding: '0.35rem 0.65rem',
              background: trafficMode ? '#7f1d1d' : '#1e293b',
              color: trafficMode ? '#fca5a5' : '#94a3b8',
              border: `1px solid ${trafficMode ? '#ef4444' : '#475569'}`,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <span>{trafficMode ? '🚨 Rush Hour: ON (+200% delay)' : '🚗 Normal Traffic'}</span>
          </button>

          {/* 📜 Dispatch History Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsHistoryOpen(true)}
            style={{
              width: 'auto',
              padding: '0.35rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>📜</span> History
          </button>

          {/* 🛡️ Circuit Breaker Health Status */}
          {circuitStatus && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              color: circuitStatus.isHealthy ? '#34d399' : '#f87171',
              background: circuitStatus.isHealthy ? '#064e3b' : '#7f1d1d',
              border: `1px solid ${circuitStatus.isHealthy ? '#059669' : '#ef4444'}`,
              padding: '0.2rem 0.5rem',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <span>{circuitStatus.isHealthy ? '🟢' : '🔴'}</span>
              Circuit: {circuitStatus.state}
            </span>
          )}

          {user ? (
            <>
              <span style={{
                background: user.role === 'admin' ? '#065f46' : '#1e3a8a',
                color: user.role === 'admin' ? '#6ee7b7' : '#93c5fd',
                fontWeight: 600,
                border: 'none',
              }}>
                {user.role === 'admin' ? '🏢 Admin' : '🚚 Driver'}: {user.name}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAuthOpen(true)}
              style={{ width: 'auto', padding: '0.4rem 0.8rem' }}
            >
              🔐 Admin / Driver Login
            </button>
          )}
        </div>
      </header>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        nodeLabels={nodeLabels}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={loggedUser => setUser(loggedUser)}
      />

      <div className="main-content">

        {/* ── Left Sidebar ──────────────────────────────────────── */}
        <div className="sidebar">

          {/* Real Jodhpur Geocoding Search Bar */}
          <LocationSearch onLocationSelect={handleLocationFromSearch} />

          {/* Tab switcher */}
          <div className="tabs">
            <button
              className={`tab ${tab === 'shortest' ? 'active' : ''}`}
              onClick={() => setTab('shortest')}
            >
              🔍 Shortest Path
            </button>
            <button
              className={`tab ${tab === 'optimize' ? 'active' : ''}`}
              onClick={() => setTab('optimize')}
            >
              📦 1-Van (TSP)
            </button>
            <button
              className={`tab ${tab === 'vrp' ? 'active' : ''}`}
              onClick={() => setTab('vrp')}
            >
              🚛 Fleet VRP
            </button>
            <button
              className={`tab ${tab === 'mst' ? 'active' : ''}`}
              onClick={() => setTab('mst')}
            >
              🌳 Backbone (MST)
            </button>
          </div>

          {/* Shortest Path Tab */}
          {tab === 'shortest' && (
            <>
              <GraphBuilder
                graph={graph}
                nodeLabels={nodeLabels}
                onChange={setGraph}
                onRun={handleRun}
                onCompare={handleCompare}
                loading={loading}
              />
              <ResultPanel
                result={result}
                compareResult={compareResult}
                error={routeError}
                nodeLabels={nodeLabels}
              />
            </>
          )}

          {/* Optimize Tab */}
          {tab === 'optimize' && (
            <>
              <OptimizeForm
                graph={graph}
                stops={stops}
                nodeLabels={nodeLabels}
                setStops={setStops}
                loading={loading}
                onOptimize={handleOptimize}
              />
              <OptimizePanel
                result={optResult}
                error={optError}
                nodeLabels={nodeLabels}
              />
            </>
          )}

          {/* Fleet VRP Tab */}
          {tab === 'vrp' && (
            <>
              <VrpForm
                graph={graph}
                stops={stops}
                nodeLabels={nodeLabels}
                setStops={setStops}
                numVehicles={numVehicles}
                setNumVehicles={setNumVehicles}
                capacity={capacity}
                setCapacity={setCapacity}
                loading={loading}
                onOptimizeVrp={handleVrp}
              />
              <VrpPanel
                result={vrpResult}
                error={vrpError}
                nodeLabels={nodeLabels}
              />
            </>
          )}

          {/* Minimum Spanning Tree (MST) Tab */}
          {tab === 'mst' && (
            <MstPanel
              result={mstResult}
              error={mstError}
              nodeLabels={nodeLabels}
              loading={loading}
              onComputeMst={handleComputeMst}
              graph={graph}
            />
          )}

        </div>

        {/* ── Map with Live Simulation HUD ─────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          {activeSimulationRoutes && (
            <div style={{
              position: 'absolute',
              bottom: '24px',
              left: '24px',
              right: '24px',
              zIndex: 1000,
              pointerEvents: 'auto',
            }}>
              <SimulationBar
                routes={activeSimulationRoutes}
                nodeLabels={nodeLabels}
                positions={nodePositions}
                onTelemetryUpdate={setLiveVehicles}
              />
            </div>
          )}
          <GraphMap
            nodes={graph.nodes}
            edges={graph.edges}
            path={tab === 'vrp' ? null : activePath}
            multiRoutes={tab === 'vrp' ? vrpResult?.routes : null}
            liveVehicles={liveVehicles}
            trafficMode={trafficMode}
            mstEdges={tab === 'mst' ? mstResult?.mstEdges : null}
            source={graph.source}
            destination={graph.destination}
            highlightStops={(tab === 'optimize' || tab === 'vrp') ? stops : null}
            customCoords={customCoords}
            nodeLabels={nodeLabels}
            onAddNodeAtCoords={handleAddNodeAtCoords}
          />
        </div>

      </div>
    </div>
  );
}

// ── Inline OptimizeForm ────────────────────────────────────────────
function OptimizeForm({ graph, stops, nodeLabels, setStops, loading, onOptimize }) {
  const [selectedStop, setSelectedStop] = useState(0);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Location N${id}`;
  }

  function addStop() {
    const s = parseInt(selectedStop);
    if (stops.includes(s)) return alert('Stop already added');
    setStops(p => [...p, s]);
  }

  return (
    <div className="card">
      <div className="card-title">Delivery Destinations</div>

      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
        Select destination landmarks or click directly on the map. The engine will find the best visit order.
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Select Landmark Stop</label>
          <select
            value={selectedStop}
            onChange={e => setSelectedStop(parseInt(e.target.value))}
          >
            {Array.from({ length: graph.nodes }, (_, i) => (
              <option key={i} value={i} disabled={stops.includes(i)}>
                {getNodeName(i)} {stops.includes(i) ? '✓ (Added)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <label>&nbsp;</label>
          <button className="btn btn-secondary btn-sm" onClick={addStop}>+ Add Stop</button>
        </div>
      </div>

      {/* Stop chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {stops.map((s, i) => (
          <span key={i} style={{
            background: '#1e293b',
            border: '1px solid #38bdf8',
            color: '#38bdf8',
            borderRadius: '6px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            📍 {getNodeName(s)}
            <span
              style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
              onClick={() => setStops(p => p.filter((_, j) => j !== i))}
            >✕</span>
          </span>
        ))}
      </div>

      <button
        className="btn btn-primary"
        disabled={loading || stops.length < 2}
        onClick={() => onOptimize(graph, stops)}
      >
        {loading
          ? <><span className="loading-spinner" />Optimizing...</>
          : '🚚 Optimize Delivery Route'}
      </button>
    </div>
  );
}

// ── Inline VrpForm (Multi-Vehicle Dispatch) ────────────────────────
function VrpForm({
  graph,
  stops,
  nodeLabels,
  setStops,
  numVehicles,
  setNumVehicles,
  capacity,
  setCapacity,
  loading,
  onOptimizeVrp,
}) {
  const [selectedStop, setSelectedStop] = useState(0);

  function getNodeName(id) {
    return nodeLabels && nodeLabels[id] ? nodeLabels[id] : `Location N${id}`;
  }

  function addStop() {
    const s = parseInt(selectedStop);
    if (stops.includes(s)) return alert('Stop already added');
    setStops(p => [...p, s]);
  }

  return (
    <div className="card">
      <div className="card-title">Fleet Dispatch Setup (CVRP)</div>

      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
        Distribute delivery stops among multiple vans based on capacity constraints and depot starting point.
      </div>

      {/* Fleet configuration controls */}
      <div className="form-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Number of Vans</label>
          <select
            value={numVehicles}
            onChange={e => setNumVehicles(parseInt(e.target.value))}
          >
            <option value={2}>2 Delivery Vans</option>
            <option value={3}>3 Delivery Vans</option>
            <option value={4}>4 Delivery Vans</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Max Stops / Van</label>
          <select
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value))}
          >
            <option value={2}>2 stops / van</option>
            <option value={3}>3 stops / van</option>
            <option value={4}>4 stops / van</option>
            <option value={5}>5 stops / van</option>
            <option value={6}>6 stops / van</option>
          </select>
        </div>
      </div>

      {/* Add stop selector */}
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Add Delivery Stop</label>
          <select
            value={selectedStop}
            onChange={e => setSelectedStop(parseInt(e.target.value))}
          >
            {Array.from({ length: graph.nodes }, (_, i) => (
              <option key={i} value={i} disabled={stops.includes(i)}>
                {getNodeName(i)} {stops.includes(i) ? '✓ (Added)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: '0 0 auto', justifyContent: 'flex-end' }}>
          <label>&nbsp;</label>
          <button className="btn btn-secondary btn-sm" onClick={addStop}>+ Add Stop</button>
        </div>
      </div>

      {/* Stop chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {stops.map((s, i) => (
          <span key={i} style={{
            background: i === 0 ? '#064e3b' : '#1e293b',
            border: `1px solid ${i === 0 ? '#10b981' : '#38bdf8'}`,
            color: i === 0 ? '#6ee7b7' : '#38bdf8',
            borderRadius: '6px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.8rem',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            {i === 0 ? '🏢 Depot: ' : '📍 '}{getNodeName(s)}
            {i !== 0 && (
              <span
                style={{ cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}
                onClick={() => setStops(p => p.filter((_, j) => j !== i))}
              >✕</span>
            )}
          </span>
        ))}
      </div>

      <button
        className="btn btn-primary"
        disabled={loading || stops.length < 2}
        onClick={() => onOptimizeVrp(graph, stops, numVehicles, capacity)}
      >
        {loading
          ? <><span className="loading-spinner" />Dispatching Fleet...</>
          : '🚛 Optimize Multi-Vehicle Fleet'}
      </button>
    </div>
  );
}

