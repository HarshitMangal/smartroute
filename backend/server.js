/*
 * server.js  (v2 — with MongoDB connection)
 */

require('dotenv').config();
const http       = require('http');
const express    = require('express');
const cors       = require('cors');
const mongoose   = require('mongoose');
const routeRouter = require('./routes/route');
const authRouter  = require('./routes/auth');
const { initSocket } = require('./services/socketService');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// Initialize WebSocket server
initSocket(server);

// ─── Middleware ───────────────────────────────────────────────────
app.use(express.json());
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], methods: ['GET','POST'] }));

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/route', routeRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SmartRoute backend running with WebSockets',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Server error' });
});

// ─── MongoDB + Server Start ───────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartroute';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.warn('⚠️  MongoDB not connected (routes still work):', err.message));

server.listen(PORT, () => {
  console.log(`\n🚀 SmartRoute backend: http://localhost:${PORT}`);
  console.log(`   Health:   http://localhost:${PORT}/health`);
  console.log(`   Routes:   http://localhost:${PORT}/api/route`);
  console.log(`   Socket:   ws://localhost:${PORT} (Live Telematics)\n`);
});

