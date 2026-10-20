/*
 * models/RouteHistory.js
 *
 * MongoDB schema for saving route results.
 * Har baar route calculate hota hai, result yahan save hota hai.
 *
 * Interview answer: "MongoDB isliye choose kiya kyunki
 * route data flexible hota hai — alag alag graph sizes,
 * alag paths — relational schema mein fit nahi hota.
 * Document model is use case ke liye natural hai."
 */

const mongoose = require('mongoose');

const RouteHistorySchema = new mongoose.Schema({

  // Which algorithm was used
  algorithm: {
    type: String,
    enum: ['dijkstra', 'astar', 'compare', 'optimize', 'vrp'],
    required: true,
  },

  // Input graph snapshot
  graphSnapshot: {
    nodes: Number,
    edgeCount: Number,
    source: Number,
    destination: Number,
  },

  // Result
  result: {
    distance: Number,
    path: [Number],
    nodesVisited: Number,
    executionTimeMs: Number,
  },

  // For compare mode — both results
  compareResult: {
    dijkstra: mongoose.Schema.Types.Mixed,
    astar: mongoose.Schema.Types.Mixed,
    winner: String,
  },

  // For optimize mode
  optimizeResult: {
    nearestNeighborCost: Number,
    twoOptCost: Number,
    improvementPercent: Number,
  },

  // For VRP multi-vehicle fleet mode
  vrpResult: {
    totalFleetDistance: Number,
    maxRouteDistance: Number,
    vehicleCount: Number,
    routes: mongoose.Schema.Types.Mixed,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index on createdAt — history queries fastest
RouteHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('RouteHistory', RouteHistorySchema);
