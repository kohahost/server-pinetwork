// File: ecosystem.config.js

module.exports = {
  apps: [{
    // Konfigurasi Aplikasi Utama
    name: "proxy-tempur",       // Nama proses di PM2
    script: "./server.js",        // File utama yang akan dijalankan

    // --- Mode Cluster untuk Performa Maksimal ---
    instances: "max",             // Jalankan di semua core CPU yang tersedia (misal: 4 core = 4 instance)
    exec_mode: "cluster",         // Aktifkan mode cluster

    // --- Pengaturan Lainnya ---
    watch: false,                 // Jangan memantau perubahan file di produksi
    max_memory_restart: '250M',   // Restart jika memori melebihi 250MB

    // --- Variabel Lingkungan untuk Performa Maksimal ---
    // Atur semua konfigurasi di sini. Tidak perlu file .env lagi saat pakai PM2.
    env: {
      "NODE_ENV": "production",
      "PORT": 31401,
      "TARGET_SERVER_URL": "http://113.160.156.51:31401", // Ganti jika perlu
      "REQUESTS_PER_SECOND": 100, // Atur sesuai rate limit target
      "ENABLE_LOGGING": "false"     // "false" untuk mematikan log demi kecepatan penuh
    }
  }]
};
