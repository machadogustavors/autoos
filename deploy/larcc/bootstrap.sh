#!/usr/bin/env bash
# Prepara uma VM Ubuntu do LARCC para rodar o AutoOS: Docker, git, firewall e
# o código em /opt/autoos. Rode UMA vez, como root, DENTRO da VM:
#
#   sudo bash bootstrap.sh
#
# Idempotente: rodar de novo só atualiza o código.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/machadogustavors/autoos}"
APP_DIR="${APP_DIR:-/opt/autoos}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root: sudo bash $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw openssl docker.io

# `docker compose` (plugin v2). O nome do pacote muda conforme a versão do Ubuntu.
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 \
    || apt-get install -y docker-compose-plugin \
    || {
      echo "Não achei o plugin 'docker compose' nos repositórios desta versão do Ubuntu." >&2
      echo "Instale pelo repositório oficial: https://docs.docker.com/engine/install/ubuntu/" >&2
      exit 1
    }
fi
systemctl enable --now docker

# Firewall da própria VM. O SSH vem PRIMEIRO: ligar o ufw sem ele te tranca
# fora da máquina. O Docker publica as portas por conta própria (passa por
# cima do ufw), por isso o docker-compose.prod.yml só publica 80 e 443 e
# nunca a porta do Postgres.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

echo
echo "Pronto. Próximo passo:"
echo "  cd $APP_DIR && sudo GOOGLE_CLIENT_ID=... SEED_USER_EMAIL=... bash deploy/larcc/deploy.sh"
