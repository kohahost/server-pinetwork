// File: server.js

// =================================================================
// 0. IMPOR MODUL & MUAT KONFIGURASI
// =================================================================
require('dotenv').config(); // Muat variabel dari file .env

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Bottleneck = require('bottleneck');
const os = require('os'); // Modul untuk mendapatkan info sistem seperti IP

// =================================================================
// 1. AMBIL KONFIGURASI DARI FILE .env
// =================================================================
const PORT = process.env.PORT || 31401;
const TARGET_SERVER_URL = process.env.TARGET_SERVER_URL;
const REQUESTS_PER_SECOND = parseInt(process.env.REQUESTS_PER_SECOND || '100', 10);

if (!TARGET_SERVER_URL) {
  console.error("Kesalahan: TARGET_SERVER_URL tidak diatur di file .env. Harap periksa file .env Anda.");
  process.exit(1); // Keluar jika URL target tidak ada
}

// =================================================================
// 2. BUAT RATE LIMITER (ANTRIAN)
// =================================================================
const minTime = 1000 / REQUESTS_PER_SECOND;
const limiter = new Bottleneck({
  minTime: minTime 
});

// Log status antrian secara berkala untuk monitoring
setInterval(() => {
  const counts = limiter.counts();
  console.log(`[QUEUE_STATUS] Running: ${counts.RUNNING}, Queued: ${counts.QUEUED}, Done: ${counts.DONE}`);
}, 5000); // Cek setiap 5 detik

// =================================================================
// 3. SIAPKAN SERVER EXPRESS & MIDDLEWARE
// =================================================================
const app = express();

// Middleware untuk mencatat setiap permintaan yang masuk
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = new Date().toISOString();
  console.log(`[${now}] [REQUEST_IN] ${ip} - ${req.method} ${req.originalUrl}`);
  next();
});

// Konfigurasi middleware proxy
const proxyMiddleware = createProxyMiddleware({
  target: TARGET_SERVER_URL,
  changeOrigin: true,
  secure: false, // Izinkan proxy ke target dengan sertifikat self-signed
  onError: (err, req, res) => {
    console.error('[PROXY ERROR]', err.message);
    if (!res.headersSent) {
      res.status(502).send('Proxy Error: Tidak dapat terhubung ke server target.');
    }
  }
});

// Middleware utama yang menggabungkan antrian dan proxy
app.use('/', (req, res) => {
  // Jadwalkan permintaan untuk diproses oleh proxy
  limiter.schedule(() => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[REQUEST_PROCESS] Melepaskan request dari antrian: ${ip} - ${req.method} ${req.originalUrl}`);
    // Panggil middleware proxy setelah lolos dari antrian
    proxyMiddleware(req, res);
  }).catch(err => {
    // Penanganan jika scheduler gagal (misalnya saat server sedang dimatikan)
    console.error('[SCHEDULER_ERROR]', err);
    if (!res.headersSent) {
      res.status(529).send('Server sedang sibuk, silakan coba lagi nanti.'); // HTTP 529 Site is overloaded
    }
  });
});

// =================================================================
// 4. FUNGSI BANTUAN & JALANKAN SERVER
// =================================================================

// Fungsi untuk mendapatkan Alamat IP Lokal server
function getLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    for (const anInterface of networkInterface) {
      // Lewati alamat internal (seperti 127.0.0.1) dan non-IPv4
      if (anInterface.family === 'IPv4' && !anInterface.internal) {
        return anInterface.address;
      }
    }
  }
  return null;
}

// Jalankan server
const server = app.listen(PORT, () => {
  const localIp = getLocalIpAddress();

  console.log('==============================================');
  console.log('🚀 PROXY SERVER ANDA SUDAH AKTIF');
  console.log('----------------------------------------------');
  console.log('Alamat untuk mengakses proxy:');
  console.log(`   - Dari Komputer Ini (Local): http://localhost:${PORT}`);
  if (localIp) {
    console.log(`   - Dari Jaringan Lokal (LAN): http://${localIp}:${PORT}`);
  }
  console.log('----------------------------------------------');
  console.log(`➡️  Meneruskan ke target: ${TARGET_SERVER_URL}`);
  console.log(`⏱️  Rate Limit yang diterapkan: ${REQUESTS_PER_SECOND} request/detik`);
  console.log('==============================================');
});

// =================================================================
// 5. TANGANI GRACEFUL SHUTDOWN (MATI SECARA AMAN)
// =================================================================
const gracefulShutdown = () => {
  console.log('\n[SERVER_SHUTDOWN] Menerima sinyal untuk mematikan server.');
  console.log('[SERVER_SHUTDOWN] Menyelesaikan permintaan yang tersisa di antrian...');
  
  // Beri waktu 10 detik untuk menyelesaikan antrian sebelum mematikan paksa
  limiter.disconnect(10000).then(() => {
    console.log('[QUEUE_STATUS] Semua antrian telah selesai diproses.');
    server.close(() => {
      console.log('[SERVER_SHUTDOWN] Server berhasil dimatikan.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[SERVER_SHUTDOWN] Gagal mematikan server dengan baik, mematikan secara paksa.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown); // Sinyal mati dari 'kill' atau orchestrator (Docker, Kubernetes)
process.on('SIGINT', gracefulShutdown);  // Sinyal mati dari Ctrl+C di terminal
