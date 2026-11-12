# Production Deployment Guide

## Smart College Bus Transportation System

---

### 1. Deployment Architecture

In production, the application is deployed with separated frontend assets and persistent backend services:
- **Frontend:** Static build assets produced by `npm run build` in `client/dist`, served via Nginx or Cloudflare Pages.
- **Backend:** Node.js Express server with Socket.IO running under PM2 / systemd on a Linux VPS / AWS EC2 instance.
- **Database:** Managed MySQL 8.0+ Instance (AWS RDS, DigitalOcean Managed Database, or self-hosted MySQL).
- **HTTPS / SSL:** Mandatory for Web Push Notification APIs and Geolocation APIs. Provisioned using Let's Encrypt / Certbot.

---

### 2. Environment Variables Checklist

Ensure the following variables are configured in production:

| Variable | Description | Example |
|---|---|---|
| `PORT` | Node server listening port | `5000` |
| `NODE_ENV` | Environment identifier | `production` |
| `FRONTEND_URL` | Deployed frontend origin | `https://bus.anjuman.edu` |
| `DB_HOST` | MySQL hostname or private endpoint | `mysql.anjuman.internal` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL authenticated user | `smartbus_prod` |
| `DB_PASSWORD` | Strong production password | `Str0ng_Pr0d_P@ss!` |
| `DB_NAME` | Database schema name | `smart_bus_tracking` |
| `JWT_SECRET` | 256-bit secure secret key | `x8F...random...90Z` |
| `VAPID_PUBLIC_KEY` | Public VAPID key | `BM_l6FZ9X7AX...` |
| `VAPID_PRIVATE_KEY` | Private VAPID key | `Okh52QW5Ey7G...` |
| `VAPID_SUBJECT` | Admin contact mailto URI | `mailto:admin@anjuman.edu` |

---

### 3. Step-by-Step Production Setup (Ubuntu 22.04 LTS / 24.04 LTS)

#### A. Install Node.js and PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

#### B. Setup MySQL Database
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE smart_bus_tracking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'smartbus_prod'@'localhost' IDENTIFIED BY 'Str0ng_Pr0d_P@ss!';
GRANT ALL PRIVILEGES ON smart_bus_tracking.* TO 'smartbus_prod'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
Import schema:
```bash
mysql -u smartbus_prod -p smart_bus_tracking < database/schema.sql
mysql -u smartbus_prod -p smart_bus_tracking < database/seeds.sql
```

#### C. Build & Run Backend
```bash
cd server
npm ci
npm run build
pm2 start dist/server.js --name "smart-bus-api"
pm2 save
pm2 startup
```

#### D. Build Frontend
```bash
cd client
npm ci
npm run build
# Copy client/dist to /var/www/smart-bus
sudo mkdir -p /var/www/smart-bus
sudo cp -r dist/* /var/www/smart-bus/
```

#### E. Configure Nginx Reverse Proxy & HTTPS
Create `/etc/nginx/sites-available/smart-bus`:
```nginx
server {
    server_name bus.anjuman.edu;
    root /var/www/smart-bus;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable site and provision SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/smart-bus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bus.anjuman.edu
```
