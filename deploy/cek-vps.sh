#!/usr/bin/env bash
# =============================================================================
# cek-vps.sh — Pemeriksaan VPS sebelum memasang Sistem Formulasi Pakan.
# HANYA MEMBACA: tidak memasang, mengubah, atau menghentikan apa pun.
#
# Dari laptop :  ./deploy/kirim-ke-vps.sh --cek root@IP-VPS formulasipakan.id
# Di VPS      :  sudo bash cek-vps.sh formulasipakan.id
#
# Bila variabel CEK_KELUARAN diisi, hasil juga ditulis ke berkas itu
# (dipakai setup-vps.sh). Kode keluar: 0 = aman dipasang, 2 = perlu disesuaikan.
# =============================================================================
set -uo pipefail

DOMAIN="${1:-formulasipakan.id}"
NAMA="formulasipakan"
PORT_API_AWAL=3310
PORT_API_AKHIR=3399

MASALAH=()
CATATAN=()
judul() { printf '\n\033[1m%s\033[0m\n' "$*"; }
baris() { printf '  %-28s %s\n' "$1" "$2"; }

port_dipakai() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }
pemilik_port() { ss -ltnpH "sport = :$1" 2>/dev/null | grep -oE 'users:\(\("[^"]+' | head -1 | sed 's/users:(("//' || true; }

judul "Sistem"
OS="$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-?}")"
baris "OS" "$OS"
baris "Arsitektur" "$(uname -m)"
baris "RAM" "$(free -m 2>/dev/null | awk '/^Mem:/ {print $2 " MB total, " $7 " MB tersedia"}')"
baris "Disk /" "$(df -h / 2>/dev/null | awk 'NR==2 {print $4 " kosong dari " $2}')"
case "$OS" in
  *Ubuntu\ 2[2-6]*|*Debian*1[2-3]*) ;;
  *) MASALAH+=("OS '$OS' belum didukung skrip (butuh Ubuntu 22.04/24.04 atau Debian 12).") ;;
esac

judul "Panel kontrol"
PANEL=""
[ -d /home/clp ] && PANEL="CloudPanel"
[ -d /usr/local/CyberCP ] && PANEL="CyberPanel"
[ -d /usr/local/psa ] && PANEL="Plesk"
[ -d /usr/local/cpanel ] && PANEL="cPanel"
[ -d /www/server/panel ] && PANEL="aaPanel"
[ -d /usr/local/hestia ] && PANEL="HestiaCP"
[ -d /data/coolify ] && PANEL="Coolify"
[ -d /usr/local/lsws ] && PANEL="${PANEL:-OpenLiteSpeed}"
baris "Panel terdeteksi" "${PANEL:-tidak ada}"
[ -n "$PANEL" ] && MASALAH+=("Server dikelola ${PANEL}. Situs baru sebaiknya ditambahkan lewat ${PANEL} agar tidak tertimpa — kirim hasil ini ke pengembang untuk disesuaikan.")

judul "Web server (port 80 & 443)"
P80="$(pemilik_port 80)"
P443="$(pemilik_port 443)"
baris "Port 80 dipakai oleh" "${P80:-kosong}"
baris "Port 443 dipakai oleh" "${P443:-kosong}"
MODE_WEB="nginx-baru"
if [ -n "$P80$P443" ]; then
  if [ "${P80:-nginx}" = "nginx" ] && [ "${P443:-nginx}" = "nginx" ]; then
    MODE_WEB="nginx-ada"
  else
    MODE_WEB="lain"
    MASALAH+=("Port 80/443 dipegang '${P80:-$P443}', bukan Nginx sistem. Skrip tidak akan mengubahnya — perlu cara pemasangan lain (kirim hasil ini ke pengembang).")
  fi
fi
case "$MODE_WEB" in
  nginx-ada) baris "Cara pemasangan web" "tambah situs baru ke Nginx yang sudah ada" ;;
  nginx-baru) baris "Cara pemasangan web" "pasang Nginx baru" ;;
  *) baris "Cara pemasangan web" "TIDAK OTOMATIS" ;;
esac

NGINX_LAYOUT=""
SITUS_LAIN=""
if command -v nginx >/dev/null 2>&1; then
  baris "Versi Nginx" "$(nginx -v 2>&1 | sed 's/.*nginx\///')"
  KONF="$(nginx -T 2>/dev/null || true)"
  if printf '%s' "$KONF" | grep -qE '^\s*include\s+/etc/nginx/sites-enabled/'; then
    NGINX_LAYOUT="sites"
  else
    NGINX_LAYOUT="confd"
  fi
  baris "Susunan konfigurasi" "$( [ "$NGINX_LAYOUT" = sites ] && echo "sites-available/sites-enabled" || echo "conf.d")"
  SITUS_LAIN="$(printf '%s' "$KONF" | grep -E '^\s*server_name\s' | sed -E 's/^\s*server_name\s+//; s/;.*//' | tr ' ' '\n' | grep -vE '^(_|localhost|)$' | sort -u | tr '\n' ' ')"
  baris "Domain yang sudah dilayani" "${SITUS_LAIN:-(tidak ada)}"
  if printf ' %s ' "$SITUS_LAIN" | grep -qE " (www\.)?${DOMAIN//./\\.} "; then
    if grep -qs "^# Sistem Formulasi Pakan" "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/conf.d/${DOMAIN}.conf"; then
      CATATAN+=("${DOMAIN} sudah terpasang sebelumnya oleh skrip ini (akan diperbarui).")
    else
      MASALAH+=("Domain ${DOMAIN} sudah dipakai konfigurasi Nginx lain. Periksa dulu agar tidak menimpa situs lain.")
    fi
  fi
  if ! nginx -t >/dev/null 2>&1; then
    MASALAH+=("Konfigurasi Nginx yang ADA saat ini sudah error ('nginx -t' gagal). Perbaiki dulu sebelum menambah situs.")
  fi
fi

# Berkas dengan nama yang sama tapi bukan buatan skrip ini -> jangan disentuh
for f in "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}" "/etc/nginx/conf.d/${DOMAIN}.conf"; do
  if [ -e "$f" ] && ! grep -qs "^# Sistem Formulasi Pakan" "$f"; then
    MASALAH+=("Berkas ${f} sudah ada dan bukan milik aplikasi ini. Tidak akan ditimpa.")
  fi
done

judul "Docker"
if command -v docker >/dev/null 2>&1; then
  DPORT="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '0\.0\.0\.0:(80|443)->|:::(80|443)->' || true)"
  baris "Kontainer berjalan" "$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')"
  [ -n "$DPORT" ] && baris "Kontainer di port 80/443" "$(printf '%s' "$DPORT" | awk '{print $1}' | tr '\n' ' ')"
else
  baris "Docker" "tidak terpasang"
fi

judul "Node.js & aplikasi lain"
if command -v node >/dev/null 2>&1; then
  baris "Node.js sistem" "$(node -v) (TIDAK akan diubah)"
else
  baris "Node.js sistem" "tidak ada"
fi
baris "Node.js untuk aplikasi ini" "terpisah di /opt/${NAMA}/node"
if command -v pm2 >/dev/null 2>&1; then
  baris "PM2 (root)" "$(pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/"name":"//; s/"//' | tr '\n' ' ' || echo '-')"
fi
PORTS_TCP="$(ss -ltnH 2>/dev/null | awk '{print $4}' | sed -E 's/.*:([0-9]+)$/\1/' | sort -n | uniq | tr '\n' ' ')"
baris "Port TCP terpakai" "$PORTS_TCP"

PORT_API=""
if [ -f "/opt/${NAMA}/server/.env" ]; then
  PORT_API="$(grep -E '^PORT=' "/opt/${NAMA}/server/.env" | cut -d= -f2)"
fi
if [ -z "$PORT_API" ]; then
  TERPAKAI_NGINX="$( (nginx -T 2>/dev/null || true) | grep -oE 'proxy_pass\s+https?://[^;]+' | grep -oE ':[0-9]+' | tr -d ':' | sort -u | tr '\n' ' ')"
  for p in $(seq "$PORT_API_AWAL" "$PORT_API_AKHIR"); do
    if ! port_dipakai "$p" && ! printf ' %s ' "$TERPAKAI_NGINX" | grep -q " $p "; then PORT_API="$p"; break; fi
  done
fi
baris "Port API aplikasi ini" "${PORT_API:-TIDAK ADA YANG KOSONG} (hanya 127.0.0.1)"
[ -z "$PORT_API" ] && MASALAH+=("Tidak ada port kosong di ${PORT_API_AWAL}-${PORT_API_AKHIR}.")

judul "PostgreSQL"
PG_PORT=""
PG_ADA="tidak"
if command -v pg_lsclusters >/dev/null 2>&1; then
  PG_ADA="ya"
  pg_lsclusters 2>/dev/null | sed 's/^/  /'
  PG_PORT="$(pg_lsclusters -h 2>/dev/null | awk '$4=="online" {print $3; exit}')"
  [ -z "$PG_PORT" ] && PG_PORT="$(pg_lsclusters -h 2>/dev/null | awk '{print $3; exit}')"
  baris "Database aplikasi ini" "'${NAMA}' terpisah di cluster yang sama (database lain tidak disentuh)"
else
  baris "PostgreSQL sistem" "belum ada (akan dipasang)"
  P5432="$(pemilik_port 5432)"
  if [ -n "$P5432" ]; then
    baris "Port 5432 dipakai oleh" "$P5432 (PostgreSQL baru akan memakai port lain)"
  fi
fi

judul "HTTPS & firewall"
if command -v certbot >/dev/null 2>&1; then
  baris "Certbot" "sudah ada ($(readlink -f "$(command -v certbot)"))"
  baris "Sertifikat terpasang" "$(certbot certificates 2>/dev/null | grep -E 'Certificate Name:' | awk '{print $3}' | tr '\n' ' ')"
else
  baris "Certbot" "belum ada (akan dipasang)"
fi
if command -v ufw >/dev/null 2>&1; then
  baris "UFW" "$(ufw status 2>/dev/null | head -1 | sed 's/Status: //')"
fi

judul "DNS ${DOMAIN}"
IP_SERVER="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | grep -vE '^(10|127|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.' | head -1)"
IP_DOMAIN="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')"
IP_WWW="$(getent ahostsv4 "www.$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')"
baris "IP publik VPS" "${IP_SERVER:-?}"
baris "${DOMAIN} →" "${IP_DOMAIN:-belum mengarah ke mana pun}"
baris "www.${DOMAIN} →" "${IP_WWW:-belum mengarah ke mana pun}"
DNS_OK="tidak"
WWW_OK="tidak"
[ -n "$IP_DOMAIN" ] && [ "$IP_DOMAIN" = "$IP_SERVER" ] && DNS_OK="ya"
[ -n "$IP_WWW" ] && [ "$IP_WWW" = "$IP_SERVER" ] && WWW_OK="ya"
[ "$DNS_OK" = tidak ] && CATATAN+=("DNS ${DOMAIN} belum mengarah ke VPS ini — HTTPS belum bisa dipasang. Tambahkan catatan A '@' → ${IP_SERVER:-IP VPS}.")
[ "$WWW_OK" = tidak ] && CATATAN+=("www.${DOMAIN} belum mengarah ke VPS ini — tambahkan catatan A 'www' → ${IP_SERVER:-IP VPS} (opsional).")

judul "Pemasangan sebelumnya"
if [ -d "/opt/${NAMA}" ]; then baris "/opt/${NAMA}" "sudah ada (mode pembaruan)"; else baris "/opt/${NAMA}" "belum ada (pemasangan baru)"; fi

judul "Kesimpulan"
for c in "${CATATAN[@]+"${CATATAN[@]}"}"; do echo "  • $c"; done
if [ "${#MASALAH[@]}" -eq 0 ]; then
  printf '  \033[32m✔ AMAN DIPASANG.\033[0m Aplikasi lain (Nginx, database, Node.js, port) tidak akan diubah.\n'
  KODE=0
else
  for m in "${MASALAH[@]}"; do printf '  \033[31m✘ %s\033[0m\n' "$m"; done
  KODE=2
fi

if [ -n "${CEK_KELUARAN:-}" ]; then
  {
    echo "MODE_WEB=$MODE_WEB"
    echo "NGINX_LAYOUT=${NGINX_LAYOUT:-sites}"
    echo "PORT_API=$PORT_API"
    echo "PG_ADA=$PG_ADA"
    echo "PG_PORT=$PG_PORT"
    echo "DNS_OK=$DNS_OK"
    echo "WWW_OK=$WWW_OK"
  } > "$CEK_KELUARAN"
fi
exit "$KODE"
