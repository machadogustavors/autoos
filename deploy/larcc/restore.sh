#!/usr/bin/env bash
# Restaura um dump gerado por backup.sh. APAGA os dados atuais do banco.
#
#   sudo bash deploy/larcc/restore.sh /var/backups/autoos/autoos-AAAAMMDD-HHMMSS.sql.gz
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

file="${1:?Informe o arquivo .sql.gz}"
[ -f "$file" ] || { echo "Arquivo não encontrado: $file" >&2; exit 1; }
gzip -t "$file"

read -r -p "Isso SUBSTITUI o banco atual por $file. Digite 'sim' para continuar: " answer
[ "$answer" = "sim" ] || { echo "Cancelado."; exit 1; }

compose=(docker compose -f docker-compose.prod.yml)
# A API segura conexões; para antes de recriar o schema.
"${compose[@]}" stop api
"${compose[@]}" exec -T autoos-db psql -U autoos -d postgres \
  -c "DROP DATABASE IF EXISTS autoos WITH (FORCE)" -c "CREATE DATABASE autoos OWNER autoos"
gunzip -c "$file" | "${compose[@]}" exec -T autoos-db psql -U autoos -d autoos -v ON_ERROR_STOP=1 -q
"${compose[@]}" start api
echo "Restaurado."
