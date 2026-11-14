#!/usr/bin/env bash
# =============================================================================
# kirim-ke-vps.sh — Dijalankan di LAPTOP (Mac).
#
# 1) Periksa VPS dulu (hanya membaca, tidak mengubah apa pun):
#      ./deploy/kirim-ke-vps.sh --cek root@IP-VPS formulasipakan.id
# 2) Pemasangan pertama / pasang HTTPS:
#      ./deploy/kirim-ke-vps.sh root@IP-VPS formulasipakan.id email@anda.com
# 3) Pembaruan aplikasi berikutnya:
#      ./deploy/kirim-ke-vps.sh root@IP-VPS
#
# Semua berkas dikirim ke ~/formulasipakan-rilis di VPS, lalu dipasang hanya ke
# /opt/formulasipakan dan /var/www/formulasipakan. Aplikasi lain tidak diubah.
# =============================================================================
set -euo pipefail
AKAR="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--cek" ]; then
  TUJUAN="${2:?Pemakaian: ./deploy/kirim-ke-vps.sh --cek root@IP-VPS formulasipakan.id}"
  DOMAIN="${3:-formulasipakan.id}"
  echo "==> Memeriksa $TUJUAN (hanya membaca)…"
  ssh "$TUJUAN" "if [ \$(id -u) -eq 0 ]; then bash -s -- '$DOMAIN'; else sudo bash -s -- '$DOMAIN'; fi" < "$AKAR/deploy/cek-vps.sh"
  exit $?
fi

TUJUAN="${1:-}"
DOMAIN="${2:-}"
EMAIL="${3:-}"
if [ -z "$TUJUAN" ]; then
  echo "Pemakaian: ./deploy/kirim-ke-vps.sh [--cek] root@IP-VPS [domain] [email]"
  exit 1
fi

echo "==> 1/3 Build aplikasi web…"
( cd "$AKAR/web" && npm install --no-audit --no-fund && npm run build )

echo "==> 2/3 Mengirim berkas ke $TUJUAN …"
# Hostinger Plain OS tidak selalu menyertakan rsync: pasang bila belum ada (tanpa memperbarui paket lain)
ssh "$TUJUAN" 'S=""; [ "$(id -u)" -ne 0 ] && S="sudo"; command -v rsync >/dev/null 2>&1 || { $S apt-get update -y && $S apt-get install -y --no-upgrade rsync; }; mkdir -p ~/formulasipakan-rilis/web/dist'
rsync -az --delete --exclude node_modules --exclude .env --exclude 'pgdata*' "$AKAR/server" "$AKAR/deploy" "$TUJUAN:formulasipakan-rilis/"
rsync -az --delete "$AKAR/web/dist/" "$TUJUAN:formulasipakan-rilis/web/dist/"

echo "==> 3/3 Memasang di VPS…"
ssh -t "$TUJUAN" "if [ \$(id -u) -eq 0 ]; then bash ~/formulasipakan-rilis/deploy/pasang-rilis.sh '$DOMAIN' '$EMAIL'; else sudo bash ~/formulasipakan-rilis/deploy/pasang-rilis.sh '$DOMAIN' '$EMAIL'; fi"
