/*
 * services/redisService.js
 * Redis Caching Layer with In-Memory Fallback
 *
 * How it works:
 * 1. Checks if Redis server is running (port 6379).
 * 2. If Redis is down/offline, gracefully falls back to an In-Memory LRU Map so app NEVER crashes.
 * 3. Cache Keys are computed using deterministic hashing of graph inputs:
 *    key = "route:shortest:{source}:{dest}:{algorithm}:{edgeHash}"
 * 4. TTL (Time-To-Live) = 3600 seconds (1 Hour).
 */

const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let redisClient = null;
let isRedisConnected = false;

// In-Memory Fast LRU Fallback Cache
const memoryCache = new Map();
const MEMORY_CACHE_LIMIT = 500;

try {
  redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  redisClient.connect()
    .then(() => {
      isRedisConnected = true;
      console.log('⚡ Redis Cache connected on port', REDIS_PORT);
    })
    .catch(() => {
      isRedisConnected = false;
      console.log('ℹ️  Redis not detected on localhost:6379. Using Fast In-Memory Fallback Cache.');
    });

  redisClient.on('error', () => {
    isRedisConnected = false;
  });
} catch (e) {
  isRedisConnected = false;
}

// ─── Generate deterministic Cache Key ────────────────────────────
function generateRouteKey(prefix, graphData, extra = '') {
  const { nodes, edges, source, destination } = graphData;
  const edgeSignature = edges.map(e => `${e[0]}-${e[1]}-${e[2]}`).sort().join('|');
  return `smartroute:${prefix}:${nodes}:${source}:${destination}:${extra}:${edgeSignature}`;
}

// ─── Get from Cache (Redis or In-Memory) ──────────────────────────
async function getCache(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch (e) {
      // Fall through to memoryCache
    }
  }

  // Memory fallback check
  const mem = memoryCache.get(key);
  if (mem && mem.expiry > Date.now()) {
    return mem.data;
  }
  return null;
}

// ─── Set in Cache (1 hour TTL) ───────────────────────────────────
async function setCache(key, data, ttlSeconds = 3600) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (e) {
      // ignore
    }
  }

  // Set in memory fallback
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

function getCacheStatus() {
  return {
    provider: isRedisConnected ? 'Redis (Port 6379)' : 'In-Memory RAM Cache (Auto-Fallback)',
    active: true,
  };
}

module.exports = {
  generateRouteKey,
  getCache,
  setCache,
  getCacheStatus,
};
