#!/usr/bin/env bash
# =============================================================================
# pasang-docker.sh — Pasang / perbarui Sistem Formulasi Pakan sebagai kontainer
# Docker di belakang Caddy yang sudah ada (VPS bersama aplikasi lain).
# Dijalankan otomatis oleh:  ./deploy/kirim-ke-vps.sh --docker root@IP-VPS formulasipakan.id
#
# Urutan aman:
#   1. Pemeriksaan (cek-docker.sh) — batal sebelum mengubah apa pun bila ada yang tidak cocok.
#   2. Bangun & jalankan kontainer formulasipakan-web + formulasipakan-db (tanpa membuka port host).
#   3. Pastikan Caddy bisa menjangkau formulasipakan-web — BELUM mengubah Caddyfile.
#   4. Catat kondisi semua situs lain di Caddy.
#   5. Cadangkan Caddyfile → tambah/perbarui SATU blok bertanda → `caddy validate`.
#   6. `caddy reload` (halus, tanpa restart). Gagal / situs lain terganggu → Caddyfile
#      dikembalikan otomatis & dimuat ulang.
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root (atau dengan sudo)."; exit 1; }

DOMAIN="${1:-formulasipakan.id}"
RILIS="$(cd "$(dirname "$0")/../.." && pwd)"
NAMA="formulasipakan"
AKAR="/opt/${NAMA}"
APP="${AKAR}/app"
ENV="${AKAR}/.env"
WEB="${NAMA}-web"
CADANGAN_DB="/var/backups/${NAMA}"
PENANDA_AWAL="# >>> Sistem Formulasi Pakan (${NAMA})"
PENANDA_AKHIR="# <<< Sistem Formulasi Pakan (${NAMA})"
langkah() { printf '\n==> %s\n' "$*"; }

# Nama domain harus sah (huruf kecil, angka, tanda hubung, titik) — tolak masukan aneh
if ! printf '%s' "$DOMAIN" | grep -qE '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$'; then
  echo "Nama domain tidak sah: '$DOMAIN' (contoh yang benar: formulasipakan.id)"; exit 2
fi

# ---------------------------------------------------------------------------
langkah "1. Pemeriksaan (belum ada yang diubah)…"
HASIL="$(mktemp)"
set +e
CEK_KELUARAN="$HASIL" bash "$RILIS/deploy/docker/cek-docker.sh" "$DOMAIN"
KODE=$?
set -e
if [ "$KODE" -ne 0 ]; then
  rm -f "$HASIL"
  echo; echo "Pemasangan DIBATALKAN. Tidak ada yang diubah di VPS ini."
  echo "Salin seluruh hasil di atas dan kirimkan ke pengembang."
  exit 2
fi
# shellcheck disable=SC1090
. "$HASIL"; rm -f "$HASIL"

# ---------------------------------------------------------------------------
langkah "2. Menyalin kode ke ${APP} & menyiapkan rahasia…"
mkdir -p "$APP" "$CADANGAN_DB"
rsync -a --delete --exclude node_modules --exclude dist --exclude '.env' --exclude '.env.*' --exclude 'pgdata*' --exclude .git "$RILIS/" "$APP/"
if [ ! -f "$ENV" ]; then
  umask 077
  cat > "$ENV" <<ISI
# Rahasia Sistem Formulasi Pakan — JANGAN dibagikan / di-commit
DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
PROXY_NETWORK=${PROXY_NET}
IZINKAN_DAFTAR=true
ISI
  umask 022
  echo "   ${ENV} dibuat (sandi database & kunci sesi acak)."
else
  sed -i "s/^PROXY_NETWORK=.*/PROXY_NETWORK=${PROXY_NET}/" "$ENV"
  echo "   ${ENV} sudah ada — dipakai apa adanya."
fi
chmod 600 "$ENV"

COMPOSE=(docker compose -p "$NAMA" -f "$APP/deploy/docker/docker-compose.yml" --env-file "$ENV")

# ---------------------------------------------------------------------------
langkah "3. Membangun image & menjalankan kontainer ${NAMA} (kontainer lain tidak disentuh)…"
if [ -z "${FP_LEWATI_BUILD:-}" ]; then
  "${COMPOSE[@]}" build
fi
"${COMPOSE[@]}" up -d
echo -n "   Menunggu ${WEB} sehat"
for i in $(seq 1 90); do
  STATUS="$(docker container inspect "$WEB" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || echo '?')"
  [ "$STATUS" = "healthy" ] && break
  if [ "$STATUS" = "unhealthy" ] || [ "$i" -eq 90 ]; then
    echo; echo "!! ${WEB} tidak sehat (${STATUS}). Caddy BELUM diubah; situs lain aman."
    docker logs --tail 40 "$WEB" 2>&1 | sed 's/^/   | /'
    exit 1
  fi
  echo -n "."; sleep 2
done
echo " ✔"

# ---------------------------------------------------------------------------
langkah "4. Memastikan Caddy (${CADDY_C}) bisa menjangkau ${WEB}…"
if docker exec "$CADDY_C" sh -c 'command -v wget' >/dev/null 2>&1; then
  if docker exec "$CADDY_C" wget -qO- -T 10 "http://${WEB}:3000/api/sehat" 2>/dev/null | grep -q '"aplikasi":"formulasipakan"'; then
    echo "   ✔ ${CADDY_C} → ${WEB}:3000 tersambung"
  else
    echo "!! ${CADDY_C} tidak bisa menjangkau ${WEB}:3000 lewat jaringan ${PROXY_NET}. Caddy BELUM diubah."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Daftar situs lain di Caddyfile + kode HTTP-nya sekarang (untuk dibandingkan setelah reload)
DOMAIN_ENV="$(docker exec "$CADDY_C" printenv DOMAIN 2>/dev/null || true)"
daftar_situs() {
  awk -v a="$PENANDA_AWAL" -v z="$PENANDA_AKHIR" 'index($0,a)==1{s=1} !s{print} index($0,z)==1{s=0}' "$CADDYFILE" \
    | grep -E '^([^[:space:]#{]|\{\$)[^#]*\{[[:space:]]*$' | sed -E 's/\{[[:space:]]*$//' \
    | sed "s#{\\\$DOMAIN}#${DOMAIN_ENV}#g" | tr ', ' '\n\n' | grep -vE '^$|^\(' \
    | sed -E 's#^https?://##; s#:[0-9]+$##; s#/.*##' | grep -E '\.' | sort -u
}
kode_situs() { curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$1:443:127.0.0.1" "https://$1/" 2>/dev/null || true; }
declare -A SEBELUM=()
langkah "5. Mencatat kondisi situs lain sebelum Caddy diubah…"
for s in $(daftar_situs); do SEBELUM[$s]="$(kode_situs "$s")"; printf '   %-34s %s\n' "$s" "${SEBELUM[$s]}"; done

# ---------------------------------------------------------------------------
langkah "6. Menambah blok ${DOMAIN} ke ${CADDYFILE} (cadangan dibuat dulu)…"
WAKTU="$(date +%Y%m%d-%H%M%S)"
CADANGAN="${CADDYFILE}.bak-${NAMA}-${WAKTU}"
cp -p "$CADDYFILE" "$CADANGAN"
echo "   Cadangan: ${CADANGAN}"
# simpan hanya 5 cadangan terakhir milik aplikasi ini (cadangan aplikasi lain tidak disentuh)
ls -1t "${CADDYFILE}".bak-${NAMA}-* 2>/dev/null | tail -n +6 | xargs -r rm -f
BARU="$(mktemp)"
{
  awk -v a="$PENANDA_AWAL" -v z="$PENANDA_AKHIR" 'index($0,a)==1{s=1} !s{print} index($0,z)==1{s=0; next}' "$CADDYFILE" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}'
  cat <<BLOK

${PENANDA_AWAL} — ditambahkan oleh deploy/docker/pasang-docker.sh
${DOMAIN} {
	encode zstd gzip
	reverse_proxy ${WEB}:3000

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}

www.${DOMAIN} {
	redir https://${DOMAIN}{uri} permanent
}
${PENANDA_AKHIR}
BLOK
} > "$BARU"

kembalikan() {
  echo "   Mengembalikan Caddyfile dari cadangan…"
  cat "$CADANGAN" > "$CADDYFILE"
  docker exec "$CADDY_C" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
    && echo "   Caddyfile lama dimuat ulang — situs lain kembali seperti semula." \
    || echo "!! Gagal memuat ulang Caddyfile lama. Periksa: docker logs ${CADDY_C}"
}

if ! docker exec -i "$CADDY_C" sh -c "cat > /tmp/Caddyfile.${NAMA} && caddy validate --config /tmp/Caddyfile.${NAMA} --adapter caddyfile" < "$BARU" > /tmp/${NAMA}-validasi.log 2>&1; then
  tail -5 /tmp/${NAMA}-validasi.log | sed 's/^/   | /'
  echo "!! Caddyfile baru tidak lolos validasi — TIDAK diterapkan. Caddyfile lama tidak berubah."
  rm -f "$BARU"; exit 1
fi
echo "   ✔ Caddyfile baru lolos 'caddy validate'"

INODE="$(stat -c %i "$CADDYFILE")"
cat "$BARU" > "$CADDYFILE"          # tulis di tempat: berkas yang di-mount ke kontainer tetap sama
rm -f "$BARU"
if [ "$(stat -c %i "$CADDYFILE")" != "$INODE" ] || ! docker exec "$CADDY_C" grep -qF "$PENANDA_AWAL" /etc/caddy/Caddyfile; then
  echo "!! Kontainer Caddy tidak melihat perubahan Caddyfile."; kembalikan; exit 1
fi

langkah "7. Memuat ulang Caddy secara halus (tanpa restart)…"
if ! docker exec "$CADDY_C" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile > /tmp/${NAMA}-reload.log 2>&1; then
  tail -5 /tmp/${NAMA}-reload.log | sed 's/^/   | /'
  echo "!! caddy reload gagal."; kembalikan; exit 1
fi
sleep 3

langkah "8. Memastikan situs lain tidak terganggu…"
RUSAK=""
for s in "${!SEBELUM[@]}"; do
  a="${SEBELUM[$s]}"; b="$(kode_situs "$s")"
  printf '   %-34s %s → %s\n' "$s" "$a" "$b"
  if [ "$a" != "000" ] && { [ "$b" = "000" ] || { [ "${b:0:1}" = "5" ] && [ "${a:0:1}" != "5" ]; }; }; then RUSAK="$RUSAK $s"; fi
done
if [ -n "$RUSAK" ]; then
  echo "!! Situs terganggu setelah reload:${RUSAK}"; kembalikan; exit 1
fi
echo "   ✔ Semua situs lain tetap seperti sebelumnya"

KODE_HTTP="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: ${DOMAIN}" http://127.0.0.1/ || true)"
KODE_HTTPS="$(curl -sk --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 15 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/sehat" 2>/dev/null || true)"

# ---------------------------------------------------------------------------
langkah "9. Cadangan database harian 02.30 (disimpan 14 hari di ${CADANGAN_DB})…"
cat > "/etc/cron.d/${NAMA}-cadangan" <<ISI
30 2 * * * root docker exec ${NAMA}-db pg_dump -U ${NAMA} -Fc ${NAMA} > ${CADANGAN_DB}/${NAMA}-\$(date +\\%F).dump && find ${CADANGAN_DB} -name '*.dump' -mtime +14 -delete
ISI
chmod 644 "/etc/cron.d/${NAMA}-cadangan"

ADMIN="$(docker exec ${NAMA}-db psql -U ${NAMA} -d ${NAMA} -tAc "SELECT count(*) FROM pengguna WHERE peran='admin'" 2>/dev/null | tr -d ' ' || echo 0)"
echo
echo "================================================================"
echo " Sistem Formulasi Pakan terpasang (Docker)."
echo "   Kontainer : ${WEB}, ${NAMA}-db   ·   Jaringan: ${PROXY_NET}"
echo "   Caddy     : blok ${DOMAIN} aktif (http ${KODE_HTTP:-?})"
if [ "$KODE_HTTPS" = "200" ]; then
  echo "   HTTPS     : aktif ✔  https://${DOMAIN}"
else
  echo "   HTTPS     : belum (kode ${KODE_HTTPS:-000}). Caddy membuat sertifikat otomatis setelah"
  echo "               DNS ${DOMAIN} & www mengarah ke VPS ini — tidak perlu menjalankan ulang."
fi
echo "   Aplikasi lain tidak dihentikan atau diubah."
[ "${ADMIN:-0}" = "0" ] && echo && echo " Buat admin:  bash ${APP}/deploy/docker/buat-admin.sh email@anda.com \"Nama Anda\""
echo "================================================================"
