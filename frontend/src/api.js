// api.js — v2 (all endpoints)
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

export async function calculateRoute(graphData, algorithm = 'dijkstra') {
  const res = await axios.post(`${BASE_URL}/api/route`, { ...graphData, algorithm });
  return res.data;
}

export async function compareAlgorithms(graphData) {
  const res = await axios.post(`${BASE_URL}/api/route/compare`, graphData);
  return res.data;
}

// Delivery stop optimization — Nearest Neighbor + 2-opt
export async function optimizeRoute(graphData, stops) {
  const res = await axios.post(`${BASE_URL}/api/route/optimize`, { ...graphData, stops });
  return res.data;
}

// Multi-Vehicle Fleet Routing (CVRP)
export async function optimizeVrp(graphData, stops, numVehicles = 2, capacity = 4) {
  const res = await axios.post(`${BASE_URL}/api/route/vrp`, {
    ...graphData,
    stops,
    numVehicles,
    capacity,
  });
  return res.data;
}

// Minimum Spanning Tree (Kruskal's MST with DSU)
export async function calculateMst(graphData) {
  const res = await axios.post(`${BASE_URL}/api/route/mst`, graphData);
  return res.data;
}

// Circuit Breaker Status
export async function getCircuitStatus() {
  const res = await axios.get(`${BASE_URL}/api/route/circuit-status`);
  return res.data;
}

export async function getHistory() {
  const res = await axios.get(`${BASE_URL}/api/route/history`);
  return res.data;
}

// ─── Authentication APIs ───────────────────────────────────────
export async function loginUser(email, password) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
  if (res.data.success && res.data.data.token) {
    localStorage.setItem('sr_token', res.data.data.token);
    localStorage.setItem('sr_user', JSON.stringify(res.data.data.user));
  }
  return res.data;
}

export async function verifyMfaCode(userId, token) {
  const res = await axios.post(`${BASE_URL}/api/auth/verify-mfa`, { userId, token });
  if (res.data.success && res.data.data.token) {
    localStorage.setItem('sr_token', res.data.data.token);
    localStorage.setItem('sr_user', JSON.stringify(res.data.data.user));
  }
  return res.data;
}

export async function registerUser(name, email, password, role = 'admin') {
  const res = await axios.post(`${BASE_URL}/api/auth/register`, { name, email, password, role });
  return res.data;
}

export function getStoredUser() {
  const user = localStorage.getItem('sr_user');
  return user ? JSON.parse(user) : null;
}

export function logoutUser() {
  localStorage.removeItem('sr_token');
  localStorage.removeItem('sr_user');
}

export async function checkHealth() {
  const res = await axios.get(`${BASE_URL}/health`);
  return res.data;
}
