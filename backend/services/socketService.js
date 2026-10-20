/*
 * ============================================================================
 * 🌐 services/socketService.js — Real-Time WebSocket Telematics Engine
 * ============================================================================
 *
 * 🎓 INTERVIEW CONCEPTS (Computer Networks & Real-Time Distributed Systems):
 *
 * 1. FULL-DUPLEX PERSISTENT CONNECTION (WebSocket RFC 6455):
 *    - Unlike HTTP Request-Response (which requires repeated 3-way TCP handshakes),
 *      WebSockets upgrade an HTTP connection to a continuous bi-directional stream.
 *    - Ideal for high-frequency GPS telemetry (e.g., driver location broadcast at 5-10 Hz).
 *
 * 2. PUBLISH-SUBSCRIBE (Pub/Sub) BROADCASTING:
 *    - Dispatcher starts fleet -> Backend simulates vehicle movement physics ->
 *      Broadcasts real-time coordinates to all connected Dispatchers and Drivers.
 *
 * 3. REAL-WORLD PRODUCTION ARCHITECTURE (Uber / Swiggy / Blinkit style):
 *    - Driver GPS Ping -> Ingestion Gateway -> WebSocket Broadcast -> Map Canvas Re-render.
 * ============================================================================
 */

let io = null;
let activeSimulationTimer = null;
let simulationState = {
  isRunning: false,
  vehicles: [],
};

function initSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', socket => {
    console.log(`📡 WebSocket Client Connected: ${socket.id}`);

    // Send current simulation state to newly joined client
    socket.emit('simulation_state', simulationState);

    // ── Event: Start Fleet Delivery Simulation ──
    socket.on('start_simulation', data => {
      // data: { routes: [ { vehicleId, waypoints: [[lat, lng], ...], stopNames: [...] } ], speed: 1 }
      startFleetSimulation(data);
    });

    // ── Event: Pause Simulation ──
    socket.on('pause_simulation', () => {
      if (activeSimulationTimer) {
        clearInterval(activeSimulationTimer);
        activeSimulationTimer = null;
      }
      simulationState.isRunning = false;
      io.emit('simulation_state', simulationState);
      console.log('⏸ Fleet simulation paused');
    });

    // ── Event: Reset Simulation ──
    socket.on('reset_simulation', () => {
      resetFleetSimulation();
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket Client Disconnected: ${socket.id}`);
    });
  });

  return io;
}

function startFleetSimulation({ routes, speed = 1 }) {
  if (activeSimulationTimer) {
    clearInterval(activeSimulationTimer);
    activeSimulationTimer = null;
  }

  if (!routes || routes.length === 0) return;

  // Initialize vehicle states
  simulationState.isRunning = true;
  simulationState.vehicles = routes.map(r => ({
    vehicleId: r.vehicleId || 1,
    waypoints: r.waypoints || [],
    stopNames: r.stopNames || [],
    currentSegment: 0,
    segmentProgress: 0.0, // 0.0 to 1.0
    currentCoords: r.waypoints[0] || [26.2389, 73.0243],
    isCompleted: false,
    deliveredStops: [0], // depot is starting point
    currentSpeedKmH: Math.round(25 + Math.random() * 15),
  }));

  const tickRateMs = 100; // 10 ticks per second (10 Hz update frequency)
  const baseStep = 0.02 * Math.max(1, speed);

  activeSimulationTimer = setInterval(() => {
    let allFinished = true;

    simulationState.vehicles.forEach(v => {
      if (v.isCompleted || v.waypoints.length < 2) return;

      allFinished = false;
      v.segmentProgress += baseStep;

      const p1 = v.waypoints[v.currentSegment];
      const p2 = v.waypoints[v.currentSegment + 1];

      if (p1 && p2) {
        // Linear Interpolation (LERP) between coordinates
        const lat = p1[0] + (p2[0] - p1[0]) * v.segmentProgress;
        const lng = p1[1] + (p2[1] - p1[1]) * v.segmentProgress;
        v.currentCoords = [Number(lat.toFixed(6)), Number(lng.toFixed(6))];

        // Segment completed -> reached next stop
        if (v.segmentProgress >= 1.0) {
          v.segmentProgress = 0.0;
          v.currentSegment++;
          v.deliveredStops.push(v.currentSegment);

          // Emit delivery milestone event
          io.emit('delivery_milestone', {
            vehicleId: v.vehicleId,
            stopIndex: v.currentSegment,
            stopName: v.stopNames[v.currentSegment] || `Stop #${v.currentSegment}`,
          });

          // All waypoints covered
          if (v.currentSegment >= v.waypoints.length - 1) {
            v.isCompleted = true;
            v.currentCoords = v.waypoints[v.waypoints.length - 1];
          }
        }
      }
    });

    // Broadcast telemetry update to all connected clients
    io.emit('fleet_telemetry', {
      vehicles: simulationState.vehicles.map(v => ({
        vehicleId: v.vehicleId,
        currentCoords: v.currentCoords,
        currentSegment: v.currentSegment,
        isCompleted: v.isCompleted,
        deliveredStops: v.deliveredStops,
        currentSpeedKmH: v.currentSpeedKmH,
        nextStopName: v.stopNames[v.currentSegment + 1] || 'Final Destination',
      })),
      timestamp: Date.now(),
    });

    if (allFinished) {
      clearInterval(activeSimulationTimer);
      activeSimulationTimer = null;
      simulationState.isRunning = false;
      io.emit('simulation_completed', { message: 'All deliveries completed successfully!' });
      console.log('✅ All vehicles completed delivery runs!');
    }
  }, tickRateMs);

  io.emit('simulation_state', simulationState);
  console.log(`🚀 Fleet simulation started with ${routes.length} vehicle(s) at ${speed}x speed`);
}

function resetFleetSimulation() {
  if (activeSimulationTimer) {
    clearInterval(activeSimulationTimer);
    activeSimulationTimer = null;
  }
  simulationState.isRunning = false;
  simulationState.vehicles = [];
  if (io) {
    io.emit('simulation_state', simulationState);
  }
  console.log('⏹ Fleet simulation reset');
}

module.exports = { initSocket };
