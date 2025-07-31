// server.js

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Alamat server target Pi Network atau IP lain
const TARGET_SERVER_URL = 'https://178.128.176.205';

// Middleware untuk log IP dan permintaan
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;

  console.log(`[${now}] ${ip} - ${method} ${url}`);
  next();
});

// Middleware untuk meneruskan semua request ke server target
app.use('/', createProxyMiddleware({
  target: TARGET_SERVER_URL,
  changeOrigin: true,
  secure: false, // abaikan SSL error jika pakai IP
  onProxyReq: (proxyReq, req, res) => {
    // Bisa tambahkan log tambahan di sini kalau perlu
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
