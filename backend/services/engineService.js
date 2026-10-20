/*
 * services/engineService.js  (v2 — supports both modes)
 *
 * runShortestPath(graphData, algorithm)
 *   → calls C++ with mode=shortest
 *
 * runOptimize(graphData, stops)
 *   → calls C++ with mode=optimize (NN + 2-opt)
 *
 * runCompare(graphData)
 *   → runs shortest with both algorithms in parallel
 */

const { spawn } = require('child_process');
const path = require('path');
const { engineBreaker } = require('./circuitBreaker');

const ENGINE_PATH = path.join(__dirname, '..', '..', 'cpp-engine', 'route.exe');

// ─── Native process spawn runner ──────────────────────────────────
function runEngineNative(input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ENGINE_PATH);
    let out = '', err = '';

    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`Engine error: ${err}`));
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(new Error(`JSON parse failed: ${out}`));
      }
    });

    proc.on('error', e => reject(new Error(`Engine not found: ${e.message}`)));

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ─── Circuit-Breaker Protected Engine Runner ───────────────────────
function runEngine(input) {
  return engineBreaker.fire(
    () => runEngineNative(input),
    fallbackReason => {
      // In-Memory Fallback if C++ binary trips the circuit
      console.warn(`🛡️ Circuit Breaker fallback activated: ${fallbackReason}`);
      return {
        circuitBreakerFallback: true,
        reason: fallbackReason,
        distance: 12,
        path: [0, 2, 5],
        nodesVisited: 3,
        executionTimeMs: 0.5,
      };
    }
  );
}

// ─── Mode 1: Shortest Path ────────────────────────────────────────
function runShortestPath(graphData, algorithm = 'dijkstra') {
  const { nodes, edges, source, destination } = graphData;

  // Format:  shortest\nnodes edges source dest algo\nu v w\n...
  let input = `shortest\n${nodes} ${edges.length} ${source} ${destination} ${algorithm}\n`;
  for (const [u, v, w] of edges) input += `${u} ${v} ${w}\n`;

  return runEngine(input);
}

// ─── Mode 2: Compare Both Algorithms (Concurrent Multi-Threaded in C++) ──
function runCompare(graphData) {
  const { nodes, edges, source, destination } = graphData;

  // Format: compare\nnodes edges source dest\nu v w\n...
  let input = `compare\n${nodes} ${edges.length} ${source} ${destination}\n`;
  for (const [u, v, w] of edges) input += `${u} ${v} ${w}\n`;

  return runEngine(input);
}

// ─── Mode 3: Route Optimization (NN + 2-opt) ─────────────────────
function runOptimize(graphData, stops) {
  const { nodes, edges } = graphData;

  // Format:  optimize\nnodes edges numStops\nu v w\n...\ns0 s1 s2...
  let input = `optimize\n${nodes} ${edges.length} ${stops.length}\n`;
  for (const [u, v, w] of edges) input += `${u} ${v} ${w}\n`;
  input += stops.join(' ') + '\n';

  return runEngine(input);
}

// ─── Mode 4: Multi-Vehicle Capacitated VRP ───────────────────────
function runVrp(graphData, stops, numVehicles = 2, capacity = 4) {
  const { nodes, edges } = graphData;

  // Format:  vrp\nnodes edges numStops numVehicles capacity\nu v w\n...\ns0 s1 s2...
  let input = `vrp\n${nodes} ${edges.length} ${stops.length} ${numVehicles} ${capacity}\n`;
  for (const [u, v, w] of edges) input += `${u} ${v} ${w}\n`;
  input += stops.join(' ') + '\n';

  return runEngine(input);
}

// ─── Mode 5: Minimum Spanning Tree (Kruskal's MST with DSU) ──────
function runMst(graphData) {
  const { nodes, edges } = graphData;

  // Format: mst\nnodes edges\nu v w\n...
  let input = `mst\n${nodes} ${edges.length}\n`;
  for (const [u, v, w] of edges) input += `${u} ${v} ${w}\n`;

  return runEngine(input);
}

module.exports = { runShortestPath, runCompare, runOptimize, runVrp, runMst, engineBreaker };
