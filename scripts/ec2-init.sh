#!/bin/bash
# One-time EC2 bootstrap script for Private Docker Hub
# Run this ONCE on a fresh Amazon Linux 2 / Amazon Linux 2023 EC2 instance.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/pth55/My-Hub/main/scripts/ec2-init.sh | bash
# OR after SSH-ing in:
#   bash ec2-init.sh

set -e

REPO_URL="https://github.com/pth55/My-Hub.git"
REPO_DIR="/home/ec2-user/my-hub"
API_DIR="/home/ec2-user/private-hub-api"
FRONTEND_DIR="/home/ec2-user/private-hub-frontend"
REGISTRY_DATA="/home/ec2-user/registry-data"
STARTUP_SCRIPT="/home/ec2-user/startup.sh"
CERTBOT_EMAIL="yowahow213@duoley.com"

log() { echo -e "\n\033[1;36m[INIT]\033[0m $1"; }
ok()  { echo -e "\033[1;32m  ✔  $1\033[0m"; }

# ─────────────────────────────────────────────
log "Step 1/10 — Updating system packages"
sudo yum update -y
ok "Packages updated"

# ─────────────────────────────────────────────
log "Step 2/10 — Installing git, nginx, docker, python3, jq"
sudo yum install -y git nginx docker python3 augeas-libs jq
ok "System packages installed"

# ─────────────────────────────────────────────
log "Step 3/10 — Installing Node.js LTS"
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
ok "Node $(node -v) installed"

# ─────────────────────────────────────────────
log "Step 4/10 — Configuring Docker"
sudo usermod -aG docker ec2-user
sudo systemctl enable --now docker
ok "Docker enabled and started"

# ─────────────────────────────────────────────
log "Step 5/10 — Enabling Nginx"
sudo systemctl enable --now nginx
ok "Nginx enabled and started"

# ─────────────────────────────────────────────
log "Step 6/10 — Installing Certbot (Let's Encrypt)"
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip --quiet
sudo /opt/certbot/bin/pip install certbot certbot-nginx --quiet
sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
ok "Certbot installed"

# ─────────────────────────────────────────────
log "Step 7/10 — Cloning repo and installing dependencies"

# Clone or update the repo
if [ -d "$REPO_DIR/.git" ]; then
  echo "  Repo already exists — pulling latest..."
  git -C "$REPO_DIR" pull
else
  git clone "$REPO_URL" "$REPO_DIR"
fi

# Copy backend and frontend out of the repo into their working dirs
# (startup.sh expects them at these exact paths)
rm -rf "$API_DIR" "$FRONTEND_DIR"
cp -r "$REPO_DIR/backend"  "$API_DIR"
cp -r "$REPO_DIR/frontend" "$FRONTEND_DIR"

# Install npm dependencies
cd "$API_DIR"      && npm install --omit=dev
cd "$FRONTEND_DIR" && npm install

ok "Repo cloned and dependencies installed"

# ─────────────────────────────────────────────
log "Step 8/10 — Setting up Docker registry with persistent storage"
mkdir -p "$REGISTRY_DATA"

# Stop and remove any existing container before re-creating
sudo docker stop private_hub 2>/dev/null || true
sudo docker rm   private_hub 2>/dev/null || true

sudo docker run -d \
  -p 5000:5000 \
  --restart unless-stopped \
  --name private_hub \
  -v "$REGISTRY_DATA:/var/lib/registry" \
  registry:2

ok "Registry container 'private_hub' running with persistent storage at $REGISTRY_DATA"

# ─────────────────────────────────────────────
log "Step 9/10 — Installing startup script and @reboot cron job"

cp "$REPO_DIR/scripts/startup.sh" "$STARTUP_SCRIPT"
chmod +x "$STARTUP_SCRIPT"

# Idempotent: only add the cron entry if it isn't already there
if ! crontab -l 2>/dev/null | grep -q "$STARTUP_SCRIPT"; then
  (crontab -l 2>/dev/null; echo "@reboot $STARTUP_SCRIPT >> /home/ec2-user/startup.log 2>&1") | crontab -
  ok "@reboot cron job registered"
else
  ok "@reboot cron job already present — skipped"
fi

# ─────────────────────────────────────────────
log "Step 10/10 — Running startup.sh for the first time"
echo "  This will fetch the public IP, get an SSL cert, build the"
echo "  frontend, deploy to Nginx, and start the Node API."
echo "  (Takes ~2 minutes — don't Ctrl+C)"
echo ""

bash "$STARTUP_SCRIPT" | tee /home/ec2-user/startup.log

# ─────────────────────────────────────────────
CURRENT_IP=$(curl -s --max-time 10 ifconfig.me)
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           My-Hub is live!                            ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Dashboard : https://${CURRENT_IP}.nip.io"
echo "║  Push      : docker push ${CURRENT_IP}.nip.io/<img>:<tag>"
echo "║  Pull      : docker pull ${CURRENT_IP}.nip.io/<img>:<tag>"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Startup log  : /home/ec2-user/startup.log           ║"
echo "║  Node API log : $API_DIR/server.log  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "On every future EC2 restart the @reboot cron will re-run"
echo "startup.sh automatically — no manual steps needed."
