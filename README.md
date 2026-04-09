# StuDocu Document Downloader

A tool that generates PDFs from StuDocu document pages. Includes a Node.js backend (Puppeteer-based scraper) and a frontend UI (standalone HTML or WordPress plugin).

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [VPS Deployment](#vps-deployment)
  - [1. Server Setup](#1-server-setup)
  - [2. Install Node.js](#2-install-nodejs)
  - [3. Install Chrome & Dependencies](#3-install-chrome--dependencies)
  - [4. Install Xvfb (Virtual Display)](#4-install-xvfb-virtual-display)
  - [5. Deploy the Application](#5-deploy-the-application)
  - [6. Configure PM2 (Process Manager)](#6-configure-pm2-process-manager)
  - [7. Configure Nginx (Reverse Proxy + SSL)](#7-configure-nginx-reverse-proxy--ssl)
  - [8. Update Frontend URLs](#8-update-frontend-urls)
  - [9. Firewall Configuration](#9-firewall-configuration)
- [WordPress Plugin Setup](#wordpress-plugin-setup)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum VPS Specs

| Resource   | Minimum     | Recommended  |
|------------|-------------|--------------|
| **CPU**    | 2 vCPUs     | 4 vCPUs      |
| **RAM**    | 2 GB        | 4 GB         |
| **Storage**| 20 GB SSD   | 40 GB SSD    |
| **OS**     | Ubuntu 22.04 / 24.04 LTS | Ubuntu 24.04 LTS |
| **Swap**   | 2 GB        | 4 GB         |

> **Note:** Puppeteer with a real Chrome browser is resource-intensive. Each active download session uses ~300-500 MB RAM. A 2 GB VPS can handle 1-2 concurrent downloads.

### Software Requirements

| Software         | Version    | Purpose                                      |
|------------------|------------|----------------------------------------------|
| **Node.js**      | 18+ (LTS) | Runtime for the backend server               |
| **npm**          | 9+         | Package manager                              |
| **Google Chrome**| Latest     | Browser used by Puppeteer for scraping       |
| **Xvfb**         | Any        | Virtual display for headful Chrome on VPS    |
| **PM2**          | Latest     | Process manager to keep the server running   |
| **Nginx**        | Latest     | Reverse proxy with SSL termination           |
| **Certbot**      | Latest     | Free SSL certificates from Let's Encrypt     |

---

## Project Structure

```
studocu-downloader/
├── studocudl/                      # Backend (Node.js API Server)
│   ├── server.js                   # Main server — Puppeteer scraper + Express API
│   ├── package.json                # Dependencies
│   ├── Dockerfile                  # Docker deployment (optional)
│   └── node_modules/               # Auto-generated
│
├── studocu/                        # Frontend + WordPress Plugin
│   ├── index.html                  # Standalone HTML frontend (served by Express)
│   ├── studocu plugin.php          # WordPress plugin (all-in-one: HTML+CSS+JS inline)
│   ├── studocu.php                 # WordPress plugin (separated: loads external JS/CSS)
│   ├── studocu-downloader.js       # External JS for studocu.php plugin
│   ├── studocu-downloader.css      # External CSS for studocu.php plugin
│   └── style.css                   # Additional styles
│
└── README.md                       # This file
```

---

## Local Development

```bash
# 1. Navigate to the backend directory
cd studocudl

# 2. Install dependencies
npm install

# 3. Start the server
node server.js

# 4. Open in browser
# Frontend: http://localhost:7860/studocu/index.html
# API Health: http://localhost:7860/health
```

---

## VPS Deployment

### 1. Server Setup

```bash
# Update the system
sudo apt update && sudo apt upgrade -y

# Create a swap file (important for low-RAM VPS)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Install essential build tools
sudo apt install -y build-essential curl wget git unzip
```

### 2. Install Node.js

```bash
# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v    # Should show v20.x.x
npm -v     # Should show 10.x.x
```

### 3. Install Chrome & Dependencies

```bash
# Install Chrome browser dependencies
sudo apt install -y \
    fonts-liberation \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils

# Install Google Chrome (Stable)
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable

# Verify Chrome installation
google-chrome --version
```

### 4. Install Xvfb (Virtual Display)

The tool requires a **headful** Chrome browser to bypass Cloudflare Turnstile. Since a VPS has no physical display, Xvfb creates a virtual one.

```bash
# Install Xvfb
sudo apt install -y xvfb

# Test that Xvfb works
Xvfb :99 -screen 0 1280x900x24 &
export DISPLAY=:99
google-chrome --no-sandbox --headless=new https://example.com &
# If no errors, it's working. Kill the test processes:
kill %1 %2 2>/dev/null
```

> **Note:** The `puppeteer-real-browser` package handles Xvfb automatically when `disableXvfb: false` is set in server.js. You just need Xvfb installed.

### 5. Deploy the Application

```bash
# Create application directory
sudo mkdir -p /var/www/studocu-downloader
sudo chown $USER:$USER /var/www/studocu-downloader

# Copy project files to VPS (run this from your LOCAL machine)
# Option A: Using SCP
scp -r ./studocudl ./studocu root@YOUR_VPS_IP:/var/www/studocu-downloader/

# Option B: Using Git (if you have a repo)
cd /var/www/studocu-downloader
git clone YOUR_REPO_URL .

# Install Node.js dependencies
cd /var/www/studocu-downloader/studocudl
npm install

# Test that the server starts
node server.js
# You should see: 🚀 Enhanced StuDocu Downloader v5.2.0 running on http://localhost:7860
# Press Ctrl+C to stop
```

### 6. Configure PM2 (Process Manager)

PM2 keeps your server running 24/7, auto-restarts on crash, and starts on boot.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application with PM2
cd /var/www/studocu-downloader/studocudl
pm2 start server.js --name "studocu-api" --max-memory-restart 1G

# Configure PM2 to start on system boot
pm2 startup
# Run the command that PM2 outputs (it will look like:)
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser

# Save the current PM2 process list
pm2 save

# Useful PM2 commands:
pm2 status              # Check status
pm2 logs studocu-api    # View live logs
pm2 restart studocu-api # Restart the server
pm2 stop studocu-api    # Stop the server
pm2 monit               # Real-time monitoring dashboard
```

### 7. Configure Nginx (Reverse Proxy + SSL)

Nginx acts as a front-facing web server that handles SSL and forwards requests to your Node.js app.

```bash
# Install Nginx
sudo apt install -y nginx

# Install Certbot for free SSL
sudo apt install -y certbot python3-certbot-nginx
```

Create the Nginx config file:

```bash
sudo nano /etc/nginx/sites-available/studocu
```

Paste this configuration (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL will be configured by Certbot (see below)

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size (for potential file uploads)
    client_max_body_size 50M;

    # Timeouts - PDF generation can take up to 3 minutes
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    # Proxy all requests to the Node.js backend
    location / {
        proxy_pass http://127.0.0.1:7860;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
        add_header 'Access-Control-Expose-Headers' 'Content-Disposition' always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
```

Enable the site and get SSL:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/studocu /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Get SSL certificate (make sure your domain's DNS points to the VPS IP)
sudo certbot --nginx -d yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 8. Update Frontend URLs

After deploying, update the `API_BASE_URL` in frontend files to your VPS domain.

#### For standalone `index.html`:

If served from the same Express server (recommended), no changes needed — it auto-detects:
```javascript
// This line auto-detects same-origin vs cross-origin:
const API_BASE_URL = window.location.port === '7860' ? '' : 'http://localhost:7860';

// For production behind Nginx, change to:
const API_BASE_URL = '';  // Empty string = same origin
```

#### For WordPress plugin `studocu-downloader.js` (used by `studocu.php`):

```javascript
// Find this line and set your VPS domain:
const API_BASE_URL = 'https://studcodl.mudassirasghar.com';
```

#### For WordPress plugin `studocu plugin.php` (all-in-one version):

The API URL is inside the inline `<script>` block:
```javascript
// Find this line (around line 442) and set your VPS domain:
const API_BASE_URL = 'https://studcodl.mudassirasghar.com';
```

### 9. Firewall Configuration

```bash
# Install UFW if not already installed
sudo apt install -y ufw

# Allow essential ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# DO NOT expose port 7860 publicly (Nginx handles this)
# sudo ufw deny 7860/tcp  # Block direct access to Node.js

# Enable the firewall
sudo ufw enable
sudo ufw status
```

---

## WordPress Plugin Setup

You have **two plugin options** — choose one:

### Option A: All-in-One Plugin (Recommended)

File: `studocu plugin.php`

This is a single PHP file with all HTML, CSS, and JavaScript inline. No external files needed.

1. Rename `studocu plugin.php` → `studocu-plugin.php` (remove the space)
2. Upload `studocu-plugin.php` to `wp-content/plugins/` on your WordPress site
3. Open the file and verify `API_BASE_URL` is set to your VPS domain (line ~442):
   ```javascript
   const API_BASE_URL = 'https://studcodl.mudassirasghar.com';
   ```
4. Activate the plugin in **WordPress Admin → Plugins**
5. Use shortcode `[studocu_display]` on any page or post

### Option B: Separated Files Plugin

Files: `studocu.php` + `studocu-downloader.js` + `studocu-downloader.css`

This version keeps CSS and JS in external files — cleaner for development.

1. Create a folder `studocu-downloader` inside `wp-content/plugins/`
2. Upload these 3 files into that folder:
   - `studocu.php`
   - `studocu-downloader.js`
   - `studocu-downloader.css`
3. Open `studocu-downloader.js` and verify `API_BASE_URL` is set to your VPS domain:
   ```javascript
   const API_BASE_URL = 'https://studcodl.mudassirasghar.com';
   ```
4. Activate the plugin in **WordPress Admin → Plugins**
5. Use shortcode `[studocu_display]` on any page or post

### Important Notes

- The WordPress site and the VPS backend are **separate servers** — the plugin sends API requests from the user's browser to your VPS
- Make sure your VPS Nginx config has CORS headers set (see Section 7) so the WordPress domain can reach the API
- Both plugins use the same shortcode: `[studocu_display]` — only activate **one** at a time

---

## API Reference

### Health Check
```
GET /health
Response: { "status": "ok", "version": "5.2.0" }
```

### Request Download
```
POST /api/request-download
Body: { "url": "https://www.studocu.com/...", "email": "", "password": "" }
Response: { "sessionId": "1234567890" }
```

### Check Progress
```
GET /api/progress/:sessionId
Response: { "sessionId": "...", "progress": 50, "status": "scrolling", "message": "Loading all document pages..." }
```

### Download PDF
```
GET /api/download/:sessionId
Response: Binary PDF file (application/pdf)
```

---

## Troubleshooting

### Cloudflare Challenge Not Bypassing

**Symptoms:** Server logs show `"Just a moment..."` page title for 60+ seconds, then timeout.

**Solutions:**
1. **Check Chrome is installed:** `google-chrome --version`
2. **Check Xvfb is installed:** `which Xvfb`
3. **Restart the server:** `pm2 restart studocu-api`
4. **Try a different IP/proxy** — Cloudflare may have rate-limited your VPS IP
5. **Check logs:** `pm2 logs studocu-api --lines 100`

### Chrome Crashes / Out of Memory

**Symptoms:** Server crashes, PM2 shows frequent restarts.

**Solutions:**
1. **Increase swap space:**
   ```bash
   sudo swapoff /swapfile
   sudo fallocate -l 4G /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```
2. **Limit concurrent downloads** — Only 1-2 at a time on a 2GB VPS
3. **Check memory usage:** `free -h` and `pm2 monit`

### CORS Errors in Browser

**Symptoms:** Browser console shows `Access-Control-Allow-Origin` errors.

**Solutions:**
1. **Use same-origin approach:** Access the frontend via `https://yourdomain.com/studocu/index.html` (served from the same Express server)
2. **Check Nginx CORS headers** are properly configured
3. **Clear browser cache** and try again

### PDF is Empty or Very Small

**Symptoms:** PDF downloads but is 0.01-0.03 MB with blank pages.

**Solutions:**
1. **Check if document requires login** — Some StuDocu documents require a Premium account
2. **Check server logs** for the content verification output:
   ```
   Content verification: { textLength: ..., images: ..., documentImages: ..., hasContent: ... }
   ```
3. If `images: 0` and `documentImages: 0`, the document content is not loading properly
4. **Try a different document URL** — Some documents may have been removed from StuDocu

### PM2 Process Not Starting on Boot

```bash
# Re-run the startup command
pm2 unstartup
pm2 startup
# Copy and run the command it outputs
pm2 save
```

### Nginx 502 Bad Gateway

**Symptoms:** Website shows "502 Bad Gateway" error.

**Solutions:**
1. **Check Node.js is running:** `pm2 status`
2. **Check the correct port:** Make sure `proxy_pass` in Nginx points to `http://127.0.0.1:7860`
3. **Check Nginx logs:** `sudo tail -f /var/log/nginx/error.log`
4. **Restart everything:**
   ```bash
   pm2 restart studocu-api
   sudo systemctl restart nginx
   ```

---

## Key Dependencies

| Package                        | Purpose                                          |
|-------------------------------|--------------------------------------------------|
| `express`                     | HTTP server framework                            |
| `puppeteer-real-browser`      | Chrome automation with Cloudflare Turnstile bypass |
| `puppeteer`                   | Core browser automation library                  |
| `cors`                        | Cross-origin resource sharing middleware         |

---

## License

Private project. Not for public distribution.
