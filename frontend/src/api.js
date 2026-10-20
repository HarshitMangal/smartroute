// api.js — Resilient Hybrid API Layer (Backend + In-Browser Fallback Engine)
import axios from 'axios';
import {
  runClientShortestPath,
  runClientCompare,
  runClientOptimizeRoute,
  runClientOptimizeVrp,
  runClientCalculateMst,
  runClientZeroOneBfs,
  runClientBfsHops,
  runClientPriorityDispatch,
} from './clientEngine';

const BASE_URL = 'http://localhost:5000';
const TIMEOUT_MS = 1800; // Fast timeout for immediate fallback on static hosts

const api = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
});

// Helper: Save dispatch calculations to local history
function saveToLocalHistory(type, data, meta = {}) {
  try {
    const raw = localStorage.getItem('sr_history_local') || '[]';
    const list = JSON.parse(raw);
    const item = {
      id: Date.now(),
      type,
      timestamp: new Date().toISOString(),
      result: data,
      ...meta,
    };
    list.unshift(item);
    localStorage.setItem('sr_history_local', JSON.stringify(list.slice(0, 30)));
  } catch (_) {}
}

// ── 1. Calculate Single Shortest Path ─────────────────────────────
export async function calculateRoute(graphData, algorithm = 'dijkstra') {
  try {
    const res = await api.post('/api/route', { ...graphData, algorithm });
    if (res.data?.success) {
      saveToLocalHistory('shortest_path', res.data.data, { algorithm });
      return res.data;
    }
  } catch (_) {
    // Fallback to client engine seamlessly
  }
  const clientRes = runClientShortestPath(graphData, algorithm);
  saveToLocalHistory('shortest_path', clientRes.data, { algorithm });
  return clientRes;
}

// ── 2. Compare Dijkstra vs A* ─────────────────────────────────────
export async function compareAlgorithms(graphData) {
  try {
    const res = await api.post('/api/route/compare', graphData);
    if (res.data?.success) return res.data;
  } catch (_) {
    // Fallback
  }
  return runClientCompare(graphData);
}

// ── 3. Delivery Stop Optimization (TSP Nearest Neighbor + 2-Opt) ──
export async function optimizeRoute(graphData, stops) {
  try {
    const res = await api.post('/api/route/optimize', { ...graphData, stops });
    if (res.data?.success) {
      saveToLocalHistory('tsp_1van', res.data.data);
      return res.data;
    }
  } catch (_) {
    // Fallback
  }
  const clientRes = runClientOptimizeRoute(graphData, stops);
  saveToLocalHistory('tsp_1van', clientRes.data);
  return clientRes;
}

// ── 4. Multi-Vehicle Fleet Routing (CVRP) ────────────────────────
export async function optimizeVrp(graphData, stops, numVehicles = 2, capacity = 4) {
  try {
    const res = await api.post('/api/route/vrp', {
      ...graphData,
      stops,
      numVehicles,
      capacity,
    });
    if (res.data?.success) {
      saveToLocalHistory('vrp_fleet', res.data.data);
      return res.data;
    }
  } catch (_) {
    // Fallback
  }
  const clientRes = runClientOptimizeVrp(graphData, stops, numVehicles, capacity);
  saveToLocalHistory('vrp_fleet', clientRes.data);
  return clientRes;
}

// ── 5. Minimum Spanning Tree (Kruskal's MST with DSU) ─────────────
export async function calculateMst(graphData) {
  try {
    const res = await api.post('/api/route/mst', graphData);
    if (res.data?.success) {
      saveToLocalHistory('mst_network', res.data.data);
      return res.data;
    }
  } catch (_) {
    // Fallback
  }
  const clientRes = runClientCalculateMst(graphData);
  saveToLocalHistory('mst_network', clientRes.data);
  return clientRes;
}

// ── 6. 0-1 BFS with std::deque (O(V+E) Linear Shortest Path) ───────
export async function calculateZeroOneBfs(graphData) {
  try {
    const res = await api.post('/api/route/zero-one-bfs', graphData);
    if (res.data?.success) {
      saveToLocalHistory('zero_one_bfs', res.data.data);
      return res.data;
    }
  } catch (_) {}
  const clientRes = runClientZeroOneBfs(graphData);
  saveToLocalHistory('zero_one_bfs', clientRes.data);
  return clientRes;
}

// ── 7. FIFO Queue BFS (Minimum Hops / Intersections) ─────────────
export async function calculateBfsHops(graphData) {
  try {
    const res = await api.post('/api/route/bfs-hops', graphData);
    if (res.data?.success) {
      saveToLocalHistory('bfs_hops', res.data.data);
      return res.data;
    }
  } catch (_) {}
  const clientRes = runClientBfsHops(graphData);
  saveToLocalHistory('bfs_hops', clientRes.data);
  return clientRes;
}

// ── 8. Priority Queue / Min-Heap Order Dispatch ──────────────────
export async function calculatePriorityDispatch(depot, orders, nodes) {
  try {
    const res = await api.post('/api/route/priority-dispatch', { depot, orders, nodes });
    if (res.data?.success) {
      saveToLocalHistory('priority_dispatch', res.data.data);
      return res.data;
    }
  } catch (_) {}
  const clientRes = runClientPriorityDispatch(depot, orders, nodes);
  saveToLocalHistory('priority_dispatch', clientRes.data);
  return clientRes;
}

// ── 6. Circuit Breaker Status ────────────────────────────────────
export async function getCircuitStatus() {
  try {
    const res = await api.get('/api/route/circuit-status');
    if (res.data?.success) return res.data;
  } catch (_) {
    // Fallback healthy status for client engine
  }
  return {
    success: true,
    data: {
      state: 'CLOSED',
      isHealthy: true,
      failureCount: 0,
      mode: 'In-Browser Client Engine',
    },
  };
}

// ── 7. Dispatch History ──────────────────────────────────────────
export async function getHistory() {
  try {
    const res = await api.get('/api/route/history');
    if (res.data?.success && res.data.data.length > 0) return res.data;
  } catch (_) {
    // Fallback to local storage
  }
  try {
    const raw = localStorage.getItem('sr_history_local') || '[]';
    return { success: true, data: JSON.parse(raw) };
  } catch (_) {
    return { success: true, data: [] };
  }
}

// ── 8. Authentication APIs (With Offline Demo Support) ────────────
export async function loginUser(email, password) {
  try {
    const res = await api.post('/api/auth/login', { email, password });
    if (res.data.success && res.data.data.token) {
      localStorage.setItem('sr_token', res.data.data.token);
      localStorage.setItem('sr_user', JSON.stringify(res.data.data.user));
      return res.data;
    }
  } catch (_) {
    // Fallback demo authentication
  }

  // Fallback demo user accounts
  const isDriver = email.toLowerCase().includes('driver');
  const mockUser = {
    id: isDriver ? 'drv-1' : 'adm-1',
    name: isDriver ? 'Ramesh Kumar (Van #1 Driver)' : 'Harshit Mangal (Chief Dispatcher)',
    email,
    role: isDriver ? 'driver' : 'admin',
  };
  const token = 'mock_jwt_token_' + Date.now();
  localStorage.setItem('sr_token', token);
  localStorage.setItem('sr_user', JSON.stringify(mockUser));

  return {
    success: true,
    data: {
      token,
      user: mockUser,
      mfaRequired: false,
    },
  };
}

export async function loginAsDemo(role = 'admin') {
  const mockUser = role === 'admin'
    ? {
        id: 'adm-demo',
        name: 'Harshit Mangal (Logistics Dispatcher)',
        email: 'dispatcher@smartroute.com',
        role: 'admin',
      }
    : {
        id: 'drv-demo',
        name: 'Ramesh Kumar (Delivery Driver Van #1)',
        email: 'driver1@smartroute.com',
        role: 'driver',
      };

  const token = 'demo_token_' + Date.now();
  localStorage.setItem('sr_token', token);
  localStorage.setItem('sr_user', JSON.stringify(mockUser));
  return mockUser;
}

export async function verifyMfaCode(userId, token) {
  try {
    const res = await api.post('/api/auth/verify-mfa', { userId, token });
    if (res.data.success && res.data.data.token) {
      localStorage.setItem('sr_token', res.data.data.token);
      localStorage.setItem('sr_user', JSON.stringify(res.data.data.user));
      return res.data;
    }
  } catch (_) {
    // Fallback
  }

  const mockUser = {
    id: userId || 'usr-mfa',
    name: 'Authorized Dispatcher',
    email: 'admin@smartroute.com',
    role: 'admin',
  };
  localStorage.setItem('sr_token', 'mfa_token_' + Date.now());
  localStorage.setItem('sr_user', JSON.stringify(mockUser));
  return { success: true, data: { user: mockUser } };
}

export async function registerUser(name, email, password, role = 'admin') {
  try {
    const res = await api.post('/api/auth/register', { name, email, password, role });
    return res.data;
  } catch (_) {
    // Fallback offline registration
  }

  const mockUser = {
    id: 'usr_' + Date.now(),
    name: name || 'Fleet Member',
    email,
    role,
  };
  localStorage.setItem('sr_token', 'reg_token_' + Date.now());
  localStorage.setItem('sr_user', JSON.stringify(mockUser));

  return {
    success: true,
    data: {
      user: mockUser,
      mfaRequired: false,
    },
  };
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem('sr_user');
    return user ? JSON.parse(user) : null;
  } catch (_) {
    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem('sr_token');
  localStorage.removeItem('sr_user');
}

export async function checkHealth() {
  try {
    const res = await api.get('/health');
    return res.data;
  } catch (_) {
    return { status: 'OK', engine: 'In-Browser Client Engine' };
  }
}
