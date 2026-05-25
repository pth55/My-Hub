#!/bin/bash
# EC2 boot automation script for Private Docker Hub
# Triggered by cron @reboot. Logs go to ~/startup.log
#
# What it does on every EC2 start:
#   1. Waits for network to be fully up
#   2. Fetches the new public IP assigned by AWS
#   3. Writes a clean base nginx.conf for the new <IP>.nip.io domain
#   4. Requests a fresh Let's Encrypt SSL certificate via certbot
#   5. Rebuilds the React frontend so the UI shows the correct domain
#   6. Copies the build to the Nginx serving directory
#   7. Kills any zombie Node processes and restarts the API in background

set -e

echo "=== My-Hub startup: $(date) ==="

# 1. Wait for network — AWS needs a moment to fully assign the public IP
echo "[1/7] Waiting 30s for network..."
sleep 30

# 2. Fetch the new public IP dynamically
echo "[2/7] Fetching public IP..."
CURRENT_IP=$(curl -s --max-time 10 ifconfig.me)
MAGIC_DOMAIN="${CURRENT_IP}.nip.io"
echo "      IP: ${CURRENT_IP}  Domain: ${MAGIC_DOMAIN}"

# 3. Write a clean base nginx.conf for the new domain
#    certbot will add SSL directives on top of this in the next step
echo "[3/7] Writing base nginx config for ${MAGIC_DOMAIN}..."
cat > /etc/nginx/nginx.conf << NGINXEOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

include /usr/share/nginx/modules/*.conf;

events {
    worker_connections 1024;
}

http {
    log_format  main  '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                      '\$status \$body_bytes_sent "\$http_referer" '
                      '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;
    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;
    include             /etc/nginx/conf.d/*.conf;

    client_max_body_size 0;

    server {
        listen       80 default_server;
        listen       [::]:80 default_server;
        server_name  ${MAGIC_DOMAIN};

        location / {
            root   /usr/share/nginx/html;
            index  index.html;
            try_files \$uri /index.html;
        }

        location /api/ {
            proxy_pass http://localhost:3000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }

        location /v2/ {
            proxy_pass http://localhost:5000;
            proxy_set_header Host \$http_host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            chunked_transfer_encoding on;
        }
    }
}
NGINXEOF

nginx -t && systemctl restart nginx
echo "      Nginx restarted with base config."

# 4. Request a fresh SSL certificate for the new nip.io domain
#    --redirect makes certbot automatically add the HTTP→HTTPS redirect block
echo "[4/7] Requesting Let's Encrypt certificate for ${MAGIC_DOMAIN}..."
certbot --nginx \
  -d "${MAGIC_DOMAIN}" \
  --non-interactive \
  --agree-tos \
  -m yowahow213@duoley.com \
  --redirect
echo "      SSL certificate installed."

# 5. Rebuild the React frontend
#    This bakes window.location.hostname into the static JS bundle correctly
echo "[5/7] Rebuilding React frontend..."
cd /home/ec2-user/private-hub-frontend
# Fix ownership in case a previous sudo build left root-owned dist/
chown -R ec2-user:ec2-user /home/ec2-user/private-hub-frontend
/usr/bin/npm run build
echo "      Frontend built."

# 6. Copy fresh static files to Nginx
echo "[6/7] Deploying frontend to Nginx..."
rm -rf /usr/share/nginx/html/*
cp -r dist/* /usr/share/nginx/html/
echo "      Frontend deployed."

# 7. Restart Node.js API (kill zombies first, then nohup in background)
echo "[7/7] Restarting Node API..."
pkill node || true
sleep 2
nohup /usr/bin/node /home/ec2-user/private-hub-api/server.js \
  > /home/ec2-user/private-hub-api/server.log 2>&1 &
echo "      Node API started (PID $!)."

echo "=== Startup complete. Hub is live at https://${MAGIC_DOMAIN} ==="
