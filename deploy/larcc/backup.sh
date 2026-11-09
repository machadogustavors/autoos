#!/usr/bin/env bash
# Dump do Postgres do AutoOS, comprimido e verificado. O disco da VM do LARCC
# é local e pode falhar: este arquivo NÃO é backup enquanto ficar só na VM —
# copie para outro lugar (ver deploy/larcc/README.md, "Backup").
#
#   sudo bash deploy/larcc/backup.sh
#
# Variáveis: BACKUP_DIR (padrão /var/backups/autoos), KEEP_DAYS (padrão 14).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/autoos}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

stamp="$(date +%Y%m%d-%H%M%S)"
tmp="$BACKUP_DIR/autoos-$stamp.sql.gz.tmp"
final="$BACKUP_DIR/autoos-$stamp.sql.gz"

# Escreve num .tmp e só renomeia depois de validar: nunca sobra um backup
# truncado com cara de bom.
docker compose -f docker-compose.prod.yml exec -T autoos-db \
  pg_dump -U autoos -d autoos --no-owner | gzip > "$tmp"
gzip -t "$tmp"
if [ "$(wc -c < "$tmp")" -lt 200 ]; then
  rm -f "$tmp"
  echo "Dump suspeito de tão pequeno; nada gravado." >&2
  exit 1
fi
mv "$tmp" "$final"

find "$BACKUP_DIR" -name 'autoos-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "Backup: $final ($(du -h "$final" | cut -f1))"
