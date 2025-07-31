// server.js

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Bottleneck = require('bottleneck');

const app = express();
const PORT = process.env.PORT || 5000;

// Target server tujuan (contoh: node Pi Network)
const TARGET_SERVER_URL = 'http://113.160.156.51:31401';

// ==============================
// 1. BUAT RATE LIMIT: 100 REQ/DETIK
// ==============================
const limiter = new Bottleneck({
  minTime: 10 // 100 req/detik = 1 request setiap 10ms
});

// ==============================
// 2. LOG IP & METODE REQUEST
// ==============================
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = new Date().toISOString();
  console.log(`[${now}] ${ip} - ${req.method} ${req.originalUrl}`);
  next();
});

// ==============================
// 3. PROXY + RATE LIMIT
// ==============================
app.use('/', (req, res, next) => {
  limiter.schedule(() => new Promise(resolve => {
    next();
    resolve();
  }));
});

app.use('/', createProxyMiddleware({
  target: TARGET_SERVER_URL,
  changeOrigin: true,
  secure: false, // allow IP HTTPS
  onError: (err, req, res) => {
    console.error('[PROXY ERROR]', err.message);
    res.status(500).send('Proxy Error');
  }
}));

// ==============================
// 4. JALANKAN SERVER
// ==============================
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 Proxy aktif di: http://localhost:${PORT}`);
  console.log(`➡️ Meneruskan ke: ${TARGET_SERVER_URL}`);
  console.log('==============================================');
});
