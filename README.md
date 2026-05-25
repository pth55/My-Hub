# 🐳 My Hub — Self-Hosted Private Docker Registry

A fully automated, SSL-secured private Docker registry with a React dashboard. Push and pull images using standard Docker commands — no client-side configuration required.

---

## What It Does

- **Visual dashboard** — browse all pushed images, view tags, and copy pull commands in one click
- **Zero-config push/pull** — valid Let's Encrypt SSL means no `daemon.json` edits on client machines
- **Self-healing on reboot** — every EC2 restart automatically fetches the new IP, re-issues the SSL cert, rebuilds the frontend, and restarts all services
- **Persistent storage** — image layers are stored on the EC2 host disk, not inside the container

---

## Architecture

```
Client (docker push/pull)
        │
        ▼ HTTPS :443
┌───────────────────────────────┐
│           Nginx               │
│  /        → React frontend    │
│  /api/    → Node.js API :3000 │
│  /v2/     → Docker Registry   │
│              :5000            │
└───────────────────────────────┘
        │             │
        ▼             ▼
   Node.js API    registry:2
   (Express)      (Docker container)
                  /var/lib/registry
                  → ~/registry-data (host volume)
```

**Tech stack:** AWS EC2 · Nginx · Docker registry:2 · React + Vite · Node.js/Express · Let's Encrypt (Certbot) · nip.io magic DNS

---

## Quick Start — Fresh EC2 Instance

SSH into a fresh **Amazon Linux 2** or **Amazon Linux 2023** EC2 instance and run:

```bash
curl -fsSL https://raw.githubusercontent.com/pth55/My-Hub/main/scripts/ec2-init.sh | bash
```

That's it. The script takes ~2 minutes and prints the live URL when done.

> **AWS Security Group** — make sure inbound rules allow **port 80** (HTTP) and **port 443** (HTTPS) from `0.0.0.0/0`.

---

## What `ec2-init.sh` Does

| Step | Action |
|------|--------|
| 1 | `yum update` — update all system packages |
| 2 | Install `git`, `nginx`, `docker`, `python3`, `jq` |
| 3 | Install Node.js LTS via NodeSource |
| 4 | Add `ec2-user` to the `docker` group, enable Docker |
| 5 | Enable and start Nginx |
| 6 | Install Certbot into a Python virtual environment |
| 7 | Clone this repo, copy `backend/` and `frontend/` to working dirs, run `npm install` |
| 8 | Launch the Docker registry container with a persistent host volume at `~/registry-data` |
| 9 | Copy `startup.sh` to `~/startup.sh`, register an `@reboot` cron job (idempotent) |
| 10 | Run `startup.sh` immediately — fetches IP, gets SSL cert, builds React, deploys to Nginx, starts Node API |

---

## How Reboots Work (Zero-Touch Automation)

AWS assigns a new public IP every time an EC2 instance restarts. The `@reboot` cron job runs `startup.sh` automatically on every boot:

```
EC2 boots
   └─ startup.sh runs
         ├─ curl ifconfig.me        → get new public IP
         ├─ write fresh nginx.conf  → for <NEW_IP>.nip.io
         ├─ certbot --nginx          → issue new SSL cert, add HTTPS redirect
         ├─ npm run build            → bake new domain into React bundle
         ├─ cp dist/* nginx/html/   → deploy frontend
         └─ nohup node server.js    → start Node API in background
```

After ~2 minutes, open `https://<NEW_IP>.nip.io` in your browser.

---

## Using the Registry

Once the hub is live, use it exactly like Docker Hub — no extra flags needed.

### Tag and push an image

```bash
docker build -t my-app:v1 .
docker tag my-app:v1 <IP>.nip.io/my-app:v1
docker push <IP>.nip.io/my-app:v1
```

### Pull an image

```bash
docker pull <IP>.nip.io/my-app:v1
```

The current domain is always shown in the **Documentation** tab of the dashboard.

---

## Project Structure

```
My-Hub/
├── frontend/               React + Vite app
│   ├── src/
│   │   ├── App.jsx         Home / Image detail / Docs views
│   │   └── App.css         Dark GitHub-style theme
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/                Node.js / Express API
│   ├── server.js           Bridges Docker Registry V2 → React
│   └── package.json
├── nginx/
│   └── nginx.conf          Base config template (startup.sh overwrites on EC2)
└── scripts/
    ├── ec2-init.sh         One-shot bootstrap for a fresh EC2 instance
    ├── startup.sh          @reboot automation (SSL renewal + full restart)
    └── admin_commands.txt  Quick-reference for manual operations
```

---

## Manual Operations

Common commands for debugging — see [`scripts/admin_commands.txt`](scripts/admin_commands.txt) for the full reference.

```bash
# Re-run the entire boot sequence manually (fixes most issues)
bash ~/startup.sh

# Watch the Node API logs
tail -f ~/private-hub-api/server.log

# Watch the startup log from the last reboot
cat ~/startup.log

# Rebuild and redeploy the frontend only
cd ~/private-hub-frontend && npm run build
sudo rm -rf /usr/share/nginx/html/* && sudo cp -r dist/* /usr/share/nginx/html/

# Restart the Docker registry container
docker restart private_hub

# List all pushed repositories
docker exec -it private_hub ls /var/lib/registry/docker/registry/v2/repositories/
```

---

## How Images Are Stored

Images are stored on the EC2 host at `~/registry-data`, mounted into the `private_hub` container. If the container is deleted and recreated, all previously pushed images remain intact.

```bash
# Peek inside the registry storage
docker exec -it private_hub ls /var/lib/registry/docker/registry/v2/repositories/
```

> `docker images` on the EC2 host will **not** show pushed images — they live inside the registry container's volume, not in the local Docker image cache.
