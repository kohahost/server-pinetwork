// server.js

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Ganti ini dengan server target
const TARGET_SERVER_URL = 'https://178.128.176.205/';

// Middleware untuk log IP dan request
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[${new Date().toISOString()}] ${ip} - ${req.method} ${req.originalUrl}`);
  next();
});

// Middleware proxy: teruskan semua request ke server target
app.use('/', createProxyMiddleware({
  target: TARGET_SERVER_URL,
  changeOrigin: true,
  secure: false, // abaikan SSL error karena IP
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] Meneruskan ${req.method} ${req.originalUrl}`);
  },
  onError: (err, req, res) => {
    console.error('[PROXY ERROR]', err.message);
    res.status(500).send('Proxy Error');
  }
}));

// Jalankan server
app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 Proxy aktif di: http://localhost:${PORT}`);
  console.log(`➡️ Meneruskan ke: ${TARGET_SERVER_URL}`);
  console.log('==============================================');
});
