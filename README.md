# Sistem Formulasi Pakan (Online)

Formulasi pakan ternak unggas biaya termurah — versi dinamis (server + database), tetap bisa dipakai offline.

> Domain: **formulasipakan.id**. Di VPS, aplikasi ini dipasang terpisah (`/opt/formulasipakan`, database `formulasipakan`, layanan `formulasipakan-api`, Node.js sendiri, port 3310+) sehingga tidak bentrok dengan aplikasi lain di VPS yang sama.

```
sifortak-online/
├─ web/      Aplikasi PWA (React + Vite + TypeScript). Mesin LP tetap berjalan di HP.
├─ server/   API (Node.js + Express + PostgreSQL): akun, sinkron, harga acuan, admin, statistik
└─ deploy/   Skrip & panduan pemasangan di VPS (Nginx + systemd + HTTPS + cadangan harian)
```

## Fitur baru dibanding versi offline

- **Akun email + kata sandi** (sesi aman via cookie httpOnly, kata sandi di-hash bcrypt).
- **Formula & bahan buatan tersimpan di server** dan muncul di HP lain dengan akun yang sama.
- **Offline-first**: tanpa internet tetap bisa menghitung & menyimpan; perubahan otomatis dikirim saat online. Bila dua HP mengubah data yang sama, perubahan terakhir yang dipakai.
- **Harga acuan terpusat**: admin memperbarui harga, peternak langsung mendapat harga awal terbaru.
- **Halaman admin**: statistik, harga acuan (+ riwayat), data bahan, kebutuhan nutrisi, pengguna.
- **Riwayat perhitungan** setiap pengguna.
- **Pindahkan data lama**: formula dari versi nama+PIN di HP bisa dipindahkan ke akun.

## Menjalankan di laptop (tanpa memasang PostgreSQL)

Terminal 1:
```bash
cd server
npm install
npm run dev:lokal        # API + database lokal; admin uji: admin@lokal.test / admin12345
```
Terminal 2:
```bash
cd web
npm install
npm run dev              # buka alamat yang muncul (mis. http://localhost:5173)
```

## Pengujian

```bash
cd server && npm test    # 7 uji API dengan PostgreSQL sungguhan
cd web && npm test       # 3 uji alur aplikasi (butuh server/node_modules terpasang) (daftar, sinkron offline→online, HP kedua, admin)
cd web && npm run build  # type-check + build produksi
```

## Deploy ke VPS Brahma (Docker + Caddy) — **yang dipakai sekarang**

Lihat **deploy/docker/PANDUAN-DOCKER.md**. Singkatnya:

```bash
./deploy/kirim-ke-vps.sh --docker --cek root@187.77.137.98 formulasipakan.id   # 1. periksa (hanya membaca)
./deploy/kirim-ke-vps.sh --docker root@187.77.137.98 formulasipakan.id         # 2. pasang / perbarui
```

## Deploy ke VPS dengan Nginx sistem (alternatif)

Lihat **deploy/PANDUAN-DEPLOY-VPS.md**. Singkatnya:

```bash
./deploy/kirim-ke-vps.sh --cek root@IP-VPS formulasipakan.id                  # 1. periksa (hanya membaca)
./deploy/kirim-ke-vps.sh root@IP-VPS formulasipakan.id email@anda.com          # 2. pasang
./deploy/kirim-ke-vps.sh root@IP-VPS                                           # pembaruan berikutnya
```

## Catatan data

Komposisi bahan masih berstatus **PERLU_VERIFIKASI** dan harga awal adalah harga dataset **2016**. Perbarui keduanya lewat halaman Admin sebelum dipakai peternak.
