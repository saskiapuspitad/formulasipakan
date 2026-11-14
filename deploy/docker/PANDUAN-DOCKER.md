# Pasang Sistem Formulasi Pakan di VPS Brahma (mode Docker + Caddy)

VPS `187.77.137.98` memakai **Caddy di Docker** (`brahma-ps-caddy-1`) sebagai pintu depan untuk
BrahmaPS, Brahma Farm, dan Brahma Feed. Sistem Formulasi Pakan dipasang dengan **pola yang sama
seperti Brahma Feed**: kontainer sendiri di jaringan `brahma-ps_default` + satu blok bertanda di
`/opt/brahma-ps/Caddyfile`. HTTPS dibuat otomatis oleh Caddy.

## Yang dipasang

| Bagian | Isi | Catatan |
|---|---|---|
| `formulasipakan-web` | Aplikasi web + API (Node.js 22) | Hanya dapat dijangkau Caddy lewat jaringan Docker; **tidak membuka port host** |
| `formulasipakan-db` | PostgreSQL 16 milik aplikasi ini | Hanya di jaringan internal `formulasipakan_internal`; tidak terlihat oleh kontainer lain |
| Volume `formulasipakan_db` | Data akun & formula | Tetap ada saat pembaruan |
| `/opt/formulasipakan/.env` | Sandi database & kunci sesi (acak) | Hak akses 600 |
| Blok Caddy `formulasipakan.id` (+ `www` → dialihkan) | `# >>> Sistem Formulasi Pakan (formulasipakan)` … `# <<<` | Blok lain di Caddyfile tidak diubah |
| Cadangan DB harian 02.30 | `/var/backups/formulasipakan` (14 hari) | `/etc/cron.d/formulasipakan-cadangan` |

## Pengaman (sudah diuji pada tiruan VPS ini)

- **Pemeriksaan dulu**: batal sebelum mengubah apa pun bila nama kontainer/volume/jaringan sudah dipakai
  aplikasi lain, domain sudah ada di Caddyfile, atau Caddyfile yang ada sudah tidak valid.
- **Nama unik**: layanan bernama `formulasipakan-web`/`formulasipakan-db`, tidak memakai `app`/`db`,
  sehingga Caddy tetap meneruskan `app:3000` ke BrahmaPS.
- **Caddy tidak disentuh sampai aplikasi sehat** dan Caddy terbukti bisa menjangkaunya.
- **Caddyfile dicadangkan** (`Caddyfile.bak-formulasipakan-…`, 5 terakhir), **divalidasi** (`caddy validate`),
  ditulis di tempat (berkas yang di-mount tetap sama), lalu **reload halus** (tanpa restart kontainer).
- **Situs lain dicek sebelum & sesudah**; bila ada yang terganggu atau reload gagal → Caddyfile
  **dikembalikan otomatis** dan dimuat ulang.
- Kontainer Brahma **tidak pernah di-restart**; database Brahma tidak disentuh.

## Langkah

Di Terminal Mac:

```bash
cd ~/RG/"Formulasi Pakan"/sifortak-online
git pull

# 1. Periksa (hanya membaca)
./deploy/kirim-ke-vps.sh --docker --cek root@187.77.137.98 formulasipakan.id

# 2. Pasang (bila hasil langkah 1 ✔ AMAN DIPASANG) — pertama kali ±5–10 menit
./deploy/kirim-ke-vps.sh --docker root@187.77.137.98 formulasipakan.id

# 3. Buat admin
ssh root@187.77.137.98 'bash /opt/formulasipakan/app/deploy/docker/buat-admin.sh email@anda.com "Nama Anda"'
```

**DNS** (hPanel → Domain → formulasipakan.id → DNS): catatan A `@` dan `www` → `187.77.137.98`.
Aplikasi boleh dipasang sebelum DNS siap; Caddy membuat sertifikat HTTPS otomatis begitu DNS mengarah.

**Pembaruan berikutnya**: ulangi langkah 2. Data tetap aman.

## Penting: Caddyfile ada di repository `brahma-ps`

`/opt/brahma-ps/Caddyfile` dilacak Git (repository `saskiapuspitad/brahma-ps`) dan saat ini sudah
berisi perubahan lokal (blok Brahma Feed) yang belum di-commit. Bila BrahmaPS di-deploy ulang dengan
cara yang menimpa Caddyfile, blok Brahma Feed **dan** Sistem Formulasi Pakan bisa hilang.
Setelah pemasangan, commit Caddyfile tersebut di repository `brahma-ps`. Bila blok sempat hilang,
cukup ulangi langkah 2.

## Perintah berguna (di VPS)

| Keperluan | Perintah |
|---|---|
| Status | `docker ps --filter name=formulasipakan` |
| Log aplikasi | `docker logs --tail 100 formulasipakan-web` |
| Restart aplikasi ini saja | `docker restart formulasipakan-web` |
| Cek kesehatan | `curl https://formulasipakan.id/api/sehat` |
| Cadangan manual | `docker exec formulasipakan-db pg_dump -U formulasipakan -Fc formulasipakan > ~/fp-$(date +%F).dump` |
| Pulihkan cadangan | `docker exec -i formulasipakan-db pg_restore -U formulasipakan -d formulasipakan --clean < berkas.dump` |
| Tutup pendaftaran mandiri | ubah `IZINKAN_DAFTAR=false` di `/opt/formulasipakan/.env`, lalu ulangi langkah 2 |
| Copot aplikasi ini saja | `bash /opt/formulasipakan/app/deploy/docker/hapus-docker.sh` |
