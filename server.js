// server.js

// ======================================================
// 1. MENGIMPOR LIBRARY YANG DIBUTUHKAN
// ======================================================
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const apicache = require('apicache');

// ======================================================
// 2. KONFIGURASI DASAR APLIKASI
// ======================================================
// Inisialisasi aplikasi Express
const app = express();

// Tentukan port untuk server proxy Anda. Anda bisa menggantinya jika perlu.
const PORT = process.env.PORT || 5000;

// Alamat server target yang akan di-proxy
const TARGET_SERVER_URL = 'https://178.128.176.205/';

// Tentukan durasi cache. '10 seconds' adalah waktu yang baik untuk data blockchain.
// Format lain: '1 minute', '5 minutes', '1 hour'
const CACHE_DURATION = '10 seconds';

// ======================================================
// 3. KONFIGURASI PROXY DAN CACHE
// ======================================================
// Inisialisasi middleware cache
const cache = apicache.middleware;

// Konfigurasi untuk http-proxy-middleware
const proxyOptions = {
  // URL server target
  target: TARGET_SERVER_URL,
  
  // Wajib diubah ke 'true'. Ini akan mengubah header 'Host' pada request
  // agar cocok dengan nama host server target.
  changeOrigin: true,

  // PENTING: Karena target menggunakan HTTPS dengan alamat IP, seringkali ada
  // masalah validasi sertifikat SSL. Opsi 'secure: false' akan mengabaikan
  // error validasi sertifikat (seperti UNABLE_TO_VERIFY_LEAF_SIGNATURE).
  secure: false,

  // (Opsional) Fungsi ini akan berjalan setiap kali request diteruskan.
  // Berguna untuk logging atau debugging.
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[LOG] Meneruskan request ke target: ${req.method} ${req.originalUrl}`);
  },

  // (Opsional) Fungsi untuk menangani error pada proxy
  onError: (err, req, res) => {
    console.error('[ERROR] Terjadi masalah pada proxy:', err);
    res.status(500).send('Proxy Error: Terjadi masalah saat menghubungi server target.');
  }
};

// ======================================================
// 4. MENERAPKAN MIDDLEWARE KE APLIKASI EXPRESS
// ======================================================
// Buat instance proxy dengan konfigurasi di atas
const apiProxy = createProxyMiddleware(proxyOptions);

// PENTING: Urutan middleware sangat berpengaruh.
// 1. Terapkan cache terlebih dahulu untuk semua request yang masuk.
//    Hanya request metode GET yang akan di-cache secara default.
app.use(cache(CACHE_DURATION));

// 2. Terapkan proxy setelah cache. Jika request ada di cache,
//    maka middleware proxy ini tidak akan pernah dijalankan.
//    '/' berarti semua path akan di-proxy (misal: /transactions, /accounts/123, dll)
app.use('/', apiProxy);

// ======================================================
// 5. MENJALANKAN SERVER
// ======================================================
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 Server Proxy Siap!`);
  console.log(`  - Server berjalan di: http://localhost:${PORT}`);
  console.log(`  - Meneruskan ke:    ${TARGET_SERVER_URL}`);
  console.log(`  - Durasi Cache:     ${CACHE_DURATION}`);
  console.log(`=======================================================`);
});
