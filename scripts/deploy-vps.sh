#!/usr/bin/env bash
#
# Deploy automático en VPS (Ubuntu/Debian).
#
# Uso en el servidor:
#   chmod +x scripts/deploy-vps.sh
#   ./scripts/deploy-vps.sh full          # primera vez: sistema + app
#   ./scripts/deploy-vps.sh deploy        # actualizar código y reiniciar
#   ./scripts/deploy-vps.sh system        # solo dependencias del SO
#   ./scripts/deploy-vps.sh status        # estado PM2
#
# Variables opcionales (export o deploy.config en la raíz del repo):
#   APP_DIR=/opt/whats-claude
#   GIT_REPO=https://github.com/tu-usuario/whats-claude.git
#   GIT_BRANCH=main
#   APP_PORT=3000
#   NODE_MAJOR=22
#   DOMAIN=bot.tudominio.com   # si se define, configura Nginx como reverse proxy
#   SKIP_NGINX=1               # no tocar nginx aunque haya DOMAIN
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck disable=SC1091
if [[ -f "$PROJECT_ROOT/deploy.config" ]]; then
  source "$PROJECT_ROOT/deploy.config"
fi

APP_DIR="${APP_DIR:-$PROJECT_ROOT}"
GIT_REPO="${GIT_REPO:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
APP_PORT="${APP_PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-22}"
DOMAIN="${DOMAIN:-}"
SKIP_NGINX="${SKIP_NGINX:-0}"
PM2_APP="ecosystem.config.cjs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Falta el comando '$1'."
}

has_sudo() {
  command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null
}

run_as_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  elif has_sudo; then
    sudo "$@"
  else
    fail "Se necesita root o sudo para: $*"
  fi
}

detect_os() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    echo "${ID:-unknown}"
  else
    echo "unknown"
  fi
}

install_system_packages() {
  local os
  os="$(detect_os)"
  log "Instalando dependencias del sistema (OS: $os)..."

  case "$os" in
    ubuntu|debian)
      run_as_root apt-get update -qq
      run_as_root apt-get install -y \
        curl git ca-certificates gnupg \
        build-essential python3 \
        nginx ufw
      ;;
    *)
      warn "OS no reconocido ($os). Instalá manualmente: curl git build-essential python3 nginx"
      ;;
  esac
  ok "Paquetes del sistema listos."
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    local current_major
    current_major="$(node -p "process.versions.node.split('.')[0]")"
    if [[ "$current_major" -ge 20 ]]; then
      ok "Node.js ya instalado: $(node -v)"
      return
    fi
    warn "Node $(node -v) es viejo; instalando Node $NODE_MAJOR..."
  fi

  log "Instalando Node.js $NODE_MAJOR..."
  local os
  os="$(detect_os)"
  case "$os" in
    ubuntu|debian)
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | run_as_root -E bash -
      run_as_root apt-get install -y nodejs
      ;;
    *)
      fail "Instalá Node.js $NODE_MAJOR+ manualmente en $os."
      ;;
  esac
  ok "Node.js $(node -v) / npm $(npm -v)"
}

ensure_app_dir() {
  if [[ "$APP_DIR" != "$PROJECT_ROOT" ]] && [[ ! -d "$APP_DIR" ]]; then
    log "Creando directorio de la app: $APP_DIR"
    run_as_root mkdir -p "$APP_DIR"
    run_as_root chown -R "${SUDO_USER:-$USER}:${SUDO_USER:-$USER}" "$APP_DIR"
  fi
}

assert_app_dir_writable() {
  local parent
  parent="$(dirname "$APP_DIR")"

  if [[ -d "$APP_DIR" ]]; then
    if [[ ! -w "$APP_DIR" ]]; then
      fail "Sin permiso de escritura en $APP_DIR.
  Opciones:
    1) Desplegar en tu home (recomendado si no sos root):
         echo 'APP_DIR=$HOME/claude_whats' >> $PROJECT_ROOT/deploy.config
         # o: APP_DIR=$HOME/claude_whats ./scripts/deploy-vps.sh deploy
    2) Crear /opt con sudo:
         sudo mkdir -p $APP_DIR && sudo chown -R \$USER:\$USER $APP_DIR"
    fi
    return
  fi

  if [[ ! -w "$parent" ]]; then
    fail "No se puede crear $APP_DIR (sin permiso en $parent).
  Opciones:
    1) Usá el repo donde ya estás:
         APP_DIR=$PROJECT_ROOT ./scripts/deploy-vps.sh deploy
    2) Creá el dir con sudo:
         sudo mkdir -p $APP_DIR && sudo chown -R \$USER:\$USER $APP_DIR"
  fi
}

clone_or_update_repo() {
  # Si GIT_REPO sigue siendo el placeholder del example, ignorarlo.
  if [[ "$GIT_REPO" == *"TU_USUARIO"* ]]; then
    warn "GIT_REPO tiene el placeholder TU_USUARIO — se ignora. Editá deploy.config con la URL real."
    GIT_REPO=""
  fi

  assert_app_dir_writable

  if [[ -d "$APP_DIR/.git" ]]; then
    log "Actualizando repositorio en $APP_DIR..."
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" checkout "$GIT_BRANCH"
    git -C "$APP_DIR" pull origin "$GIT_BRANCH"
  elif [[ -n "$GIT_REPO" ]]; then
    log "Clonando $GIT_REPO → $APP_DIR"
    git clone --branch "$GIT_BRANCH" --depth 1 "$GIT_REPO" "$APP_DIR"
  elif [[ -f "$APP_DIR/package.json" ]]; then
    warn "Sin GIT_REPO; usando código existente en $APP_DIR"
  else
    fail "No hay repo en $APP_DIR. Definí GIT_REPO real en deploy.config o cloná manualmente.
  Ejemplo:
    APP_DIR=$PROJECT_ROOT GIT_REPO= ./scripts/deploy-vps.sh deploy"
  fi
}

setup_env_file() {
  local env_file="$APP_DIR/.env"
  local example="$APP_DIR/.env.example"

  if [[ -f "$env_file" ]]; then
    ok "Ya existe $env_file (no se sobrescribe)."
    return
  fi

  if [[ ! -f "$example" ]]; then
    fail "No se encontró .env.example en $APP_DIR"
  fi

  cp "$example" "$env_file"
  warn "Se creó $env_file desde .env.example"
  warn "Editá las API keys antes de usar en producción:"
  warn "  nano $env_file"
}

setup_persistent_dirs() {
  log "Creando directorios persistentes (data/, auth/, logs/)..."
  mkdir -p "$APP_DIR/data" "$APP_DIR/auth" "$APP_DIR/logs"
  ok "Directorios persistentes listos."
}

install_app_dependencies() {
  log "Instalando dependencias npm..."
  cd "$APP_DIR"
  npm ci --include=dev
  ok "Dependencias instaladas."
}

build_app() {
  log "Compilando Next.js..."
  cd "$APP_DIR"
  export NODE_ENV=production
  npm run build
  ok "Build completado."
}

start_pm2() {
  log "Iniciando/reiniciando procesos con PM2..."
  cd "$APP_DIR"
  export NODE_ENV=production
  export PORT="$APP_PORT"

  if npx pm2 describe whats-claude-bot >/dev/null 2>&1; then
    npx pm2 restart "$PM2_APP" --update-env
  else
    npx pm2 start "$PM2_APP"
  fi

  npx pm2 save
  ok "PM2 corriendo."
}

setup_pm2_startup() {
  log "Configurando PM2 para arranque automático al boot..."
  cd "$APP_DIR"

  local startup_cmd
  startup_cmd="$(npx pm2 startup systemd -u "${SUDO_USER:-$USER}" --hp "$HOME" 2>&1 | grep "sudo env" || true)"

  if [[ -n "$startup_cmd" ]]; then
    warn "Ejecutá este comando una vez (copiado de pm2 startup):"
    echo "$startup_cmd"
    if has_sudo; then
      eval "$startup_cmd" || warn "pm2 startup requiere ejecutarse manualmente."
    fi
  fi

  npx pm2 save
  ok "PM2 save completado."
}

setup_nginx() {
  if [[ "$SKIP_NGINX" == "1" ]] || [[ -z "$DOMAIN" ]]; then
    log "Nginx omitido (DOMAIN vacío o SKIP_NGINX=1)."
    return
  fi

  log "Configurando Nginx para $DOMAIN → localhost:$APP_PORT..."

  local conf="/etc/nginx/sites-available/whats-claude"
  local enabled="/etc/nginx/sites-enabled/whats-claude"

  run_as_root tee "$conf" >/dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

  run_as_root ln -sf "$conf" "$enabled"
  run_as_root rm -f /etc/nginx/sites-enabled/default
  run_as_root nginx -t
  run_as_root systemctl enable nginx
  run_as_root systemctl reload nginx

  ok "Nginx configurado. Considerá certificado SSL: certbot --nginx -d $DOMAIN"
}

setup_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    return
  fi
  if ! has_sudo; then
    return
  fi

  log "Configurando firewall (ufw)..."
  run_as_root ufw allow OpenSSH || true
  run_as_root ufw allow 80/tcp || true
  run_as_root ufw allow 443/tcp || true

  if [[ -z "$DOMAIN" ]]; then
    run_as_root ufw allow "${APP_PORT}/tcp" || true
  fi

  run_as_root ufw --force enable || true
  ok "Firewall configurado."
}

print_summary() {
  local ip
  ip="$(curl -fsSL --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "TU_IP")"

  echo ""
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Deploy completado${NC}"
  echo -e "${GREEN}════════════════════════════════════════════${NC}"
  echo ""
  echo "  App dir:    $APP_DIR"
  echo "  PM2:"
  cd "$APP_DIR" && npx pm2 status || true
  echo ""
  if [[ -n "$DOMAIN" ]]; then
    echo "  Dashboard:  http://${DOMAIN}/"
    echo "  Setup QR:   http://${DOMAIN}/setup"
  else
    echo "  Dashboard:  http://${ip}:${APP_PORT}/"
    echo "  Setup QR:   http://${ip}:${APP_PORT}/setup"
  fi
  echo ""
  echo "  Logs:       cd $APP_DIR && npm run pm2:logs"
  echo "  Reiniciar:  cd $APP_DIR && npm run pm2:restart"
  echo "  .env:       nano $APP_DIR/.env"
  echo ""
}

cmd_system() {
  install_system_packages
  install_node
  ok "Setup del sistema completado."
}

cmd_full() {
  need_cmd git
  install_system_packages
  install_node
  ensure_app_dir
  clone_or_update_repo
  setup_env_file
  setup_persistent_dirs
  install_app_dependencies
  build_app
  start_pm2
  setup_pm2_startup
  setup_firewall
  setup_nginx
  print_summary
}

cmd_deploy() {
  need_cmd git
  need_cmd node
  need_cmd npm
  clone_or_update_repo
  setup_persistent_dirs
  install_app_dependencies
  build_app
  start_pm2
  print_summary
}

cmd_status() {
  cd "$APP_DIR"
  npx pm2 status
  npx pm2 logs --lines 30 --nostream
}

usage() {
  cat <<EOF
Uso: $0 [comando]

Comandos:
  full     Primera instalación completa (sistema + app + PM2 + nginx opcional)
  deploy   Actualizar código, rebuild y reiniciar PM2 (default)
  system   Solo instalar Node.js y paquetes del SO
  status   Ver estado y últimos logs de PM2

Configuración (export o archivo deploy.config en la raíz):
  APP_DIR, GIT_REPO, GIT_BRANCH, APP_PORT, NODE_MAJOR, DOMAIN, SKIP_NGINX

Ejemplo primera vez:
  export GIT_REPO=https://github.com/tu-usuario/whats-claude.git
  export APP_DIR=/opt/whats-claude
  export DOMAIN=bot.tudominio.com
  ./scripts/deploy-vps.sh full

Ejemplo actualización:
  ./scripts/deploy-vps.sh deploy
EOF
}

main() {
  local cmd="${1:-deploy}"
  case "$cmd" in
    full)   cmd_full ;;
    deploy) cmd_deploy ;;
    system) cmd_system ;;
    status) cmd_status ;;
    -h|--help|help) usage ;;
    *) fail "Comando desconocido: $cmd. Usá --help." ;;
  esac
}

main "$@"
