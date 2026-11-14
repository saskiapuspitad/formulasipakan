#!/usr/bin/env bash
# =============================================================================
# setup-vps.sh — Persiapan VPS untuk Sistem Formulasi Pakan (sekali saja).
#
# Dirancang AMAN untuk VPS yang sudah menjalankan aplikasi lain:
#   • Tidak mengubah/menghapus situs Nginx lain, hanya menambah berkas untuk domain ini.
#   • Tidak memperbarui paket yang sudah terpasang (apt --no-upgrade).
#   • Tidak mengubah Node.js sistem — memakai Node.js 22 terpisah di /opt/formulasipakan/node.
#   • Database & pengguna PostgreSQL sendiri ("formulasipakan"); database lain tidak disentuh.
#   • API hanya mendengarkan 127.0.0.1 pada port kosong (3310–3399), bukan 3000.
#   • Sertifikat HTTPS hanya untuk domain ini.
#   • Bila ada yang tidak cocok, berhenti SEBELUM mengubah apa pun.
#
# Pemakaian (di VPS):  sudo bash setup-vps.sh formulasipakan.id email@anda.com
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
DIR_SKRIP="$(cd "$(dirname "$0")" && pwd)"
NAMA="formulasipakan"
APP="/opt/${NAMA}"
WEB="/var/www/${NAMA}"
CADANGAN="/var/backups/${NAMA}"
ENV="${APP}/server/.env"
NODE_MAYOR="22"

if [ "$(id -u)" -ne 0 ]; then echo "Jalankan sebagai root (atau dengan sudo)."; exit 1; fi
if [ -z "$DOMAIN" ]; then echo "Pemakaian: sudo bash setup-vps.sh <domain> [email]"; exit 1; fi
langkah() { printf '\n==> %s\n' "$*"; }
ada_systemd() { [ -d /run/systemd/system ]; }
layanan() { # layanan <aksi> <nama>
  if ada_systemd; then systemctl "$1" "$2"; else echo "   (tanpa systemd: lewati 'systemctl $1 $2')"; fi
}
muat_ulang_nginx() {
  if ada_systemd && systemctl is-active --quiet nginx; then systemctl reload nginx
  elif pgrep -x nginx >/dev/null; then nginx -s reload
  else layanan start nginx 2>/dev/null || nginx; fi
}

# ---------------------------------------------------------------------------
langkah "1. Pemeriksaan awal (belum ada yang diubah)…"
command -v ss >/dev/null 2>&1 || { apt-get update -y >/dev/null && apt-get install -y --no-upgrade iproute2 >/dev/null; }
HASIL_CEK="$(mktemp)"
set +e
CEK_KELUARAN="$HASIL_CEK" bash "$DIR_SKRIP/cek-vps.sh" "$DOMAIN"
KODE_CEK=$?
set -e
if [ "$KODE_CEK" -ne 0 ]; then
  echo
  echo "Pemasangan DIBATALKAN. Tidak ada yang diubah di VPS ini."
  echo "Salin seluruh hasil di atas dan kirimkan ke pengembang untuk disesuaikan."
  rm -f "$HASIL_CEK"
  exit 2
fi
# shellcheck disable=SC1090
. "$HASIL_CEK"
rm -f "$HASIL_CEK"

# ---------------------------------------------------------------------------
langkah "2. Memasang paket yang BELUM ada (paket yang sudah ada tidak diperbarui)…"
PERLU=()
perlu() { dpkg -s "$1" >/dev/null 2>&1 || PERLU+=("$1"); }
for p in ca-certificates curl xz-utils openssl rsync; do perlu "$p"; done
[ "$MODE_WEB" = "nginx-baru" ] && ! command -v nginx >/dev/null 2>&1 && PERLU+=("nginx")
[ "$PG_ADA" = "tidak" ] && PERLU+=("postgresql")
if ! command -v certbot >/dev/null 2>&1; then PERLU+=("certbot" "python3-certbot-nginx")
elif ! certbot plugins 2>/dev/null | grep -q nginx; then perlu python3-certbot-nginx; fi
if [ "${#PERLU[@]}" -gt 0 ]; then
  echo "   Dipasang: ${PERLU[*]}"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y --no-upgrade "${PERLU[@]}"
else
  echo "   Semua paket sudah ada."
fi

# ---------------------------------------------------------------------------
langkah "3. Node.js ${NODE_MAYOR} khusus aplikasi ini di ${APP}/node…"
id "$NAMA" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP" --shell /usr/sbin/nologin "$NAMA"
mkdir -p "$APP/server" "$WEB" "$CADANGAN"
if [ -x "$APP/node/bin/node" ] && "$APP/node/bin/node" -v | grep -q "^v${NODE_MAYOR}\."; then
  echo "   Sudah ada: $("$APP/node/bin/node" -v)"
else
  case "$(uname -m)" in
    x86_64) ARSITEKTUR=x64 ;;
    aarch64) ARSITEKTUR=arm64 ;;
    *) echo "Arsitektur $(uname -m) belum didukung."; exit 1 ;;
  esac
  TMPN="$(mktemp -d)"
  if [ -n "${NODE_TARBALL:-}" ]; then
    cp "$NODE_TARBALL" "$TMPN/node.tar.xz"            # untuk pengujian luring
  else
    BASIS="https://nodejs.org/dist/latest-v${NODE_MAYOR}.x"
    curl -fsSL "$BASIS/SHASUMS256.txt" -o "$TMPN/SHASUMS256.txt"
    BERKAS="$(grep -oE "node-v${NODE_MAYOR}\.[0-9.]+-linux-${ARSITEKTUR}\.tar\.xz" "$TMPN/SHASUMS256.txt" | head -1)"
    [ -n "$BERKAS" ] || { echo "Tidak menemukan berkas Node.js untuk linux-${ARSITEKTUR}."; exit 1; }
    curl -fsSL "$BASIS/$BERKAS" -o "$TMPN/$BERKAS"
    ( cd "$TMPN" && grep " ${BERKAS}\$" SHASUMS256.txt | sha256sum -c - >/dev/null ) || { echo "Checksum Node.js tidak cocok — dibatalkan."; exit 1; }
    mv "$TMPN/$BERKAS" "$TMPN/node.tar.xz"
  fi
  rm -rf "$APP/node.baru" && mkdir -p "$APP/node.baru"
  tar -xJf "$TMPN/node.tar.xz" -C "$APP/node.baru" --strip-components=1
  rm -rf "$APP/node" && mv "$APP/node.baru" "$APP/node"
  rm -rf "$TMPN"
  echo "   Terpasang: $("$APP/node/bin/node" -v) (Node.js sistem tidak diubah)"
fi
chown -R "$NAMA:$NAMA" "$APP"
chown postgres:postgres "$CADANGAN" && chmod 750 "$CADANGAN"

# ---------------------------------------------------------------------------
langkah "4. Database PostgreSQL '${NAMA}' (database lain tidak disentuh)…"
# Pakai kluster yang sedang berjalan; bila tidak ada, kluster pertama
BARIS_PG="$(pg_lsclusters -h | awk '$4=="online"' | head -1)"
[ -n "$BARIS_PG" ] || BARIS_PG="$(pg_lsclusters -h | head -1)"
[ -n "$BARIS_PG" ] || { echo "Tidak menemukan kluster PostgreSQL."; exit 1; }
read -r VERSI_PG KLUSTER_PG PG_PORT STATUS_PG _ <<<"$BARIS_PG"
if [ "$STATUS_PG" != "online" ]; then
  # Mis. PostgreSQL baru gagal jalan karena port 5432 dipakai kontainer Docker
  if ss -ltnH "sport = :${PG_PORT}" | grep -q .; then
    for p in $(seq 5433 5499); do ss -ltnH "sport = :$p" | grep -q . || { PG_PORT="$p"; break; }; done
    pg_conftool "$VERSI_PG" "$KLUSTER_PG" set port "$PG_PORT"
    echo "   Port 5432 sudah dipakai program lain; PostgreSQL memakai port ${PG_PORT}."
  fi
  pg_ctlcluster "$VERSI_PG" "$KLUSTER_PG" start
fi
ada_systemd && systemctl enable postgresql >/dev/null 2>&1 || true
psql_su() { runuser -u postgres -- psql -p "$PG_PORT" -v ON_ERROR_STOP=1 "$@"; }

if [ ! -f "$ENV" ]; then
  SANDI_DB="$(openssl rand -hex 24)"
  if psql_su -tAc "SELECT 1 FROM pg_roles WHERE rolname='${NAMA}'" | grep -q 1; then
    psql_su -qc "ALTER ROLE ${NAMA} WITH LOGIN PASSWORD '${SANDI_DB}'"
  else
    psql_su -qc "CREATE ROLE ${NAMA} WITH LOGIN PASSWORD '${SANDI_DB}'"
  fi
  psql_su -tAc "SELECT 1 FROM pg_database WHERE datname='${NAMA}'" | grep -q 1 || runuser -u postgres -- createdb -p "$PG_PORT" -O "$NAMA" "$NAMA"
  # Database ini hanya boleh diakses pengguna "formulasipakan"
  psql_su -qc "REVOKE ALL ON DATABASE ${NAMA} FROM PUBLIC"
  cat > "$ENV" <<ISI
NODE_ENV=production
HOST=127.0.0.1
PORT=${PORT_API}
DATABASE_URL=postgres://${NAMA}:${SANDI_DB}@127.0.0.1:${PG_PORT}/${NAMA}
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
COOKIE_SECURE=false
IZINKAN_DAFTAR=true
ISI
  chown "$NAMA:$NAMA" "$ENV"
  chmod 600 "$ENV"
  echo "   Database, pengguna, dan ${ENV} dibuat (sandi & kunci acak). API memakai port ${PORT_API}."
else
  PORT_API="$(grep -E '^PORT=' "$ENV" | cut -d= -f2)"
  echo "   ${ENV} sudah ada — dipakai apa adanya (port API ${PORT_API})."
fi

# ---------------------------------------------------------------------------
langkah "5. Layanan systemd ${NAMA}-api…"
if ada_systemd; then
  install -m 644 "$DIR_SKRIP/${NAMA}-api.service" "/etc/systemd/system/${NAMA}-api.service"
  systemctl daemon-reload
  systemctl enable "${NAMA}-api" >/dev/null
else
  echo "   (tanpa systemd: layanan tidak dipasang)"
fi

# ---------------------------------------------------------------------------
langkah "6. Situs Nginx khusus ${DOMAIN} (situs lain tidak diubah)…"
if [ "${NGINX_LAYOUT}" = "sites" ] || { [ "$MODE_WEB" = "nginx-baru" ] && [ -d /etc/nginx/sites-enabled ]; }; then
  BERKAS_NGINX="/etc/nginx/sites-available/${DOMAIN}"
  TAUTAN_NGINX="/etc/nginx/sites-enabled/${DOMAIN}"
else
  BERKAS_NGINX="/etc/nginx/conf.d/${DOMAIN}.conf"
  TAUTAN_NGINX=""
fi
IPV6="#"; [ -f /proc/net/if_inet6 ] && IPV6=""
CADANGAN_NGINX=""
if [ -f "$BERKAS_NGINX" ] && ! grep -qs "^# Sistem Formulasi Pakan" "$BERKAS_NGINX"; then
  echo "!! ${BERKAS_NGINX} milik aplikasi lain — dibatalkan, tidak ada yang ditimpa."
  exit 1
elif [ -f "$BERKAS_NGINX" ]; then
  # Pemasangan ulang: pertahankan berkas lama (sudah berisi HTTPS dari certbot)
  echo "   ${BERKAS_NGINX} sudah ada — dipertahankan."
else
  sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/__PORT__/${PORT_API}/g" -e "s/^__IPV6__/${IPV6}/" \
    "$DIR_SKRIP/nginx-formulasipakan.conf" > "$BERKAS_NGINX"
  [ -n "$TAUTAN_NGINX" ] && ln -sf "$BERKAS_NGINX" "$TAUTAN_NGINX"
  CADANGAN_NGINX="baru"
fi
if ! nginx -t 2>/tmp/${NAMA}-nginx-uji.log; then
  cat /tmp/${NAMA}-nginx-uji.log
  if [ "$CADANGAN_NGINX" = "baru" ]; then
    rm -f "$BERKAS_NGINX" ${TAUTAN_NGINX:+"$TAUTAN_NGINX"}
    echo "!! Konfigurasi Nginx gagal diuji — berkas ${DOMAIN} DIHAPUS lagi, situs lain tetap seperti semula."
  fi
  exit 1
fi
muat_ulang_nginx
echo "   ${BERKAS_NGINX} aktif."

# ---------------------------------------------------------------------------
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  langkah "7. Firewall UFW: memastikan port 80/443 terbuka…"
  ufw allow 'Nginx Full' >/dev/null || ufw allow 80,443/tcp >/dev/null
fi

# ---------------------------------------------------------------------------
langkah "8. Cadangan database harian 02.30 (disimpan 14 hari di ${CADANGAN})…"
cat > "/etc/cron.d/${NAMA}-cadangan" <<ISI
30 2 * * * postgres pg_dump -p ${PG_PORT} -Fc ${NAMA} > ${CADANGAN}/${NAMA}-\$(date +\\%F).dump && find ${CADANGAN} -name '*.dump' -mtime +14 -delete
ISI
chmod 644 "/etc/cron.d/${NAMA}-cadangan"

# ---------------------------------------------------------------------------
HTTPS="belum"
if [ -n "$EMAIL" ] && [ "$DNS_OK" = "ya" ]; then
  langkah "9. Sertifikat HTTPS untuk ${DOMAIN} saja…"
  DOM_ARGS=(-d "$DOMAIN")
  [ "$WWW_OK" = "ya" ] && DOM_ARGS+=(-d "www.$DOMAIN")
  if certbot --nginx --cert-name "$DOMAIN" "${DOM_ARGS[@]}" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    HTTPS="ya"
  else
    echo "!! Sertifikat gagal. Coba lagi nanti: sudo certbot --nginx --cert-name ${DOMAIN} -d ${DOMAIN} --redirect"
  fi
elif [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  HTTPS="ya"
else
  echo
  echo "   HTTPS belum dipasang (DNS belum mengarah ke VPS atau email tidak diisi)."
  echo "   Setelah DNS siap, jalankan ulang perintah kirim-ke-vps.sh dengan domain & email."
fi
if [ "$HTTPS" = "ya" ]; then
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' "$ENV"
else
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=false/' "$ENV"
fi

echo
echo "================================================================"
echo " Persiapan VPS selesai. Domain: ${DOMAIN} · HTTPS: ${HTTPS} · Port API: ${PORT_API}"
echo " Aplikasi lain di VPS ini tidak diubah."
echo "================================================================"
