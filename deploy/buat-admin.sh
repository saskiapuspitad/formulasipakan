#!/usr/bin/env bash
# Buat akun admin Sistem Formulasi Pakan (atau jadikan akun yang ada sebagai admin).
# Pemakaian (di VPS, sebagai root):  bash /opt/formulasipakan/buat-admin.sh email@anda.com "Nama Anda"
set -euo pipefail
EMAIL="${1:-}"
NAMA_ADMIN="${2:-Admin Formulasi Pakan}"
if [ -z "$EMAIL" ]; then
  echo 'Pemakaian: bash /opt/formulasipakan/buat-admin.sh email@anda.com "Nama Anda"'
  exit 1
fi
cd /opt/formulasipakan/server
runuser -u formulasipakan -- env HOME=/opt/formulasipakan PATH="/opt/formulasipakan/node/bin:/usr/bin:/bin" \
  node --env-file=.env scripts/buat-admin.js --email "$EMAIL" --nama "$NAMA_ADMIN"
