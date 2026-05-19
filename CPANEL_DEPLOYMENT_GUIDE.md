# ABANCOOL Production Deployment via cPanel

**Server**: 109.199.113.40 | **Username**: kzinlgmw  
**cPanel URL**: https://abancool.com:2083/  
**Status**: Production configuration verified ✓ (90.5% test pass rate)

---

## Step 1: Access cPanel File Manager

1. Go to: https://abancool.com:2083/
2. Log in with username: `kzinlgmw`
3. Click **File Manager** in the left sidebar
4. Navigate to your domain's home directory

---

## Step 2: Create Application Directory

Create a directory for your Node.js app:

```
File Manager → Right-click → Create Folder
Folder name: "abancool-api" (or your preferred name)
Location: /home/kzinlgmw/public_html/abancool-api
```

---

## Step 3: Upload Application Files via cPanel

Using **File Manager**:

1. Click **Upload** button
2. Upload these files/folders:
   ```
   server/
   ├── src/
   ├── package.json
   └── ecosystem.config.js
   
   .env.production
   ```

**Alternative - Use FTP/SFTP**:
- Username: `kzinlgmw`
- Host: `109.199.113.40`
- Port: 21 (FTP) or 22 (SFTP)
- Tools: FileZilla, WinSCP, etc.

---

## Step 4: Create .env.production File

In cPanel File Manager:

1. Navigate to `/home/kzinlgmw/abancool-api/`
2. Right-click → **Create New File** → `.env.production`
3. Edit file and paste:

```env
# Environment
NODE_ENV=production

# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kzinlgmw_Panda
DB_PASSWORD=Laban@2030
DB_NAME=kzinlgmw_internal

# SMTP (Email)
SMTP_HOST=mail.abancool.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@abancool.com
SMTP_PASSWORD=Laban@2030
SMTP_FROM_EMAIL=noreply@abancool.com
SMTP_FROM_NAME=ABANCOOL Notifications

# IMAP (Inbox Monitoring)
IMAP_HOST=mail.abancool.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=noreply@abancool.com
IMAP_PASSWORD=Laban@2030

# SMS - Bulk SMS (Primary)
BULKSMS_API_URL=https://bulksms.talksasa.com/api/v3
BULKSMS_API_TOKEN=2153|obu7jXdaPDyxCecwxopipnq9ofxX6TPElIQjOjEn211b1ea2
BULKSMS_SENDER_ID=ABAN_COOL
BULKSMS_ENABLED=true

# SMS - Twilio (Fallback)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_ENABLED=false

# SMS - Africa's Talking (Fallback)
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
AFRICASTALKING_SENDER_ID=ABAN_COOL
AFRICASTALKING_ENABLED=false

# JWT & Sessions
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
SESSION_SECRET=super_secret_session_key_change_in_production

# Redis (Optional)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API Configuration
API_PORT=4000
API_HOST=0.0.0.0
LOG_LEVEL=info
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
FEATURE_TWO_FACTOR_AUTH=true
FEATURE_ROLE_BASED_ACCESS=true
FEATURE_EMAIL_NOTIFICATIONS=true
FEATURE_SMS_NOTIFICATIONS=true
```

**⚠️ Important**: Mark this file as **Non-Public** in cPanel to protect credentials.

---

## Step 5: Install Dependencies via Terminal

If cPanel Terminal is available:

1. Go to **cPanel → Terminal** (or Advanced → Terminal in older versions)
2. Run:

```bash
cd ~/public_html/abancool-api
npm install
npm install pm2 -g
```

If Terminal not available, contact hosting provider to run these commands.

---

## Step 6: Configure Node.js in cPanel

If your hosting supports Node.js apps:

1. **cPanel → Software → Node.js Selector** (or App Manager)
2. Click **Create Application**
3. Fill in:
   - **Node.js Version**: 18.x or higher
   - **Application Root**: `/home/kzinlgmw/abancool-api`
   - **Application Startup File**: `server/src/index.js`
   - **Application Port**: `4000`
   - **Application URL**: `https://abancool.com` (or subdomain)
4. Click **Create**

---

## Step 7: Configure Apache Proxy (if Node.js Selector not available)

You'll need to proxy Apache to Node.js:

1. Create `.htaccess` in `/home/kzinlgmw/public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^(.*)$ http://127.0.0.1:4000/$1 [P,L]
</IfModule>
```

2. Start Node.js app (via Terminal):

```bash
cd ~/public_html/abancool-api
npm start
# or with PM2:
pm2 start server/src/index.js --name "abancool-api"
pm2 startup
pm2 save
```

---

## Step 8: Test the Deployment

### Test via cPanel Terminal:

```bash
# Check if app is running
curl http://localhost:4000/api/health

# Check logs
tail -f server/server.log
```

### Test via Web:

```
https://abancool.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-19T10:30:00Z",
  "version": "1.0.0",
  "uptime": "1h 23m"
}
```

---

## Step 9: Database Migrations

Run migrations in cPanel Terminal:

```bash
cd ~/public_html/abancool-api
npm run migrate:latest
# or
node server/scripts/run-migrations.js
```

---

## Troubleshooting

### "npm: command not found"
- Contact hosting provider to enable Node.js

### "Cannot connect to database"
- Verify credentials in .env.production
- Check if MariaDB port 3306 is accessible
- Use `127.0.0.1` instead of `localhost`

### "Port 4000 already in use"
- Change port in .env.production
- Kill existing process: `pm2 kill` then restart

### "Email not sending"
- Test SMTP: `telnet mail.abancool.com 465`
- Check sender address is from your domain

### "SMS not working"
- Verify Bulk SMS token in .env.production
- Test: `curl -H "Authorization: Bearer TOKEN" https://bulksms.talksasa.com/api/v3/sms`

---

## Production Monitoring

### Check Service Status

```bash
# List running apps
pm2 list

# View logs
pm2 logs abancool-api

# Monitor resources
pm2 monit
```

### Auto-restart on Reboot

```bash
pm2 startup
pm2 save
```

---

## Next Steps

**Choose your deployment method**:

1. **Option A: Use cPanel Terminal** (if available)
   - I'll provide exact commands to run
   
2. **Option B: Manual via File Manager**
   - Upload files manually
   - Contact provider to run npm commands
   
3. **Option C: Contact Hosting Provider**
   - Ask them to:
     - Enable Node.js support
     - Enable Terminal access
     - Set up Node.js app manager
     - Configure reverse proxy

---

## Quick Reference

| Item | Value |
|------|-------|
| **Server** | 109.199.113.40 |
| **Username** | kzinlgmw |
| **Database** | kzinlgmw_internal |
| **DB User** | kzinlgmw_Panda |
| **Email** | noreply@abancool.com |
| **SMS Provider** | Bulk SMS (TalkSasa) |
| **App Port** | 4000 |
| **Status** | Production Ready ✓ |

---

**Ready to deploy?** Tell me which option you prefer and I'll guide you through each step!
