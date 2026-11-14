#!/usr/bin/env bash
# =============================================================================
# cek-docker.sh — Pemeriksaan VPS untuk pemasangan Docker di belakang Caddy
# yang sudah ada (mis. brahma-ps-caddy-1). HANYA MEMBACA: tidak mengubah apa pun.
#
# Dari laptop :  ./deploy/kirim-ke-vps.sh --docker --cek root@IP-VPS formulasipakan.id
# Kode keluar : 0 = aman dipasang, 2 = perlu disesuaikan.
# Bila CEK_KELUARAN diisi, hasil juga ditulis ke berkas itu (dipakai pasang-docker.sh).
# =============================================================================
set -uo pipefail

DOMAIN="${1:-formulasipakan.id}"
NAMA="formulasipakan"
WEB="${NAMA}-web"
DB="${NAMA}-db"
PENANDA_AWAL="# >>> Sistem Formulasi Pakan (${NAMA})"
PENANDA_AKHIR="# <<< Sistem Formulasi Pakan (${NAMA})"

# Nama domain harus sah (huruf kecil, angka, tanda hubung, titik) — tolak masukan aneh
if ! printf '%s' "$DOMAIN" | grep -qE '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'; then
  echo "Nama domain tidak sah: '$DOMAIN' (contoh yang benar: formulasipakan.id)"; exit 2
fi

MASALAH=()
CATATAN=()
judul() { printf '\n\033[1m%s\033[0m\n' "$*"; }
baris() { printf '  %-28s %s\n' "$1" "$2"; }

judul "Sistem"
baris "OS" "$(. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-?}")"
baris "RAM" "$(free -m 2>/dev/null | awk '/^Mem:/ {print $2 " MB total, " $7 " MB tersedia"}')"
KOSONG_GB="$(df -BG --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -dc 0-9)"
[ -z "$KOSONG_GB" ] && KOSONG_GB="$(df -BG --output=avail / | tail -1 | tr -dc 0-9)"
baris "Disk kosong" "${KOSONG_GB} GB"
[ "${KOSONG_GB:-0}" -lt 3 ] && MASALAH+=("Disk kosong kurang dari 3 GB.")

judul "Docker"
if ! command -v docker >/dev/null 2>&1; then
  MASALAH+=("Docker tidak ditemukan.")
else
  baris "Docker" "$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?')"
  if docker compose version >/dev/null 2>&1; then
    baris "Docker Compose" "$(docker compose version --short 2>/dev/null)"
  else
    MASALAH+=("Plugin 'docker compose' tidak ada.")
  fi
fi

judul "Pintu depan (Caddy)"
CADDY_C=""
for c in $(docker ps --filter publish=443 --format '{{.Names}}' 2>/dev/null) $(docker ps --filter publish=80 --format '{{.Names}}' 2>/dev/null); do
  if docker inspect "$c" --format '{{.Config.Image}}' 2>/dev/null | grep -qi caddy; then CADDY_C="$c"; break; fi
done
CADDYFILE=""
PROXY_NET=""
if [ -z "$CADDY_C" ]; then
  MASALAH+=("Tidak menemukan kontainer Caddy yang memegang port 80/443.")
else
  baris "Kontainer Caddy" "$CADDY_C ($(docker inspect "$CADDY_C" --format '{{.Config.Image}}'))"
  CADDYFILE="$(docker inspect "$CADDY_C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
  if [ -z "$CADDYFILE" ]; then
    D="$(docker inspect "$CADDY_C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')"
    [ -n "$D" ] && CADDYFILE="$D/Caddyfile"
  fi
  baris "Caddyfile" "${CADDYFILE:-tidak ditemukan}"
  if [ -z "$CADDYFILE" ] || [ ! -f "$CADDYFILE" ]; then
    MASALAH+=("Caddyfile milik ${CADDY_C} tidak ditemukan di host.")
  fi
  JARINGAN_CADDY="$(docker inspect "$CADDY_C" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')"
  PROXY_NET="$(printf '%s\n' $JARINGAN_CADDY | grep -vx bridge | head -1)"
  baris "Jaringan proxy" "${PROXY_NET:-?} (aplikasi lain: $(docker network inspect "$PROXY_NET" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null))"
  [ -z "$PROXY_NET" ] && MASALAH+=("Jaringan Docker milik Caddy tidak ditemukan.")
  [ "$(printf '%s\n' $JARINGAN_CADDY | grep -vxc bridge)" -gt 1 ] && CATATAN+=("Caddy ada di beberapa jaringan; dipakai: ${PROXY_NET}.")

  if docker exec "$CADDY_C" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    baris "Konfigurasi Caddy saat ini" "valid"
  else
    MASALAH+=("Konfigurasi Caddy yang ADA saat ini tidak lolos 'caddy validate'. Perbaiki dulu sebelum menambah situs.")
  fi
  docker exec "$CADDY_C" sh -c 'command -v wget' >/dev/null 2>&1 || CATATAN+=("Kontainer Caddy tidak punya wget; uji sambungan internal dilewati.")

  if [ -f "$CADDYFILE" ]; then
    # Domain sudah dipakai situs lain (di luar blok milik aplikasi ini)?
    SISA="$(awk -v a="$PENANDA_AWAL" -v z="$PENANDA_AKHIR" 'index($0,a)==1{s=1} !s{print} index($0,z)==1{s=0}' "$CADDYFILE" | sed 's/#.*//')"
    POLA="(^|[[:space:],/])(www\\.)?${DOMAIN//./\\.}([[:space:],:{/]|$)"
    if printf '%s\n' "$SISA" | grep -qE "$POLA"; then
      MASALAH+=("Domain ${DOMAIN} sudah dipakai situs lain di ${CADDYFILE}.")
    fi
    ENV_DOMAIN="$(docker exec "$CADDY_C" printenv DOMAIN 2>/dev/null || true)"
    if [ -n "$ENV_DOMAIN" ] && printf '%s' "$ENV_DOMAIN" | grep -qiE "(^|[ ,])(www\.)?${DOMAIN//./\\.}($|[ ,])"; then
      MASALAH+=("Variabel DOMAIN di ${CADDY_C} sudah berisi ${DOMAIN}.")
    fi
    if grep -qF "$PENANDA_AWAL" "$CADDYFILE"; then
      CATATAN+=("Blok ${DOMAIN} sudah ada di Caddyfile (akan diperbarui).")
    fi
    if [ -d "$(dirname "$CADDYFILE")/.git" ] || git -C "$(dirname "$CADDYFILE")" rev-parse >/dev/null 2>&1; then
      CATATAN+=("Caddyfile berada di repository Git $(dirname "$CADDYFILE"). Setelah dipasang, commit perubahan Caddyfile di repository itu agar blok ${DOMAIN} tidak hilang saat aplikasi tersebut di-deploy ulang.")
    fi
  fi
fi

judul "Nama yang akan dipakai aplikasi ini"
milik_kita() { [ "$(docker container inspect "$1" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null)" = "$NAMA" ]; }
for c in "$WEB" "$DB"; do
  if docker container inspect "$c" >/dev/null 2>&1; then
    if milik_kita "$c"; then baris "Kontainer $c" "sudah ada (milik aplikasi ini — diperbarui)"
    else MASALAH+=("Kontainer bernama $c sudah ada dan BUKAN milik aplikasi ini."); fi
  else
    baris "Kontainer $c" "nama belum dipakai ✔"
  fi
done
if [ -n "$PROXY_NET" ]; then
  # Nama/alias formulasipakan-web di jaringan proxy tidak boleh sudah dipakai kontainer lain
  for c in $(docker network inspect "$PROXY_NET" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null); do
    [ "$c" = "$WEB" ] && milik_kita "$c" && continue
    if docker inspect "$c" --format "{{range \$k,\$v := .NetworkSettings.Networks}}{{if eq \$k \"$PROXY_NET\"}}{{join \$v.Aliases \" \"}} {{join \$v.DNSNames \" \"}}{{end}}{{end}}" 2>/dev/null | tr ' ' '\n' | grep -qxF "$WEB"; then
      MASALAH+=("Nama ${WEB} sudah dipakai kontainer ${c} di jaringan ${PROXY_NET}.")
    fi
  done
  baris "Nama di jaringan ${PROXY_NET}" "${WEB} (unik; tidak memakai 'app'/'db' milik aplikasi lain)"
fi
for v in formulasipakan_db; do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    [ "$(docker volume inspect "$v" --format '{{index .Labels "com.docker.compose.project"}}')" = "$NAMA" ] \
      && baris "Volume $v" "sudah ada (data lama dipertahankan)" \
      || MASALAH+=("Volume Docker $v sudah ada dan bukan milik aplikasi ini.")
  else
    baris "Volume $v" "belum ada ✔"
  fi
done
if docker network inspect formulasipakan_internal >/dev/null 2>&1; then
  [ "$(docker network inspect formulasipakan_internal --format '{{index .Labels "com.docker.compose.project"}}')" = "$NAMA" ] \
    || MASALAH+=("Jaringan Docker formulasipakan_internal sudah ada dan bukan milik aplikasi ini.")
fi
baris "Port host yang dibuka" "TIDAK ADA (hanya diakses Caddy lewat jaringan Docker)"

judul "DNS ${DOMAIN}"
IP_SERVER="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | grep -vE '^(10|127|172\.(1[6-9]|2[0-9]|3[01])|192\.168)\.' | head -1)"
IP_DOMAIN="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')"
IP_WWW="$(getent ahostsv4 "www.$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')"
baris "IP publik VPS" "${IP_SERVER:-?}"
baris "${DOMAIN}" "→ ${IP_DOMAIN:-belum mengarah ke mana pun}"
baris "www.${DOMAIN}" "→ ${IP_WWW:-belum mengarah ke mana pun}"
DNS_OK="tidak"; [ -n "$IP_DOMAIN" ] && [ "$IP_DOMAIN" = "$IP_SERVER" ] && DNS_OK="ya"
WWW_OK="tidak"; [ -n "$IP_WWW" ] && [ "$IP_WWW" = "$IP_SERVER" ] && WWW_OK="ya"
[ "$DNS_OK" = tidak ] && CATATAN+=("DNS ${DOMAIN} belum mengarah ke VPS ini: aplikasi tetap bisa dipasang, HTTPS aktif otomatis setelah DNS diarahkan ke ${IP_SERVER:-IP VPS}.")

judul "Pemasangan sebelumnya"
[ -f "/opt/${NAMA}/.env" ] && baris "/opt/${NAMA}" "sudah ada (mode pembaruan)" || baris "/opt/${NAMA}" "belum ada (pemasangan baru)"

judul "Kesimpulan"
for c in "${CATATAN[@]+"${CATATAN[@]}"}"; do echo "  • $c"; done
if [ "${#MASALAH[@]}" -eq 0 ]; then
  printf '  \033[32m✔ AMAN DIPASANG.\033[0m Kontainer & database aplikasi lain tidak diubah; Caddy hanya ditambah satu blok untuk %s.\n' "$DOMAIN"
  KODE=0
else
  for m in "${MASALAH[@]}"; do printf '  \033[31m✘ %s\033[0m\n' "$m"; done
  KODE=2
fi

if [ -n "${CEK_KELUARAN:-}" ]; then
  {
    echo "CADDY_C=$CADDY_C"
    echo "CADDYFILE=$CADDYFILE"
    echo "PROXY_NET=$PROXY_NET"
    echo "DNS_OK=$DNS_OK"
    echo "WWW_OK=$WWW_OK"
  } > "$CEK_KELUARAN"
fi
exit "$KODE"
