#!/bin/bash

# ABANCOOL SSL/TLS Certificate Setup Script
# Handles Let's Encrypt certificate installation and renewal

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="${1:-api.abancool.com}"
ALT_DOMAIN="${2:-app.abancool.com}"
EMAIL="${EMAIL:-admin@abancool.com}"
CERT_DIR="${CERT_DIR:-/etc/ssl/certs}"
KEY_DIR="${KEY_DIR:-/etc/ssl/private}"
CERT_FILE="$CERT_DIR/$DOMAIN.crt"
KEY_FILE="$KEY_DIR/$DOMAIN.key"

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

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if certbot is installed
check_certbot() {
    log "Checking Certbot installation..."
    
    if command -v certbot &> /dev/null; then
        success "Certbot is installed"
    else
        log "Installing Certbot..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        else
            error "Cannot install Certbot (unsupported package manager)"
        fi
    fi
}

# Install Let's Encrypt certificate
install_letsencrypt_cert() {
    log "Installing Let's Encrypt certificate for $DOMAIN..."
    
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "$ALT_DOMAIN" \
        -d "www.$DOMAIN" || error "Let's Encrypt certificate installation failed"
    
    success "Let's Encrypt certificate installed"
    
    # Copy to application directory
    LETSENCRYPT_DIR="/etc/letsencrypt/live/$DOMAIN"
    sudo cp "$LETSENCRYPT_DIR/fullchain.pem" "$CERT_FILE"
    sudo cp "$LETSENCRYPT_DIR/privkey.pem" "$KEY_FILE"
    
    success "Certificates copied to application directory"
}

# Generate self-signed certificate (for testing only)
generate_self_signed_cert() {
    log "Generating self-signed certificate for testing..."
    
    sudo mkdir -p "$CERT_DIR" "$KEY_DIR"
    
    sudo openssl req -x509 \
        -newkey rsa:4096 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -days 365 \
        -nodes \
        -subj "/C=KE/ST=Nairobi/L=Nairobi/O=ABANCOOL/CN=$DOMAIN" || error "Certificate generation failed"
    
    success "Self-signed certificate generated"
}

# Verify certificate
verify_certificate() {
    log "Verifying SSL certificate..."
    
    if [ ! -f "$CERT_FILE" ]; then
        error "Certificate file not found: $CERT_FILE"
    fi
    
    if [ ! -f "$KEY_FILE" ]; then
        error "Key file not found: $KEY_FILE"
    fi
    
    # Check certificate validity
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ "$DAYS_UNTIL_EXPIRY" -lt 0 ]; then
        error "SSL certificate has expired"
    elif [ "$DAYS_UNTIL_EXPIRY" -lt 30 ]; then
        warn "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
    else
        success "SSL certificate valid for $DAYS_UNTIL_EXPIRY days"
    fi
    
    # Verify certificate matches domain
    CERT_CN=$(openssl x509 -noout -subject -in "$CERT_FILE" | grep -o 'CN = [^,]*' | cut -d= -f2 | tr -d ' ')
    if [[ "$CERT_CN" == "$DOMAIN" || "$CERT_CN" == "*.$DOMAIN" ]]; then
        success "Certificate matches domain"
    else
        warn "Certificate CN ($CERT_CN) does not match domain ($DOMAIN)"
    fi
}

# Setup certificate auto-renewal
setup_renewal() {
    log "Setting up certificate auto-renewal..."
    
    # Create renewal cron job
    RENEWAL_SCRIPT="/usr/local/bin/renew-ssl-certs.sh"
    
    sudo tee "$RENEWAL_SCRIPT" > /dev/null << 'EOF'
#!/bin/bash
certbot renew --quiet
systemctl reload nginx
EOF
    
    sudo chmod +x "$RENEWAL_SCRIPT"
    
    # Add to crontab if not already present
    if ! crontab -l 2>/dev/null | grep -q "$RENEWAL_SCRIPT"; then
        (crontab -l 2>/dev/null; echo "0 3 * * * $RENEWAL_SCRIPT") | crontab -
        success "Auto-renewal cron job configured"
    else
        success "Auto-renewal already configured"
    fi
}

# Configure Nginx for SSL
configure_nginx_ssl() {
    log "Configuring Nginx for SSL..."
    
    NGINX_CONF="/etc/nginx/conf.d/ssl.conf"
    
    sudo tee "$NGINX_CONF" > /dev/null << EOF
# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# HSTS header
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# SSL stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4;

# SSL certificate
ssl_certificate $CERT_FILE;
ssl_certificate_key $KEY_FILE;
EOF
    
    success "Nginx SSL configuration created"
    
    # Test Nginx configuration
    if sudo nginx -t 2>&1 | grep -q "successful"; then
        success "Nginx configuration is valid"
    else
        warn "Nginx configuration may have issues"
    fi
}

# Set proper permissions
set_permissions() {
    log "Setting file permissions..."
    
    sudo chmod 644 "$CERT_FILE"
    sudo chmod 600 "$KEY_FILE"
    sudo chown root:root "$CERT_FILE" "$KEY_FILE"
    
    success "File permissions configured"
}

# Restart services
restart_services() {
    log "Restarting services..."
    
    if systemctl is-active --quiet nginx; then
        sudo systemctl restart nginx
        success "Nginx restarted"
    fi
    
    if systemctl is-active --quiet abancool-api; then
        sudo systemctl restart abancool-api
        success "API service restarted"
    fi
}

# Main execution
main() {
    log "Starting SSL/TLS certificate setup for $DOMAIN..."
    
    check_certbot
    
    # Ask user for certificate type
    read -p "Install Let's Encrypt certificate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_letsencrypt_cert
        setup_renewal
    else
        log "Using self-signed certificate (for testing only)..."
        generate_self_signed_cert
    fi
    
    verify_certificate
    configure_nginx_ssl
    set_permissions
    restart_services
    
    log "SSL/TLS certificate setup completed successfully"
    success "ABANCOOL API is ready with SSL/TLS"
}

# Error handling
trap 'error "Script interrupted"' INT TERM

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root or with sudo"
fi

# Run main
main "$@"
