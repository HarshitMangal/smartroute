/*
 * routes/route.js  (v2)
 *
 * POST /api/route          — shortest path (Dijkstra or A*)
 * POST /api/route/compare  — Dijkstra vs A* comparison
 * POST /api/route/optimize — NN + 2-opt delivery ordering
 * GET  /api/route/history  — last 20 routes from MongoDB
 */

const express      = require('express');
const router       = express.Router();
const { runShortestPath, runCompare, runOptimize, runVrp, runMst, engineBreaker } = require('../services/engineService');
const RouteHistory = require('../models/RouteHistory');
const { generateRouteKey, getCache, setCache, getCacheStatus } = require('../services/redisService');

// ─── GET /api/route/circuit-status ────────────────────────────────
router.get('/circuit-status', (req, res) => {
  res.json({ success: true, data: engineBreaker.getStatus() });
});

// ─── GET /api/route/cache-status ──────────────────────────────────
router.get('/cache-status', (req, res) => {
  res.json({ success: true, data: getCacheStatus() });
});

// ─── Validation helper ────────────────────────────────────────────
function validateGraph(body) {
  const { nodes, edges, source, destination } = body;
  if (typeof nodes !== 'number' || nodes < 2)
    return 'nodes must be >= 2';
  if (!Array.isArray(edges) || edges.length === 0)
    return 'edges must be a non-empty array';
  if (typeof source !== 'number' || source < 0 || source >= nodes)
    return `source must be 0..${nodes - 1}`;
  if (typeof destination !== 'number' || destination < 0 || destination >= nodes)
    return `destination must be 0..${nodes - 1}`;
  if (source === destination)
    return 'source and destination must differ';
  for (let i = 0; i < edges.length; i++) {
    const [u, v, w] = edges[i];
    if (u < 0 || u >= nodes || v < 0 || v >= nodes)
      return `edge[${i}] node out of range`;
    if (w < 0)
      return `edge[${i}] negative weight not allowed`;
  }
  return null;
}

// ─── POST /api/route ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { nodes, edges, source, destination, algorithm = 'dijkstra' } = req.body;
  const err = validateGraph(req.body);
  if (err) return res.status(400).json({ success: false, error: err });
  if (!['dijkstra', 'astar'].includes(algorithm))
    return res.status(400).json({ success: false, error: 'algorithm must be dijkstra or astar' });

  // 1. Check Redis Cache
  const cacheKey = generateRouteKey('shortest', { nodes, edges, source, destination }, algorithm);
  const cachedData = await getCache(cacheKey);
  if (cachedData) {
    return res.json({
      success: true,
      data: { ...cachedData, cached: true, cacheSource: 'Redis In-Memory' },
    });
  }

  try {
    const result = await runShortestPath({ nodes, edges, source, destination }, algorithm);
    if (result.distance === -1)
      return res.status(404).json({ success: false, error: 'No route found' });

    // 2. Save in Redis Cache for 1 Hour
    await setCache(cacheKey, result, 3600);

    // Save to MongoDB (non-blocking — don't await to keep response fast)
    RouteHistory.create({
      algorithm,
      graphSnapshot: { nodes, edgeCount: edges.length, source, destination },
      result: {
        distance: result.distance,
        path: result.path,
        nodesVisited: result.nodesVisited,
        executionTimeMs: result.executionTimeMs,
      },
    }).catch(e => console.warn('History save failed:', e.message));

    res.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Engine error' });
  }
});

// ─── POST /api/route/compare ──────────────────────────────────────
router.post('/compare', async (req, res) => {
  const { nodes, edges, source, destination } = req.body;
  const err = validateGraph(req.body);
  if (err) return res.status(400).json({ success: false, error: err });

  try {
    const data = await runCompare({ nodes, edges, source, destination });

    RouteHistory.create({
      algorithm: 'compare',
      graphSnapshot: { nodes, edgeCount: edges.length, source, destination },
      compareResult: data,
    }).catch(e => console.warn('History save failed:', e.message));

    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Engine error' });
  }
});

// ─── POST /api/route/optimize ─────────────────────────────────────
// Body: { nodes, edges, stops: [nodeId, ...] }
// stops = list of delivery stop node IDs (subset of graph nodes)
router.post('/optimize', async (req, res) => {
  const { nodes, edges, stops } = req.body;

  if (!Array.isArray(stops) || stops.length < 2)
    return res.status(400).json({ success: false, error: 'stops must have >= 2 items' });

  // Validate stops are valid node IDs
  for (const s of stops) {
    if (typeof s !== 'number' || s < 0 || s >= nodes)
      return res.status(400).json({ success: false, error: `Invalid stop node: ${s}` });
  }

  // Validate graph edges (use source=0, dest=1 as dummy for validation)
  const dummyBody = { ...req.body, source: stops[0], destination: stops[1] };
  const err = validateGraph(dummyBody);
  if (err) return res.status(400).json({ success: false, error: err });

  try {
    const result = await runOptimize({ nodes, edges }, stops);

    RouteHistory.create({
      algorithm: 'optimize',
      graphSnapshot: { nodes, edgeCount: edges.length },
      optimizeResult: {
        nearestNeighborCost: result.nearestNeighborCost,
        twoOptCost: result.twoOptCost,
        improvementPercent: result.improvementPercent,
      },
    }).catch(e => console.warn('History save failed:', e.message));

    res.json({ success: true, data: result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: 'Engine error' });
  }
});

// ─── POST /api/route/vrp ─────────────────────────────────────────
// Body: { nodes, edges, stops, numVehicles, capacity }
router.post('/vrp', async (req, res) => {
  const { nodes, edges, stops, numVehicles = 2, capacity = 4 } = req.body;

  if (!Array.isArray(stops) || stops.length < 2)
    return res.status(400).json({ success: false, error: 'stops must have >= 2 items' });

  for (const s of stops) {
    if (typeof s !== 'number' || s < 0 || s >= nodes)
      return res.status(400).json({ success: false, error: `Invalid stop node: ${s}` });
  }

  const dummyBody = { ...req.body, source: stops[0], destination: stops[1] };
  const err = validateGraph(dummyBody);
  if (err) return res.status(400).json({ success: false, error: err });

  try {
    const result = await runVrp({ nodes, edges }, stops, numVehicles, capacity);

    RouteHistory.create({
      algorithm: 'vrp',
      graphSnapshot: { nodes, edgeCount: edges.length },
      vrpResult: {
        totalFleetDistance: result.totalFleetDistance,
        maxRouteDistance: result.maxRouteDistance,
        vehicleCount: numVehicles,
        routes: result.routes,
      },
    }).catch(e => console.warn('History save failed:', e.message));

    res.json({ success: true, data: result });
  } catch (e) {
    console.error('VRP error:', e);
    res.status(500).json({ success: false, error: 'Engine error during VRP' });
  }
});

// ─── GET /api/route/history ───────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const history = await RouteHistory
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-__v');
    res.json({ success: true, data: history });
  } catch (e) {
    // MongoDB not connected — return empty gracefully
    res.json({ success: true, data: [], message: 'MongoDB not connected' });
  }
});

// ─── POST /api/route/mst ─────────────────────────────────────────
// Kruskal's Minimum Spanning Tree with Disjoint Set Union (DSU)
router.post('/mst', async (req, res) => {
  const { nodes, edges } = req.body;
  if (!Array.isArray(edges) || edges.length === 0) {
    return res.status(400).json({ success: false, error: 'edges must be a non-empty array' });
  }

  try {
    const result = await runMst({ nodes, edges });
    res.json({ success: true, data: result });
  } catch (e) {
    console.error('MST error:', e);
    res.status(500).json({ success: false, error: 'Engine error during MST' });
  }
});

module.exports = router;
