#!/bin/bash

# ABANCOOL Production Deployment Pre-Deployment Checklist
# Comprehensive validation before production deployment
# Run this script to ensure all systems are ready

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

pass() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((CHECKS_PASSED++))
}

fail() {
    echo -e "${RED}[✗]${NC} $1"
    ((CHECKS_FAILED++))
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((CHECKS_WARNING++))
}

# Section header
section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# System Requirements Checks
section "System Requirements"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    if [[ "$NODE_VERSION" > "16.0.0" ]]; then
        pass "Node.js version: $NODE_VERSION"
    else
        fail "Node.js version $NODE_VERSION is too old (require > 16.0.0)"
    fi
else
    fail "Node.js is not installed"
fi

# Check npm version
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    pass "npm version: $NPM_VERSION"
else
    fail "npm is not installed"
fi

# Check MySQL
if command -v mysql &> /dev/null; then
    pass "MySQL client installed"
else
    fail "MySQL client not found"
fi

# Check Redis
if command -v redis-cli &> /dev/null; then
    pass "Redis client installed"
else
    fail "Redis client not found"
fi

# Check Docker
if command -v docker &> /dev/null; then
    pass "Docker installed"
else
    warn "Docker not installed (optional for containerized deployment)"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    pass "Git version: $GIT_VERSION"
else
    fail "Git is not installed"
fi

# Environment Configuration Checks
section "Environment Configuration"

# Check .env file exists
if [ -f .env.production ]; then
    pass ".env.production file exists"
else
    fail ".env.production file not found"
fi

# Check required environment variables
REQUIRED_VARS=(
    "NODE_ENV"
    "PORT"
    "DB_HOST"
    "DB_USER"
    "DB_PASSWORD"
    "DB_NAME"
    "JWT_SECRET"
    "REDIS_HOST"
    "REDIS_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$var=" .env.production; then
        pass "$var is configured"
    else
        fail "$var is not configured in .env.production"
    fi
done

# Database Connection Checks
section "Database Connectivity"

if [ -f .env.production ]; then
    source .env.production
    
    # Test MySQL connection
    if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" &> /dev/null; then
        pass "MySQL connection successful"
    else
        fail "Cannot connect to MySQL database"
    fi
    
    # Check if database exists
    if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME" &> /dev/null; then
        pass "Database $DB_NAME exists"
    else
        warn "Database $DB_NAME does not exist (will be created)"
    fi
fi

# Redis Connection Checks
section "Redis Connectivity"

if [ -f .env.production ]; then
    if redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" ping &> /dev/null; then
        pass "Redis connection successful"
    else
        warn "Cannot connect to Redis (will attempt to continue)"
    fi
fi

# Dependencies Checks
section "Dependencies"

# Check if node_modules exists
if [ -d "node_modules" ]; then
    pass "node_modules directory exists"
else
    warn "node_modules directory not found (will be created during setup)"
fi

# Check package.json
if [ -f "package.json" ]; then
    pass "package.json found"
else
    fail "package.json not found"
fi

# Check for security vulnerabilities
log "Checking for security vulnerabilities..."
if npm audit --audit-level=high &> /dev/null; then
    pass "No high-severity vulnerabilities found"
else
    VULN_COUNT=$(npm audit --json 2>/dev/null | grep -o '"high":[0-9]*' | grep -o '[0-9]*')
    warn "Found $VULN_COUNT high-severity vulnerabilities (review before deployment)"
fi

# SSL/TLS Checks
section "SSL/TLS Configuration"

SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/ssl/certs/abancool.crt}"
SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/ssl/private/abancool.key}"

if [ -f "$SSL_CERT_PATH" ]; then
    pass "SSL certificate found at $SSL_CERT_PATH"
    
    # Check certificate expiry
    EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" 2>/dev/null | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ "$DAYS_UNTIL_EXPIRY" -lt 0 ]; then
        fail "SSL certificate has expired"
    elif [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
        warn "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
    else
        pass "SSL certificate valid for $DAYS_UNTIL_EXPIRY days"
    fi
else
    warn "SSL certificate not found at $SSL_CERT_PATH"
fi

if [ -f "$SSL_KEY_PATH" ]; then
    pass "SSL key found at $SSL_KEY_PATH"
else
    warn "SSL key not found at $SSL_KEY_PATH"
fi

# Application Code Checks
section "Application Code"

# Check main entry point
if [ -f "server/src/index.js" ]; then
    pass "Main entry point found (server/src/index.js)"
else
    fail "Main entry point not found"
fi

# Check for syntax errors
log "Checking for syntax errors..."
if npm run lint &> /dev/null; then
    pass "No linting errors found"
else
    warn "Linting check failed (review code quality)"
fi

# Check tests
if [ -f "server/tests/e2e.test.js" ]; then
    pass "End-to-end tests found"
else
    warn "End-to-end tests not found"
fi

# Docker Configuration Checks
section "Docker Configuration"

if [ -f "Dockerfile" ]; then
    pass "Dockerfile found"
else
    warn "Dockerfile not found (required for containerized deployment)"
fi

if [ -f "docker-compose.yml" ]; then
    pass "docker-compose.yml found"
else
    warn "docker-compose.yml not found"
fi

# Process Manager Checks
section "Process Management"

if command -v pm2 &> /dev/null; then
    pass "PM2 installed"
    
    # Check ecosystem config
    if [ -f "ecosystem.config.js" ]; then
        pass "ecosystem.config.js found"
    else
        fail "ecosystem.config.js not found"
    fi
else
    warn "PM2 not installed (will be installed during setup)"
fi

# Nginx Configuration Checks
section "Nginx Configuration"

if [ -f "nginx/nginx.conf" ]; then
    pass "Nginx configuration found"
    
    # Test nginx config syntax
    if command -v nginx &> /dev/null; then
        if nginx -t &> /dev/null; then
            pass "Nginx configuration is valid"
        else
            fail "Nginx configuration has syntax errors"
        fi
    fi
else
    warn "Nginx configuration not found"
fi

# Backup Checks
section "Backup Configuration"

if [ -d "/var/backups/abancool" ] || [ -d "./backups" ]; then
    pass "Backup directory exists"
else
    warn "Backup directory not found (will be created)"
fi

# Monitoring Checks
section "Monitoring Setup"

if grep -q "SENTRY_DSN" .env.production; then
    pass "Sentry error tracking configured"
else
    warn "Sentry DSN not configured (optional)"
fi

if grep -q "DATADOG" .env.production; then
    pass "DataDog monitoring configured"
else
    warn "DataDog monitoring not configured (optional)"
fi

# Log Directory Checks
section "Log Configuration"

LOG_DIR="${LOG_DIR:-/var/log/abancool}"
if mkdir -p "$LOG_DIR" 2>/dev/null; then
    pass "Log directory accessible: $LOG_DIR"
else
    fail "Cannot access log directory: $LOG_DIR"
fi

# File Permissions Checks
section "File Permissions"

if [ -x "scripts/deploy.sh" ]; then
    pass "Deploy script is executable"
else
    warn "Deploy script not executable"
fi

if [ -x "scripts/rollback.sh" ]; then
    pass "Rollback script is executable"
else
    warn "Rollback script not executable"
fi

# Git Repository Checks
section "Git Repository"

if [ -d ".git" ]; then
    pass "Git repository found"
    
    # Check for uncommitted changes
    if git diff-index --quiet HEAD --; then
        pass "No uncommitted changes"
    else
        warn "Uncommitted changes detected (review before deployment)"
    fi
    
    # Check remote
    if git remote -v | grep -q origin; then
        pass "Remote repository configured"
    else
        fail "No remote repository configured"
    fi
else
    fail "Not a git repository"
fi

# Final Summary
section "Pre-Deployment Checklist Summary"

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo "Total Checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
if [ $CHECKS_WARNING -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
fi
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $CHECKS_FAILED${NC}"
fi

# Determine readiness
if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNING -eq 0 ]; then
        echo -e "\n${GREEN}✓ System is READY for production deployment${NC}"
        exit 0
    else
        echo -e "\n${YELLOW}⚠ System is READY for deployment, but review $CHECKS_WARNING warning(s)${NC}"
        exit 0
    fi
else
    echo -e "\n${RED}✗ System is NOT READY for deployment${NC}"
    echo -e "${RED}Please fix $CHECKS_FAILED failed check(s) before proceeding${NC}"
    exit 1
fi
