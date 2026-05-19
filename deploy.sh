#!/bin/bash
# ABANCOOL Deployment Script for cPanel
# Run this from cPanel Terminal or via SSH if available

set -e

echo "=========================================="
echo "ABANCOOL Production Deployment Script"
echo "=========================================="
echo ""

# Configuration
APP_DIR="${HOME}/public_html/abancool-api"
DOMAIN="abancool.com"
DB_HOST="127.0.0.1"
DB_USER="kzinlgmw_Panda"
DB_NAME="kzinlgmw_internal"
NODE_PORT="4000"

echo "[1/7] Creating application directory..."
mkdir -p "$APP_DIR"
cd "$APP_DIR"
echo "✓ Directory created: $APP_DIR"
echo ""

echo "[2/7] Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js found: $NODE_VERSION"
else
    echo "✗ Node.js not found!"
    echo "  Please enable Node.js in cPanel → Software → Node.js Selector"
    exit 1
fi
echo ""

echo "[3/7] Installing npm dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

echo "[4/7] Creating .env.production file..."
cat > .env.production << 'EOF'
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

# SMS - Bulk SMS (Primary)
BULKSMS_API_URL=https://bulksms.talksasa.com/api/v3
BULKSMS_API_TOKEN=2153|obu7jXdaPDyxCecwxopipnq9ofxX6TPElIQjOjEn211b1ea2
BULKSMS_SENDER_ID=ABAN_COOL
BULKSMS_ENABLED=true

# JWT & Sessions
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRY=24h
SESSION_SECRET=super_secret_session_key_change_in_production

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
EOF

chmod 600 .env.production
echo "✓ .env.production created (600 permissions)"
echo ""

echo "[5/7] Running database migrations..."
if [ -f "server/scripts/run-migrations.js" ]; then
    node server/scripts/run-migrations.js
    echo "✓ Migrations completed"
else
    echo "⚠ Migration script not found, skipping..."
fi
echo ""

echo "[6/7] Installing PM2 process manager..."
npm install -g pm2
echo "✓ PM2 installed"
echo ""

echo "[7/7] Starting application with PM2..."
pm2 start server/src/index.js --name "abancool-api" --env production
pm2 startup
pm2 save
echo "✓ Application started with PM2"
echo ""

echo "=========================================="
echo "✓ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Application Details:"
echo "  URL: https://$DOMAIN/api/health"
echo "  Port: $NODE_PORT"
echo "  Status: $(pm2 list)"
echo ""
echo "Useful Commands:"
echo "  View logs:    pm2 logs abancool-api"
echo "  Monitor:      pm2 monit"
echo "  Stop:         pm2 stop abancool-api"
echo "  Restart:      pm2 restart abancool-api"
echo "  Remove:       pm2 delete abancool-api"
echo ""
echo "Testing:"
echo "  curl http://localhost:$NODE_PORT/api/health"
echo ""
