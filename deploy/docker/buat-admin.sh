#!/usr/bin/env bash
# Buat akun admin Sistem Formulasi Pakan (versi Docker).
# Pemakaian (di VPS):  bash /opt/formulasipakan/app/deploy/docker/buat-admin.sh email@anda.com "Nama Anda"
set -euo pipefail
EMAIL="${1:-}"
NAMA_ADMIN="${2:-Admin Formulasi Pakan}"
[ -n "$EMAIL" ] || { echo 'Pemakaian: bash buat-admin.sh email@anda.com "Nama Anda"'; exit 1; }
docker exec formulasipakan-web node scripts/buat-admin.js --email "$EMAIL" --nama "$NAMA_ADMIN"
