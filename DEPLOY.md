# ABANCOOL Command Center — Deployment Guide for Kiro

A complete, copy-paste runbook for building and shipping the deploy package.
This repo has two independently deployed pieces:

```
abancool-command-center/
├── src/                # React frontend (Vite + TanStack Start)  →  static host or Lovable
└── server/             # Node.js + Express + MySQL backend       →  cPanel Node.js App / VPS
```

The frontend talks to the backend over HTTPS using the `VITE_API_URL` env var.

---

## 0. Prerequisites

| Tool            | Version  | Notes                            |
|-----------------|----------|----------------------------------|
| Node.js         | 18.x+    | 20 LTS recommended               |
| npm             | 9+       | ships with Node                  |
| MySQL / MariaDB | 8 / 10.5+| cPanel ships MariaDB             |
| Git             | any      | for VPS pulls                    |
| cPanel access   | —        | with **Setup Node.js App** enabled |

---

## 1. Build the deploy package

Run from the repo root:

```bash
# Frontend
npm install
npm run build               # outputs to .output/ (or dist/, per Vite)

# Backend
cd server
npm install --omit=dev      # production dependencies only
cd ..
```

Then assemble a shippable zip:

```bash
mkdir -p dist-package/frontend dist-package/backend
cp -r .output/*       dist-package/frontend/      # if .output exists
cp -r dist/*          dist-package/frontend/      # if dist exists
cp -r server/src server/package.json server/package-lock.json server/.env.example server/README.md \
      dist-package/backend/
cd dist-package
zip -r ../abancool-deploy-$(date +%Y%m%d).zip .
cd ..
```

The resulting `abancool-deploy-YYYYMMDD.zip` is what you upload to cPanel.

---

## 2. Backend — Deploy to cPanel Node.js App

### 2.1 Create the MySQL database

In cPanel → **MySQL Databases**:

1. Create database: `abancool` (full name becomes `cpaneluser_abancool`)
2. Create user: `abancool_api` with a strong password
3. Add user to database with **ALL PRIVILEGES**

Record: hostname (`localhost`), full DB name, full user name, password.

### 2.2 Upload the backend

1. cPanel → **File Manager** → create folder `/home/cpaneluser/abancool-api/`
2. Upload `dist-package/backend/` contents into it (or use Git Version Control).
3. The folder should now contain `src/`, `package.json`, `package-lock.json`, `.env.example`.

### 2.3 Create the Node.js app

cPanel → **Setup Node.js App** → **Create Application**:

| Field                       | Value                            |
|-----------------------------|----------------------------------|
| Node.js version             | 20.x (or 18.x)                   |
| Application mode            | Production                       |
| Application root            | `abancool-api`                   |
| Application URL             | `api.yourdomain.com`             |
| Application startup file    | `src/index.js`                   |
| Passenger log file          | (default)                        |

Click **Create**.

### 2.4 Add environment variables

In the same screen, add each variable from `.env.example`:

```
NODE_ENV=production
APP_NAME=ABANCOOL Command Center
CORS_ORIGINS=https://app.yourdomain.com
DB_HOST=localhost
DB_PORT=3306
DB_USER=cpaneluser_abancool_api
DB_PASSWORD=<from step 2.1>
DB_NAME=cpaneluser_abancool
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DEV_RETURN=false
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=<cpanel email password>
MAIL_FROM=ABANCOOL <noreply@yourdomain.com>
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
```

Generate `JWT_SECRET`:
```bash
openssl rand -hex 32
```

### 2.5 Install dependencies & run migrations

Click **Run NPM Install** in the Node.js App screen.

Then open the **Terminal** for that application (it auto-activates the
virtualenv) and run:

```bash
node src/scripts/migrate.js
node src/scripts/create-admin.js "Admin" admin@yourdomain.com 'StrongPass123!'
```

### 2.6 Start & verify

Click **Restart** in the Node.js App screen.

Test:
```bash
curl https://api.yourdomain.com/api/health
# {"ok":true,"time":"..."}
```

### 2.7 SSL

cPanel → **SSL/TLS Status** → **Run AutoSSL** on `api.yourdomain.com`.

---

## 3. Frontend — Two deployment options

### Option A: Lovable hosting (recommended for the React app)
- Click **Publish** in Lovable.
- Before publish, set `VITE_API_URL=https://api.yourdomain.com/api` in
  Lovable → Project Settings → Environment Variables.

### Option B: cPanel static hosting
1. Build locally with `VITE_API_URL` set:
   ```bash
   VITE_API_URL=https://api.yourdomain.com/api npm run build
   ```
2. Upload the contents of `dist/` (or `.output/public/`) to
   `public_html/app/` on cPanel.
3. Add an `.htaccess` for SPA routing:

   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /app/
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /app/index.html [L]
   </IfModule>
   ```

---

## 4. Smoke test the OTP flow

```bash
# 1. Initiate login (sends OTP to email)
curl -X POST https://api.yourdomain.com/api/auth/login-init \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"StrongPass123!"}'
# → {"otpRequired":true,"email":"...","ttlSeconds":600}

# 2. Verify (use code from email)
curl -X POST https://api.yourdomain.com/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","code":"123456","purpose":"login"}'
# → {"user":{...},"token":"eyJhbGc..."}

# 3. Authenticated request
curl https://api.yourdomain.com/api/auth/me \
  -H "Authorization: Bearer eyJhbGc..."
```

For development you can set `OTP_DEV_RETURN=true` to have the code returned
in the JSON response (never enable in production).

---

## 5. VPS alternative (Ubuntu)

```bash
# As root
apt update && apt install -y mysql-server nginx
mysql_secure_installation
# create db + user as in step 2.1 via `mysql -u root -p`

# As deploy user
git clone <your-repo>
cd abancool-command-center/server
cp .env.example .env && nano .env       # fill values
npm ci --omit=dev
npm run migrate
npm i -g pm2
pm2 start src/index.js --name abancool-api
pm2 save && pm2 startup
```

Front with nginx + Certbot:
```nginx
server {
  server_name api.yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
`certbot --nginx -d api.yourdomain.com`

---

## 6. Updating the backend (zero-downtime-ish)

cPanel:
1. Upload the new `src/` over the old.
2. Click **Run NPM Install** if `package.json` changed.
3. Run migrations: `node src/scripts/migrate.js` (idempotent).
4. Click **Restart**.

VPS:
```bash
git pull
npm ci --omit=dev
npm run migrate
pm2 restart abancool-api
```

---

## 7. Security checklist before going live

- [ ] `JWT_SECRET` is 32+ random bytes, unique to production
- [ ] `OTP_DEV_RETURN=false`
- [ ] `CORS_ORIGINS` lists only your frontend origins (no `*`)
- [ ] SMTP credentials work — send a real test OTP
- [ ] HTTPS enabled on both `api.*` and `app.*` subdomains
- [ ] cPanel MySQL user has only the required database privileges
- [ ] `.env` is NOT inside the public web root
- [ ] Run `npm audit --omit=dev` before each release

---

## 8. Useful commands cheat-sheet

```bash
# Tail backend logs (cPanel)
tail -f ~/logs/abancool-api/*.log

# Tail with PM2
pm2 logs abancool-api --lines 100

# Re-issue admin
node server/src/scripts/create-admin.js "Name" email@x.com NewPass123

# Rebuild frontend with new API URL
VITE_API_URL=https://api.yourdomain.com/api npm run build
```

Built. Ship it.
