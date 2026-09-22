#!/bin/bash
# ==============================================================================
# NeoAI Tech - AI Attendance System
# Automated Azure VM Deployment Script
# As specified in the Detailed Azure Deployment Guide (Pages 5-8)
# ==============================================================================

set -e

echo "------------------------------------------------------------------------------"
echo " [*] Step 1: Updating system & installing Docker, Nginx, and Certbot..."
echo "------------------------------------------------------------------------------"
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "------------------------------------------------------------------------------"
echo " [*] Step 2: Preparing application directory & persistent runtime storage..."
echo "------------------------------------------------------------------------------"
sudo mkdir -p /opt/neoai-attendance
sudo chown -R "$USER":"$USER" /opt/neoai-attendance
cd /opt/neoai-attendance

if [ ! -d ".git" ]; then
    echo " [*] Cloning repository from GitHub..."
    git clone https://github.com/neoaitech/Neoai_attendance_system.git .
else
    echo " [*] Repository already present. Pulling latest main branch..."
    git pull origin main
fi

# Create persistent storage directories outside git
mkdir -p runtime/database
mkdir -p runtime/data/uploads/students
mkdir -p runtime/data/uploads/sessions
mkdir -p runtime/data/uploads/unknown_faces
mkdir -p runtime/data/reports_cache
mkdir -p runtime/database/backups

echo "------------------------------------------------------------------------------"
echo " [*] Step 3: Generating secure production SECRET_KEY in .env..."
echo "------------------------------------------------------------------------------"
if [ ! -f ".env" ]; then
    RANDOM_KEY=$(openssl rand -hex 32)
    echo "SECRET_KEY=${RANDOM_KEY}" > .env
    echo " [OK] .env generated with unique 256-bit entropy."
else
    echo " [OK] Existing .env file found. Preserving current SECRET_KEY."
fi

echo "------------------------------------------------------------------------------"
echo " [*] Step 4: Configuring Nginx Reverse Proxy for attendance.neoaitech.com..."
echo "------------------------------------------------------------------------------"
sudo cp deploy/nginx/attendance.neoaitech.com.conf /etc/nginx/sites-available/attendance.neoaitech.com
sudo ln -sf /etc/nginx/sites-available/attendance.neoaitech.com /etc/nginx/sites-enabled/attendance.neoaitech.com
# Remove default nginx welcome page if active
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    sudo rm -f /etc/nginx/sites-enabled/default
fi

sudo nginx -t
sudo systemctl reload nginx
echo " [OK] Nginx configured and reloaded."

echo "------------------------------------------------------------------------------"
echo " [*] Step 5: Building & Starting VisionAttend Docker Container..."
echo "------------------------------------------------------------------------------"
sudo docker compose up -d --build

echo "------------------------------------------------------------------------------"
echo " [*] Step 6: Verifying container health..."
echo "------------------------------------------------------------------------------"
sudo docker compose ps

echo "=============================================================================="
echo " [SUCCESS] VisionAttend Azure VM Deployment is Complete!"
echo "=============================================================================="
echo " Next Steps to make it live:"
echo " 1. Open Wix Dashboard -> Domains -> neoaitech.com -> DNS Records"
echo "    Add an 'A' Record:"
echo "      - Host/Name: attendance"
echo "      - Points to: $(curl -s ifconfig.me)"
echo " 2. Once DNS resolves (check with 'nslookup attendance.neoaitech.com'), run:"
echo "    sudo certbot --nginx -d attendance.neoaitech.com"
echo " 3. Your app will be live at: https://attendance.neoaitech.com"
echo "=============================================================================="
