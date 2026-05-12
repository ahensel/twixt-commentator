#!/usr/bin/env bash
# deploy.sh — push the app to the production server and restart it.
#
# Usage (from the project root):
#   ./deploy.sh
#
# Prerequisites on the remote server (one-time setup):
#   sudo apt install -y nginx
#   npm install -g pm2
#   pm2 startup   # follow the printed instructions to enable auto-start on reboot
#   sudo nginx -t && sudo systemctl enable nginx

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
REMOTE_USER="ubuntu"
REMOTE_HOST="yammy.local"   # or IP address
REMOTE_DIR="/home/ubuntu/twixt-commentator"
APP_NAME="twixt-commentator"         # pm2 process name
# ──────────────────────────────────────────────────────────────────────────────

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}…"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.env.prod' \
  --exclude '.DS_Store' \
  . "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"

echo "==> Copying .env.prod to server as .env…"
scp .env.prod "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/.env"

echo "==> Installing production dependencies on server…"
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "bash -lc 'cd ${REMOTE_DIR} && npm ci --omit=dev'"

echo "==> Running database migrations…"
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "bash -lc 'cd ${REMOTE_DIR} && set -a && source .env && set +a && npx sequelize-cli db:migrate --env production'"

echo "==> Restarting app with pm2…"
ssh "${REMOTE_USER}@${REMOTE_HOST}" \
  "bash -lc 'cd ${REMOTE_DIR} && pm2 startOrRestart ecosystem.config.js --env production && pm2 save'"

echo "==> Installing nginx config and reloading…"
ssh "${REMOTE_USER}@${REMOTE_HOST}" bash -l <<EOF
  set -e
  NGINX_CONF=/etc/nginx/sites-available/twixt-commentator
  sudo cp ${REMOTE_DIR}/nginx/twixt-commentator.conf "\$NGINX_CONF"
  sudo ln -sf "\$NGINX_CONF" /etc/nginx/sites-enabled/twixt-commentator
  sudo nginx -t
  sudo systemctl reload nginx
EOF

echo "==> Done. Check status with: ssh ${REMOTE_USER}@${REMOTE_HOST} 'pm2 status'"
