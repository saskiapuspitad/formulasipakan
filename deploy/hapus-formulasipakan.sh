#!/usr/bin/env bash
# =============================================================================
# hapus-formulasipakan.sh — Mencopot Sistem Formulasi Pakan dari VPS.
# HANYA menghapus milik aplikasi ini: layanan formulasipakan-api, situs Nginx
# untuk domainnya, folder /opt & /var/www formulasipakan, cron cadangan, dan
# (bila dipilih) database "formulasipakan". Nginx, PostgreSQL, Node.js sistem,
# dan aplikasi lain TIDAK disentuh. Folder cadangan /var/backups/formulasipakan
# tetap disimpan.
# Pemakaian (di VPS): bash hapus-formulasipakan.sh formulasipakan.id
# =============================================================================
set -euo pipefail
DOMAIN="${1:-formulasipakan.id}"
NAMA="formulasipakan"
[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root."; exit 1; }

echo "Akan dihapus: layanan ${NAMA}-api, situs Nginx ${DOMAIN}, /opt/${NAMA}, /var/www/${NAMA}, cron cadangan."
read -r -p "Ketik HAPUS untuk melanjutkan: " JAWAB
[ "$JAWAB" = "HAPUS" ] || { echo "Dibatalkan."; exit 0; }

if [ -d /run/systemd/system ]; then
  systemctl disable --now "${NAMA}-api" 2>/dev/null || true
  rm -f "/etc/systemd/system/${NAMA}-api.service"
  systemctl daemon-reload
fi
rm -f "/etc/nginx/sites-enabled/${DOMAIN}" "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/conf.d/${DOMAIN}.conf"
if nginx -t 2>/dev/null; then
  if [ -d /run/systemd/system ]; then systemctl reload nginx; else nginx -s reload; fi
fi
rm -f "/etc/cron.d/${NAMA}-cadangan"

read -r -p "Hapus juga DATABASE '${NAMA}' beserta semua akun & formula? (ketik YA): " DB
if [ "$DB" = "YA" ]; then
  PORT="$(sed -nE 's#.*@127\.0\.0\.1:([0-9]+)/.*#\1#p' "/opt/${NAMA}/server/.env" 2>/dev/null || echo 5432)"
  runuser -u postgres -- dropdb -p "${PORT:-5432}" --if-exists "$NAMA"
  runuser -u postgres -- psql -p "${PORT:-5432}" -qc "DROP ROLE IF EXISTS ${NAMA}"
  echo "Database dihapus (cadangan harian tetap ada di /var/backups/${NAMA})."
fi
rm -rf "/opt/${NAMA}" "/var/www/${NAMA}"
id "$NAMA" >/dev/null 2>&1 && userdel "$NAMA" 2>/dev/null || true
echo "Selesai. Sertifikat HTTPS bisa dihapus dengan: certbot delete --cert-name ${DOMAIN}"
