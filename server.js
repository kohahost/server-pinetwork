// =================================================================
// 0. IMPOR MODUL
// =================================================================
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const Bottleneck = require('bottleneck');
const http = require('http'); // Modul inti untuk optimisasi koneksi

// =================================================================
// 1. AMBIL KONFIGURASI DARI PM2 (ENVIRONMENT VARIABLES)
// =================================================================
// Pengaturan ini diambil dari file ecosystem.config.js
const PORT = process.env.PORT || 31401;
const TARGET_SERVER_URL = process.env.TARGET_SERVER_URL;
const REQUESTS_PER_SECOND = parseInt(process.env.REQUESTS_PER_SECOND || '100', 10);
const ENABLE_LOGGING = process.env.ENABLE_LOGGING === 'true'; // Mengontrol semua logging

// Validasi konfigurasi penting
if (!TARGET_SERVER_URL) {
  console.error(`[PID: ${process.pid}] KESALAHAN FATAL: TARGET_SERVER_URL tidak diatur di file konfigurasi.`);
  process.exit(1); // Keluar jika konfigurasi utama tidak ada
}

// =================================================================
// 2. OPTIMISASI KONEKSI DENGAN HTTP AGENT (KUNCI UTAMA KECEPATAN)
// =================================================================
// Ini membuat koneksi ke server target tetap terbuka (Keep-Alive) dan
// digunakan kembali. Menghilangkan waktu "jabat tangan" TCP/TLS yang mahal.
const httpAgent = new http.Agent({
  keepAlive: true,       // Jaga koneksi tetap hidup! Ini SANGAT PENTING.
  maxSockets: 200,       // Jumlah koneksi simultan maksimum yang diizinkan ke server target.
  maxFreeSockets: 20,    // Jumlah koneksi cadangan yang tetap terbuka & siap pakai.
  timeout: 60000,        // Timeout koneksi dalam milidetik.
  keepAliveMsecs: 30000  // Seberapa sering mengirim sinyal keep-alive untuk mencegah koneksi ditutup oleh server target.
});

// =================================================================
// 3. BUAT RATE LIMITER (PENGATUR ANTRIAN)
// =================================================================
const minTime = 1000 / REQUESTS_PER_SECOND;
const limiter = new Bottleneck({ minTime: minTime });

// Hanya jalankan logging status jika diaktifkan, untuk menghemat resource CPU.
if (ENABLE_LOGGING) {
  setInterval(() => {
    const counts = limiter.counts();
    console.log(`[PID: ${process.pid}] [QUEUE] Running: ${counts.RUNNING}, Queued: ${counts.QUEUED}, Done: ${counts.DONE}`);
  }, 5000);
}

// =================================================================
// 4. SIAPKAN SERVER EXPRESS YANG SUDAH DI-TUNING
// =================================================================
const app = express();
app.disable('x-powered-by'); // Optimisasi kecil: matikan header yang tidak perlu.

// Middleware untuk mencatat setiap permintaan yang masuk (jika diaktifkan)
if (ENABLE_LOGGING) {
  app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    // Log ini akan muncul setiap ada request yang masuk
    console.log(`[PID: ${process.pid}] [REQUEST_IN] ${ip} - ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Konfigurasi proxy yang sudah di-tuning untuk menggunakan agent kita
const proxyMiddleware = createProxyMiddleware({
  target: TARGET_SERVER_URL,
  changeOrigin: true,
  agent: httpAgent, // <<< INI YANG MEMBUATNYA SANGAT CEPAT
  secure: false,
  logLevel: 'silent', // Matikan log bawaan dari proxy middleware agar tidak duplikat
  onError: (err, req, res) => {
    if (ENABLE_LOGGING) console.error(`[PID: ${process.pid}] [PROXY ERROR] ${err.message}`);
    if (!res.headersSent) {
      res.status(502).send('Proxy Error: Bad Gateway');
    }
  }
});

// Middleware utama: Semua request masuk ke sini, dijadwalkan, lalu diproses.
app.use('/', (req, res) => {
  limiter.schedule(() => proxyMiddleware(req, res))
    .catch(err => {
      // Terjadi jika scheduler error, jarang terjadi kecuali saat server shutdown.
      if (ENABLE_LOGGING) console.error(`[PID: ${process.pid}] [SCHEDULER ERROR] ${err.message}`);
      if (!res.headersSent) {
        res.status(529).send('Server Overloaded');
      }
    });
});

// =================================================================
// 5. JALANKAN SERVER
// =================================================================
const server = app.listen(PORT, () => {
    console.log('==============================================');
    console.log(`🚀 Proxy Tempur Siap di Port ${PORT} | Worker PID: ${process.pid}`);
    // Log detail hanya akan muncul sekali dari worker pertama untuk kebersihan log
    if (process.env.NODE_APP_INSTANCE === '0' || !process.env.NODE_APP_INSTANCE) {
        console.log(`➡️  Menargetkan: ${TARGET_SERVER_URL}`);
        console.log(`⏱️  Rate Limit: ${REQUESTS_PER_SECOND} req/detik`);
        console.log(`⚡ Mode Logging: ${ENABLE_LOGGING ? 'AKTIF' : 'NON-AKTIF (PERFORMA MAKSIMAL)'}`);
    }
    console.log('==============================================');
});

// =================================================================
// 6. TANGANI GRACEFUL SHUTDOWN (MATI SECARA AMAN)
// =================================================================
const gracefulShutdown = () => {
  console.log(`\n[PID: ${process.pid}] Menerima sinyal untuk mematikan server...`);
  console.log(`[PID: ${process.pid}] Menyelesaikan permintaan yang tersisa di antrian...`);
  
  // Beri waktu 10 detik untuk menyelesaikan antrian sebelum mematikan paksa
  limiter.disconnect(10000).then(() => {
    console.log(`[PID: ${process.pid}] Semua antrian telah selesai.`);
    server.close(() => {
      console.log(`[PID: ${process.pid}] Server berhasil dimatikan.`);
      process.exit(0);
    });
  });
};

// Sinyal mati dari 'kill' atau orchestrator (Docker, Kubernetes)
process.on('SIGTERM', gracefulShutdown);
// Sinyal mati dari Ctrl+C di terminal
process.on('SIGINT', gracefulShutdown);
