#!/usr/bin/env bash
#
# Deploy remoto: ejecuta deploy-vps.sh en el VPS vía SSH.
#
# Uso:
#   cp deploy.config.example deploy.config   # editar con tus datos
#   chmod +x scripts/deploy-remote.sh
#   ./scripts/deploy-remote.sh full          # primera instalación
#   ./scripts/deploy-remote.sh deploy        # actualizar (default)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONFIG_FILE="$PROJECT_ROOT/deploy.config"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: no existe deploy.config"
  echo "Copiá deploy.config.example → deploy.config y completá los valores."
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${VPS_HOST:?Definí VPS_HOST en deploy.config}"
: "${VPS_USER:?Definí VPS_USER en deploy.config}"

APP_DIR="${APP_DIR:-/opt/whats-claude}"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
APP_PORT="${APP_PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-22}"
DOMAIN="${DOMAIN:-}"
SKIP_NGINX="${SKIP_NGINX:-0}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"

CMD="${1:-deploy}"
REMOTE="$VPS_USER@$VPS_HOST"

SSH_OPTS=(-p "$SSH_PORT" -o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi

echo "[deploy-remote] Conectando a $REMOTE..."

# Sincronizar código local al VPS (excluye node_modules, .next, data, auth)
if [[ "$CMD" == "deploy" ]] && [[ "${SYNC_LOCAL:-0}" == "1" ]]; then
  echo "[deploy-remote] Sincronizando código local → $APP_DIR ..."
  rsync -az --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude data \
    --exclude auth \
    --exclude logs \
    --exclude .git \
    --exclude .env \
    -e "ssh ${SSH_OPTS[*]}" \
    "$PROJECT_ROOT/" "$REMOTE:$APP_DIR/"
fi

# Pasar variables al script remoto
ENV_EXPORTS="APP_DIR='$APP_DIR' GIT_REPO='$GIT_REPO' GIT_BRANCH='$GIT_BRANCH' APP_PORT='$APP_PORT' NODE_MAJOR='$NODE_MAJOR' DOMAIN='$DOMAIN' SKIP_NGINX='$SKIP_NGINX'"

ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s <<REMOTE_SCRIPT
set -euo pipefail
export $ENV_EXPORTS

if [[ ! -d "$APP_DIR" ]]; then
  if [[ -z "$GIT_REPO" ]]; then
    echo "Error: APP_DIR no existe y GIT_REPO está vacío."
    exit 1
  fi
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "\$USER:\$USER" "$APP_DIR"
  git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f scripts/deploy-vps.sh ]]; then
  echo "Error: no se encontró scripts/deploy-vps.sh en $APP_DIR"
  exit 1
fi

chmod +x scripts/deploy-vps.sh
$ENV_EXPORTS ./scripts/deploy-vps.sh "$CMD"
REMOTE_SCRIPT

echo "[deploy-remote] Listo."
