#!/usr/bin/env bash
# =============================================================================
# hapus-docker.sh — Mencopot Sistem Formulasi Pakan versi Docker.
# HANYA menghapus milik aplikasi ini: blok bertanda di Caddyfile (divalidasi &
# dimuat ulang halus), kontainer formulasipakan-web/-db, jaringan internalnya,
# cron cadangan, dan (bila dipilih) volume database. Caddy, kontainer, dan
# database aplikasi lain TIDAK disentuh. Cadangan di /var/backups tetap disimpan.
# Pemakaian (di VPS): bash /opt/formulasipakan/app/deploy/docker/hapus-docker.sh
# =============================================================================
set -euo pipefail
NAMA="formulasipakan"
AKAR="/opt/${NAMA}"
PENANDA_AWAL="# >>> Sistem Formulasi Pakan (${NAMA})"
PENANDA_AKHIR="# <<< Sistem Formulasi Pakan (${NAMA})"
[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }

read -r -p "Copot Sistem Formulasi Pakan dari VPS ini? Ketik HAPUS: " J
[ "$J" = "HAPUS" ] || { echo "Dibatalkan."; exit 0; }

# 1) Blok Caddy
for c in $(docker ps --format '{{.Names}}'); do
  docker inspect "$c" --format '{{.Config.Image}}' | grep -qi caddy || continue
  F="$(docker inspect "$c" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
  [ -n "$F" ] && [ -f "$F" ] && grep -qF "$PENANDA_AWAL" "$F" || continue
  B="${F}.bak-${NAMA}-hapus-$(date +%Y%m%d-%H%M%S)"; cp -p "$F" "$B"
  T="$(mktemp)"
  awk -v a="$PENANDA_AWAL" -v z="$PENANDA_AKHIR" 'index($0,a)==1{s=1} !s{print} index($0,z)==1{s=0; next}' "$F" | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' > "$T"
  if docker exec -i "$c" sh -c "cat > /tmp/Caddyfile.hapus && caddy validate --config /tmp/Caddyfile.hapus --adapter caddyfile" < "$T" >/dev/null 2>&1; then
    cat "$T" > "$F"
    docker exec "$c" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
      && echo "Blok formulasipakan dihapus dari $F (cadangan: $B)." \
      || { cat "$B" > "$F"; echo "!! Reload gagal; Caddyfile dikembalikan."; exit 1; }
  else
    echo "!! Caddyfile tanpa blok ini tidak lolos validasi; tidak diubah."; exit 1
  fi
  rm -f "$T"
done

# 2) Kontainer & jaringan milik proyek ini saja
if [ -f "$AKAR/app/deploy/docker/docker-compose.yml" ] && [ -f "$AKAR/.env" ]; then
  read -r -p "Hapus juga DATABASE (semua akun & formula)? Ketik YA: " DBJ
  if [ "$DBJ" = "YA" ]; then
    docker compose -p "$NAMA" -f "$AKAR/app/deploy/docker/docker-compose.yml" --env-file "$AKAR/.env" down -v
  else
    docker compose -p "$NAMA" -f "$AKAR/app/deploy/docker/docker-compose.yml" --env-file "$AKAR/.env" down
    echo "Volume database formulasipakan_db DIPERTAHANKAN."
  fi
fi
rm -f "/etc/cron.d/${NAMA}-cadangan"
rm -rf "$AKAR/app"
echo "Selesai. Rahasia ${AKAR}/.env & cadangan /var/backups/${NAMA} disimpan (hapus manual bila perlu)."
