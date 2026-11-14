#!/usr/bin/env bash
# =============================================================================
# pasang-rilis.sh — Pasang / perbarui Sistem Formulasi Pakan di VPS.
# Dijalankan otomatis oleh kirim-ke-vps.sh. Pemasangan pertama sekalian
# menjalankan setup-vps.sh (dengan pemeriksaan keamanan lebih dulu).
# Hanya menyentuh /opt/formulasipakan, /var/www/formulasipakan, dan layanan
# formulasipakan-api. Aplikasi lain di VPS tidak dihentikan atau diubah.
# =============================================================================
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Jalankan sebagai root (atau dengan sudo)."; exit 1; fi

RILIS="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${1:-}"
EMAIL="${2:-}"
NAMA="formulasipakan"
APP="/opt/${NAMA}"
WEB="/var/www/${NAMA}"
ENV="${APP}/server/.env"
NODE_BIN="${APP}/node/bin"

[ -f "$RILIS/web/dist/index.html" ] || { echo "Folder web/dist tidak ditemukan di rilis."; exit 1; }

if [ ! -f "$ENV" ] || [ -n "$DOMAIN" ]; then
  if [ -z "$DOMAIN" ]; then
    echo "VPS belum disiapkan. Jalankan dari laptop:"
    echo "  ./deploy/kirim-ke-vps.sh root@IP-VPS formulasipakan.id email@anda.com"
    exit 1
  fi
  bash "$RILIS/deploy/setup-vps.sh" "$DOMAIN" "$EMAIL"
fi

echo
echo "==> Menyalin server & situs (hanya folder ${NAMA})…"
rsync -a --delete --exclude node_modules --exclude .env --exclude 'pgdata*' "$RILIS/server/" "$APP/server/"
rsync -a --delete "$RILIS/web/dist/" "$WEB/"
install -m 755 "$RILIS/deploy/buat-admin.sh" "$APP/buat-admin.sh"
chown -R "$NAMA:$NAMA" "$APP"
chmod -R a+rX "$WEB"

echo "==> Memasang pustaka server dengan Node.js $("$NODE_BIN/node" -v) milik aplikasi ini…"
cd "$APP/server"
runuser -u "$NAMA" -- env HOME="$APP" PATH="$NODE_BIN:/usr/bin:/bin" npm ci --omit=dev --no-audit --no-fund --loglevel=error

PORT_API="$(grep -E '^PORT=' "$ENV" | cut -d= -f2)"
echo "==> Menjalankan ulang layanan ${NAMA}-api (port ${PORT_API})…"
if [ -d /run/systemd/system ]; then
  systemctl restart "${NAMA}-api"
else
  echo "   (tanpa systemd: jalankan manual)"
fi
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT_API}/api/sehat" >/dev/null 2>&1; then
    echo "API sehat ✔"
    break
  fi
  sleep 1
  if [ "$i" -eq 20 ]; then
    echo "!! API belum merespons. Lihat log:  journalctl -u ${NAMA}-api -n 50 --no-pager"
    exit 1
  fi
done

ADMIN="$(runuser -u postgres -- psql -p "$(sed -nE 's#.*@127\.0\.0\.1:([0-9]+)/.*#\1#p' "$ENV")" -d "$NAMA" -tAc "SELECT count(*) FROM pengguna WHERE peran='admin'" 2>/dev/null || echo 0)"
echo
echo "Rilis terpasang."
if [ "${ADMIN// /}" = "0" ]; then
  echo "Belum ada admin. Buat dengan (di VPS):"
  echo "  bash ${APP}/buat-admin.sh email@anda.com \"Nama Anda\""
fi
