#!/bin/bash

# ABANCOOL API Deployment Script
# Production deployment automation with rollback capability

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
DEPLOY_DIR="/var/www/abancool${ENVIRONMENT == 'staging' ? '-staging' : ''}"
LOG_DIR="/var/log/abancool"
BACKUP_DIR="/var/backups/abancool"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1
}

backup_current() {
    log "Creating backup of current deployment..."
    
    if [ -d "$DEPLOY_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        
        # Backup database
        mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME \
            > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql" || error "Database backup failed"
        
        # Compress and backup application
        tar -czf "$BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz" \
            -C "$(dirname $DEPLOY_DIR)" "$(basename $DEPLOY_DIR)" \
            --exclude='node_modules' \
            --exclude='logs' \
            --exclude='.git' \
            || error "Application backup failed"
        
        success "Backup created: $BACKUP_DIR/*_$TIMESTAMP.*"
    fi
}

pull_code() {
    log "Pulling latest code from repository..."
    
    cd "$DEPLOY_DIR"
    
    BRANCH=$([ "$ENVIRONMENT" == "production" ] && echo "main" || echo "develop")
    git fetch origin || error "Git fetch failed"
    git checkout "$BRANCH" || error "Git checkout failed"
    git merge origin/$BRANCH || error "Git merge failed"
    
    success "Code updated to latest version"
}

install_dependencies() {
    log "Installing dependencies..."
    
    cd "$DEPLOY_DIR"
    npm ci --production || error "NPM install failed"
    
    success "Dependencies installed"
}

run_migrations() {
    log "Running database migrations..."
    
    cd "$DEPLOY_DIR"
    
    if [ "$ENVIRONMENT" == "production" ]; then
        npm run migrate || error "Migration failed"
    else
        npm run migrate:staging || error "Staging migration failed"
    fi
    
    success "Migrations completed"
}

build_assets() {
    log "Building assets..."
    
    cd "$DEPLOY_DIR"
    npm run build --if-present
    
    success "Assets built"
}

restart_service() {
    log "Restarting application service..."
    
    if [ "$ENVIRONMENT" == "production" ]; then
        pm2 reload ecosystem.config.js --env production || error "PM2 reload failed"
    else
        pm2 reload ecosystem.config.js --env staging || error "PM2 reload failed"
    fi
    
    # Wait for service to be ready
    sleep 10
    
    success "Service restarted"
}

health_check() {
    log "Running health checks..."
    
    PROTOCOL="https"
    [ "$ENVIRONMENT" == "staging" ] && PROTOCOL="http"
    
    HOST="api.abancool.com"
    [ "$ENVIRONMENT" == "staging" ] && HOST="staging-api.abancool.com"
    
    for i in {1..10}; do
        if curl -f "$PROTOCOL://$HOST/api/health" > /dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        warning "Health check attempt $i/10 failed, retrying..."
        sleep 5
    done
    
    error "Health check failed after 10 attempts"
}

rollback() {
    log "Rolling back to previous version..."
    
    if [ -z "$TIMESTAMP" ]; then
        error "No backup timestamp provided"
    fi
    
    log "Stopping services..."
    pm2 stop abancool-api || true
    
    log "Restoring database..."
    mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME \
        < "$BACKUP_DIR/db_backup_$TIMESTAMP.sql" \
        || error "Database restore failed"
    
    log "Restoring application..."
    rm -rf "$DEPLOY_DIR"
    tar -xzf "$BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz" \
        -C "$(dirname $DEPLOY_DIR)" \
        || error "Application restore failed"
    
    log "Restarting services..."
    pm2 restart abancool-api || error "Service restart failed"
    
    sleep 5
    health_check || error "Health check failed after rollback"
    
    success "Rollback completed successfully"
}

cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    RETENTION_DAYS=30
    find "$BACKUP_DIR" -name "db_backup_*.sql" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "app_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    success "Old backups cleaned up"
}

notify_deployment() {
    STATUS=$1
    MESSAGE=$2
    
    # Send notification (Slack, email, etc.)
    curl -X POST \
        -H 'Content-type: application/json' \
        --data "{
            \"text\": \"$ENVIRONMENT Deployment $STATUS\",
            \"attachments\": [{
                \"text\": \"$MESSAGE\"
            }]
        }" \
        "$SLACK_WEBHOOK_URL" || true
}

# Main execution
main() {
    log "Starting $ENVIRONMENT deployment..."
    
    # Validate environment
    if [ ! -d "$DEPLOY_DIR" ]; then
        error "Deploy directory not found: $DEPLOY_DIR"
    fi
    
    # Source environment file
    if [ -f "$DEPLOY_DIR/.env" ]; then
        source "$DEPLOY_DIR/.env"
    fi
    
    # Create required directories
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    
    # Execute deployment steps
    backup_current
    pull_code
    install_dependencies
    run_migrations
    build_assets
    restart_service
    
    # Verify deployment
    if health_check; then
        success "$ENVIRONMENT deployment completed successfully"
        notify_deployment "SUCCESS" "Deployment to $ENVIRONMENT completed"
        cleanup_old_backups
    else
        error "Deployment health check failed"
    fi
}

# Handle arguments
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        if [ -z "$2" ]; then
            error "Usage: $0 rollback <timestamp>"
        fi
        TIMESTAMP="$2"
        rollback
        ;;
    health-check)
        health_check
        ;;
    backup)
        backup_current
        ;;
    *)
        error "Usage: $0 {deploy|rollback|health-check|backup} [timestamp]"
        ;;
esac
