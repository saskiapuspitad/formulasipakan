# Panduan Deploy Sistem Formulasi Pakan ke VPS Hostinger

> **VPS Brahma (187.77.137.98) memakai Caddy di Docker sebagai pintu depan → ikuti [`deploy/docker/PANDUAN-DOCKER.md`](docker/PANDUAN-DOCKER.md).** Panduan di bawah ini untuk VPS yang memakai Nginx sistem atau masih kosong.

Domain: **formulasipakan.id** · VPS yang sama dengan **Brahma Farm, BrahmaPS, dan Brahma Export**.

Semua perintah diketik di **Terminal** Mac. Waktu yang dibutuhkan: ±20–30 menit untuk pertama kali.

---

## Jaminan: tidak bentrok dengan aplikasi Brahma

| Bagian | Yang dilakukan skrip | Yang TIDAK dilakukan |
|---|---|---|
| Nginx | Menambah **satu berkas** khusus `formulasipakan.id` | Tidak mengubah, menghapus, atau menimpa situs lain (termasuk `default`) |
| Paket sistem | Memasang paket yang **belum ada** saja (`apt --no-upgrade`) | Tidak memperbarui Nginx, PostgreSQL, atau paket lain yang sudah terpasang |
| Node.js | Memakai Node.js 22 **terpisah** di `/opt/formulasipakan/node` | Tidak mengubah Node.js sistem yang dipakai aplikasi Brahma |
| Port | API di `127.0.0.1`, port kosong pertama dari **3310–3399** — "kosong" berarti tidak dipakai **dan** tidak dipesan aplikasi lain (lihat di bawah) | Tidak memakai port 3000/3001/dll. yang sering dipakai aplikasi lain; tidak pernah merebut port yang sudah dipakai |
| Database | Database & pengguna PostgreSQL sendiri: `formulasipakan` | Tidak menyentuh database Brahma; pengguna `formulasipakan` tidak bisa membacanya |
| HTTPS | Sertifikat **hanya** untuk `formulasipakan.id` (dan `www`) | Tidak mengubah sertifikat domain lain |
| Folder | `/opt/formulasipakan`, `/var/www/formulasipakan`, `/var/backups/formulasipakan` | — |
| Layanan | `formulasipakan-api` | Tidak menghentikan atau me-restart layanan lain (Nginx hanya *reload* halus) |

Pengecekan port — sebuah port dianggap terpakai bila muncul di salah satu sumber ini, **termasuk milik aplikasi yang sedang mati/di-restart**:

1. Program yang sedang berjalan (`ss`)
2. Kontainer Docker, termasuk yang sedang berhenti
3. Tujuan `proxy_pass` di konfigurasi Nginx situs lain
4. Layanan systemd (`PORT=`, `--port`, `EnvironmentFile`)
5. Daftar proses PM2 tersimpan (root & semua pengguna)
6. Berkas `.env` dan `docker-compose` aplikasi lain di `/opt`, `/srv`, `/var/www`, `/home`, `/root`

Hasil pemeriksaan menampilkan tabel **"Port yang sudah dipakai/dipesan aplikasi lain"** beserta pemiliknya. Setiap kali pembaruan, port API dicek lagi: bila sudah direbut program lain, pemasangan berhenti dengan pesan jelas dan program itu **tidak** dihentikan. Pemeriksaan kesehatan juga memastikan yang menjawab benar-benar aplikasi ini (`"aplikasi":"formulasipakan"`), bukan program lain di port yang sama.

Pengaman tambahan:
- Skrip **memeriksa VPS dulu**. Bila ada yang tidak cocok (panel kontrol, port 80 dipegang selain Nginx, domain sudah dipakai berkas lain, konfigurasi Nginx yang ada sudah error), pemasangan **dibatalkan sebelum mengubah apa pun**.
- Bila konfigurasi baru gagal diuji (`nginx -t`), berkas baru langsung dihapus lagi dan situs lain tetap seperti semula.
- Semua jaminan di atas sudah diuji pada simulasi VPS yang menjalankan tiga aplikasi lain di port 3000–3002.

---

## 1. Periksa VPS dulu (hanya membaca, aman)

```bash
cd ~/RG/"Formulasi Pakan"/sifortak-online
chmod +x deploy/*.sh
./deploy/kirim-ke-vps.sh --cek root@IP-VPS formulasipakan.id
```

Perintah ini **tidak mengubah apa pun**. Hasilnya menampilkan web server, port, database, Node.js, dan DNS di VPS, lalu kesimpulan:

- **✔ AMAN DIPASANG** → lanjut ke langkah 2.
- **✘ …** → jangan lanjut. Salin seluruh hasilnya dan kirimkan ke pengembang untuk disesuaikan (misalnya bila aplikasi Brahma memakai CloudPanel, Docker, atau Apache).

> IP VPS ada di hPanel → VPS → Kelola. Jika perintah meminta kata sandi berkali-kali, pasang SSH key dulu: `ssh-copy-id root@IP-VPS`.

---

## 2. Arahkan domain ke VPS

**Domain dibeli di Hostinger:** hPanel → **Domain** → `formulasipakan.id` → **DNS / Nameserver** → kelola catatan DNS.

| Tipe | Nama | Nilai (Points to) | TTL |
|---|---|---|---|
| A | `@` | IP VPS | bawaan |
| A | `www` | IP VPS | bawaan |

Jika sudah ada catatan A/CNAME bawaan untuk `@` atau `www` (misalnya mengarah ke parkir domain Hostinger), ubah nilainya ke IP VPS. Tunggu 5–30 menit, lalu jalankan lagi pemeriksaan di langkah 1. Bagian **DNS formulasipakan.id** harus menunjukkan IP VPS.

> **Firewall hPanel:** karena aplikasi Brahma sudah online, port 80 & 443 seharusnya sudah terbuka. Tidak ada port baru yang perlu dibuka: API hanya berjalan di dalam VPS.

---

## 3. Pasang (pertama kali)

```bash
./deploy/kirim-ke-vps.sh root@IP-VPS formulasipakan.id email@anda.com
```

Skrip ini:
1. Mem-build aplikasi web di laptop.
2. Mengirim berkas ke `~/formulasipakan-rilis` di VPS.
3. Menjalankan pemeriksaan keamanan, lalu memasang Node.js terpisah, database `formulasipakan`, layanan `formulasipakan-api`, situs Nginx, HTTPS, dan cadangan database harian (02.30, disimpan 14 hari).

Di akhir akan muncul `API sehat ✔` dan ringkasan **Domain · HTTPS · Port API**.

Jika HTTPS gagal (biasanya karena DNS belum mengarah), cukup ulangi perintah yang sama setelah DNS siap.

---

## 4. Buat akun admin

```bash
ssh root@IP-VPS
bash /opt/formulasipakan/buat-admin.sh email@anda.com "Nama Anda"
```

Kata sandi sementara akan ditampilkan. Buka **https://formulasipakan.id**, masuk, lalu ganti kata sandi lewat menu **nama Anda (kiri atas) → Ganti kata sandi**.

Setelah masuk sebagai admin, tombol **Admin** muncul di kanan atas:
- **Statistik**: pengguna, perhitungan per hari, per jenis ternak.
- **Harga Acuan**: perbarui harga bahan (harga 2016 ditandai oranye).
- **Data Bahan**: komposisi gizi, batas pemakaian, tambah bahan baru.
- **Kebutuhan Nutrisi**: kebutuhan per periode ternak.
- **Pengguna**: jadikan admin, nonaktifkan, atur ulang kata sandi.

---

## 5. Memperbarui aplikasi

```bash
./deploy/kirim-ke-vps.sh root@IP-VPS
```

Data di database tetap aman. Hanya `formulasipakan-api` yang di-restart; aplikasi Brahma tidak tersentuh.

---

## 6. Perintah berguna (di VPS)

| Keperluan | Perintah |
|---|---|
| Status API | `systemctl status formulasipakan-api` |
| Log error API | `journalctl -u formulasipakan-api -n 100 --no-pager` |
| Log Nginx situs ini | `tail -n 50 /var/log/nginx/formulasipakan.error.log` |
| Restart API (hanya aplikasi ini) | `systemctl restart formulasipakan-api` |
| Cek kesehatan | `curl https://formulasipakan.id/api/sehat` |
| Daftar cadangan | `ls -lh /var/backups/formulasipakan` |
| Cadangan manual | `runuser -u postgres -- pg_dump -Fc formulasipakan > ~/formulasipakan-$(date +%F).dump` |
| Pulihkan cadangan | `runuser -u postgres -- pg_restore --clean -d formulasipakan berkas.dump` |
| Tutup pendaftaran mandiri | ubah `IZINKAN_DAFTAR=false` di `/opt/formulasipakan/server/.env`, lalu restart API |
| Copot aplikasi ini saja | `bash ~/formulasipakan-rilis/deploy/hapus-formulasipakan.sh formulasipakan.id` |

> Port API dan port database yang dipakai tercatat di `/opt/formulasipakan/server/.env`.

---

## 7. Jika ada masalah

| Gejala | Penyebab umum & solusi |
|---|---|
| Pemeriksaan menampilkan ✘ | Jangan lanjut; kirim hasil pemeriksaan ke pengembang |
| Halaman tidak terbuka | DNS belum mengarah ke VPS (cek langkah 2) |
| Bisa login tapi langsung keluar lagi | Situs dibuka lewat `http://` sebelum HTTPS terpasang. Ulangi langkah 3 setelah DNS siap |
| HTTPS gagal | DNS belum mengarah. Tunggu, lalu ulangi langkah 3 |
| `API belum merespons` | `journalctl -u formulasipakan-api -n 50 --no-pager` |
| `Port … sedang dipakai program lain` | Aplikasi lain memakai port API. Ganti `PORT` di `/opt/formulasipakan/server/.env` dan `proxy_pass` di berkas Nginx `formulasipakan.id` ke port kosong (lihat tabel port di hasil pemeriksaan), lalu ulangi pembaruan |
| Terus diminta kata sandi | `ssh-copy-id root@IP-VPS` |

---

## Arsitektur di VPS

```
                      ┌─ brahmafarm…    → aplikasi Brahma Farm    (tidak diubah)
Nginx (port 80/443) ──┼─ brahmaps…      → aplikasi BrahmaPS       (tidak diubah)
                      ├─ brahmaexport…  → aplikasi Brahma Export  (tidak diubah)
                      └─ formulasipakan.id
                           ├─ /       → /var/www/formulasipakan  (aplikasi web)
                           └─ /api/   → 127.0.0.1:3310           (formulasipakan-api, Node.js terpisah)
                                              │
PostgreSQL ── database Brahma (tidak diubah)  └─ database "formulasipakan"
```

Perhitungan formula tetap berjalan **di HP peternak** (cepat & bisa tanpa internet). Server menyimpan akun, formula (tersinkron antar-HP), harga acuan, data bahan & kebutuhan, dan riwayat perhitungan.
