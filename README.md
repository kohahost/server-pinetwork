Gunakan VPS Digital Ocean

Masuk ke vps anda dengan mengunakan ip server
username: root
pw: yang sudah di berikan oleh layanan vps

jika sudah update terlebih dahulu

apt update

apt install git

apt install npm

Instal semua paket yang dibutuhkan
npm install express http-proxy-middleware bottleneck dotenv

Instal PM2 secara global jika belum ada
npm install pm2 -g

jalankan server
pm2 start ecosystem.config.js

Selamat Mencoba...
