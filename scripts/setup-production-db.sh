#!/bin/bash

# ABANCOOL Production Database Setup Script
# Initializes production database with all tables, indexes, and seed data

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME:-abancool_production}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/abancool}

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

# Create database backup before modifications
create_backup() {
    log "Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pre_setup_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
        success "Backup created: $BACKUP_FILE"
    else
        warn "Backup creation skipped (database may not exist yet)"
    fi
}

# Create database
create_database() {
    log "Creating database: $DB_NAME"
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" << EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE $DB_NAME;

-- Create tables via migrations
EOF
    
    success "Database created/verified"
}

# Run migrations
run_migrations() {
    log "Running database migrations..."
    
    # Get all migration files
    MIGRATIONS_DIR="server/src/migrations"
    
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        error "Migrations directory not found: $MIGRATIONS_DIR"
    fi
    
    # Execute migrations in order
    for migration in "$MIGRATIONS_DIR"/*.js; do
        if [ -f "$migration" ]; then
            log "Executing: $(basename "$migration")"
            node "$migration" || error "Migration failed: $(basename "$migration")"
        fi
    done
    
    success "All migrations completed"
}

# Create indexes for performance
create_indexes() {
    log "Creating database indexes..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << EOF
-- User table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Client table indexes
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_created_at ON clients(created_at);

-- Project table indexes
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Domain table indexes
CREATE INDEX idx_domains_client_id ON domains(client_id);
CREATE INDEX idx_domains_domain_name ON domains(domain_name);
CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_domains_expiry_date ON domains(expiry_date);

-- Hosting table indexes
CREATE INDEX idx_hosting_client_id ON hosting(client_id);
CREATE INDEX idx_hosting_domain_id ON hosting(domain_id);
CREATE INDEX idx_hosting_status ON hosting(status);
CREATE INDEX idx_hosting_created_at ON hosting(created_at);

-- Invoice table indexes
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);

-- Support ticket indexes
CREATE INDEX idx_tickets_client_id ON support_tickets(client_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_tickets_created_at ON support_tickets(created_at);

-- Audit log indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Session indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

EOF
    
    success "Indexes created"
}

# Create stored procedures
create_procedures() {
    log "Creating stored procedures..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << 'EOF'

-- Procedure to get user with roles
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS sp_get_user_with_roles(IN p_user_id INT)
BEGIN
    SELECT u.*, GROUP_CONCAT(r.role_name) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.id = p_user_id
    GROUP BY u.id;
END$$
DELIMITER ;

-- Procedure to get client invoices summary
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS sp_get_client_invoices_summary(IN p_client_id INT)
BEGIN
    SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as overdue_amount
    FROM invoices
    WHERE client_id = p_client_id;
END$$
DELIMITER ;

EOF
    
    success "Stored procedures created"
}

# Set up database user permissions
setup_permissions() {
    log "Setting up database permissions..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" << EOF
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
FLUSH PRIVILEGES;
EOF
    
    success "Permissions configured"
}

# Seed initial data
seed_data() {
    log "Seeding initial data..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << 'EOF'

-- Insert default roles
INSERT IGNORE INTO roles (id, role_name, description) VALUES
(1, 'super_admin', 'Super Administrator'),
(2, 'admin', 'Administrator'),
(3, 'support_agent', 'Support Agent'),
(4, 'user', 'Regular User');

-- Insert default permissions
INSERT IGNORE INTO permissions (id, permission_name, description) VALUES
(1, 'manage_users', 'Can manage users'),
(2, 'manage_clients', 'Can manage clients'),
(3, 'manage_projects', 'Can manage projects'),
(4, 'manage_invoices', 'Can manage invoices'),
(5, 'manage_backups', 'Can manage backups'),
(6, 'view_reports', 'Can view reports');

-- Insert role-permission mappings
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6),
(2, 2), (2, 3), (2, 4), (2, 6),
(3, 6),
(4, 6);

-- Insert status definitions
INSERT IGNORE INTO status_definitions (entity_type, status_value, display_name) VALUES
('user', 'active', 'Active'),
('user', 'inactive', 'Inactive'),
('user', 'suspended', 'Suspended'),
('client', 'active', 'Active'),
('client', 'inactive', 'Inactive'),
('project', 'pending', 'Pending'),
('project', 'in_progress', 'In Progress'),
('project', 'completed', 'Completed'),
('project', 'cancelled', 'Cancelled'),
('invoice', 'draft', 'Draft'),
('invoice', 'sent', 'Sent'),
('invoice', 'paid', 'Paid'),
('invoice', 'pending', 'Pending'),
('invoice', 'overdue', 'Overdue');

EOF
    
    success "Initial data seeded"
}

# Verify database setup
verify_setup() {
    log "Verifying database setup..."
    
    TABLES_COUNT=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB_NAME';" | tail -1)
    
    if [ "$TABLES_COUNT" -gt 0 ]; then
        success "Database verified with $TABLES_COUNT tables"
    else
        error "Database verification failed"
    fi
}

# Optimize database
optimize_database() {
    log "Optimizing database..."
    
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << EOF
OPTIMIZE TABLE users;
OPTIMIZE TABLE clients;
OPTIMIZE TABLE projects;
OPTIMIZE TABLE domains;
OPTIMIZE TABLE hosting;
OPTIMIZE TABLE invoices;
OPTIMIZE TABLE support_tickets;
OPTIMIZE TABLE audit_logs;
EOF
    
    success "Database optimized"
}

# Main execution
main() {
    log "Starting production database setup..."
    
    # Source environment file
    if [ -f .env.production ]; then
        source .env.production
    fi
    
    create_backup
    create_database
    run_migrations
    create_indexes
    create_procedures
    setup_permissions
    seed_data
    verify_setup
    optimize_database
    
    log "Production database setup completed successfully"
    success "ABANCOOL database is ready for production"
}

# Error handling
trap 'error "Script interrupted"' INT TERM

# Run main
main "$@"
