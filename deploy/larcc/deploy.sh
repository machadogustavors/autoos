#!/usr/bin/env bash
# Sobe (ou atualiza) o AutoOS na VM: gera os segredos na primeira vez, garante
# o certificado TLS, sobe API + Postgres + Nginx e cadastra o usuário inicial.
#
# Primeira vez:
#   sudo GOOGLE_CLIENT_ID=<id> SEED_USER_EMAIL=<gmail> bash deploy/larcc/deploy.sh
# Para testar sem certificado de verdade (autoassinado, o celular NÃO confia):
#   sudo SELF_SIGNED=1 CERT_HOST=<ip-ou-nome> GOOGLE_CLIENT_ID=... SEED_USER_EMAIL=... bash deploy/larcc/deploy.sh
# Atualizar depois de um `git pull`:
#   sudo bash deploy/larcc/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
COMPOSE=(docker compose -f docker-compose.prod.yml)

API_ENV="api/.env"       # lido pela API
ROOT_ENV=".env"          # lido pelo compose (POSTGRES_PASSWORD)
CERT_DIR="deploy/certs"

# ---------------------------------------------------------------- segredos
if [ ! -f "$API_ENV" ]; then
  : "${GOOGLE_CLIENT_ID:?Defina GOOGLE_CLIENT_ID (ID do cliente OAuth Web) na primeira execução}"
  : "${SEED_USER_EMAIL:?Defina SEED_USER_EMAIL (Gmail que vai entrar; sem ele o login dá 403)}"

  db_password="$(openssl rand -hex 24)"
  jwt_secret="$(openssl rand -hex 32)"

  umask 077
  printf 'POSTGRES_PASSWORD=%s\n' "$db_password" > "$ROOT_ENV"
  cat > "$API_ENV" <<EOF
DATABASE_URL="postgresql://autoos:${db_password}@autoos-db:5432/autoos"
JWT_SECRET="${jwt_secret}"
JWT_ACCESS_TOKEN_TTL="15m"
JWT_REFRESH_TOKEN_TTL="30d"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}"
LARCC_MQTT_HOST="${LARCC_MQTT_HOST:-}"
LARCC_MQTT_PORT="${LARCC_MQTT_PORT:-8883}"
PORT="3000"
SEED_USER_EMAIL="${SEED_USER_EMAIL}"
SEED_USER_NAME="${SEED_USER_NAME:-Mecânico}"
EOF
  echo "Segredos gerados em $API_ENV e $ROOT_ENV (modo 600). Guarde uma cópia fora da VM."
elif [ ! -f "$ROOT_ENV" ]; then
  echo "Existe $API_ENV mas falta $ROOT_ENV (POSTGRES_PASSWORD). Crie-o com a mesma senha do DATABASE_URL." >&2
  exit 1
fi

# ------------------------------------------------------------ certificado TLS
if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/privkey.pem" ]; then
  if [ "${SELF_SIGNED:-0}" = "1" ]; then
    host="${CERT_HOST:-localhost}"
    mkdir -p "$CERT_DIR"
    # IP e nome entram no SAN; sem isso nem o curl -k reclama menos.
    if [[ "$host" =~ ^[0-9.]+$ ]]; then san="IP:$host"; else san="DNS:$host"; fi
    # O openssl escreve ruído de progresso no stderr; só mostra se falhar.
    if ! out="$(openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
      -subj "/CN=$host" -addext "subjectAltName=$san" \
      -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" 2>&1)"; then
      echo "Falha ao criar o certificado autoassinado:" >&2
      echo "$out" >&2
      rm -f "$CERT_DIR/privkey.pem" "$CERT_DIR/fullchain.pem"
      exit 1
    fi
    echo "Certificado AUTOASSINADO de 30 dias criado para $host. Só serve para teste."
  else
    echo "Faltam $CERT_DIR/fullchain.pem e $CERT_DIR/privkey.pem." >&2
    echo "Coloque o certificado real lá (ver deploy/larcc/README.md) ou use SELF_SIGNED=1 para testar." >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------- subir
"${COMPOSE[@]}" up -d --build

echo "Esperando a API responder..."
ok=0
for _ in $(seq 1 60); do
  if curl -sfk https://localhost/v1/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo "A API não respondeu em 2 minutos. Veja: ${COMPOSE[*]} logs api" >&2
  exit 1
fi

# Upsert por e-mail: rodar de novo não duplica.
"${COMPOSE[@]}" exec -T api npx prisma db seed

echo
echo "AutoOS no ar: $(curl -sk https://localhost/v1/health)"
