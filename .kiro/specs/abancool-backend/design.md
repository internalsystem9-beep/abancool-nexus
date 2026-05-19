# ABANCOOL Command Center Backend - Design Document

## Overview

The ABANCOOL Command Center Backend is a production-grade Node.js + Express.js REST API designed to manage enterprise SaaS operations including hosting, domains, VPS, billing, and client management. The system is deployable to cPanel, VPS, and PM2 environments with MySQL/PostgreSQL compatibility.

### Key Design Principles

- **Monolithic Architecture**: Single Express.js application with modular service layer for simplicity and operational efficiency
- **Stateless API**: JWT-based authentication enabling horizontal scaling
- **Security-First**: Helmet middleware, rate limiting, input validation, and encrypted credential storage
- **Real-time Capabilities**: Socket.IO for live notifications and activity feeds
- **Audit Trail**: Comprehensive logging of all user actions and system events
- **Scalability**: Connection pooling, caching strategies, and optimized database queries

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│              (Web Dashboard, Mobile Apps, CLI)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    HTTPS/WSS
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    Express.js API Server                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Middleware Layer                                         │   │
│  │ - Helmet (Security Headers)                             │   │
│  │ - CORS & Rate Limiting                                  │   │
│  │ - Request Logging (Morgan)                              │   │
│  │ - Compression                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Route Layer                                              │   │
│  │ - /api/auth (Authentication)                            │   │
│  │ - /api/users (User Management)                          │   │
│  │ - /api/clients (Client Management)                      │   │
│  │ - /api/projects (Project Management)                    │   │
│  │ - /api/hosting (Hosting Management)                     │   │
│  │ - /api/domains (Domain Management)                      │   │
│  │ - /api/vps (VPS Management)                             │   │
│  │ - /api/vault (Password Vault)                           │   │
│  │ - /api/files (File Management)                          │   │
│  │ - /api/billing (Invoices & Quotes)                      │   │
│  │ - /api/payments (Payment Processing)                    │   │
│  │ - /api/communications (SMS/WhatsApp)                    │   │
│  │ - /api/tickets (Support Tickets)                        │   │
│  │ - /api/automations (Automation Engine)                  │   │
│  │ - /api/audit (Audit Logs)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Controller Layer                                         │   │
│  │ - Request validation & response formatting              │   │
│  │ - Business logic orchestration                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Service Layer                                            │   │
│  │ - Authentication & Authorization                        │   │
│  │ - Business logic implementation                         │   │
│  │ - External API integration                              │   │
│  │ - Email & SMS sending                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Socket.IO Server                                         │   │
│  │ - Real-time notifications                               │   │
│  │ - Activity feed streaming                               │   │
│  │ - Live updates                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌──────────┐
    │ MySQL  │      │ Redis  │      │ File     │
    │Database│      │ Cache  │      │ Storage  │
    └────────┘      └────────┘      └──────────┘
        │
        ├─ External APIs
        │  ├─ M-Pesa Daraja
        │  ├─ IntaSend
        │  ├─ Paystack
        │  ├─ Africa's Talking
        │  ├─ Twilio
        │  ├─ WhatsApp Cloud API
        │  └─ cPanel API
        │
        └─ Deployment Targets
           ├─ cPanel Hosting
           ├─ VPS (Ubuntu/CentOS)
           └─ PM2 Process Manager
```

### Monolithic vs Microservices Decision

**Decision: Monolithic Architecture**

**Rationale:**
- Simpler operational complexity for cPanel/VPS deployment
- Easier to manage database transactions across modules
- Reduced network latency between services
- Easier debugging and monitoring
- Suitable for current scale (single organization)
- Can evolve to microservices later if needed

**Future Scalability Path:**
- Extract payment processing to separate service
- Extract communications (SMS/WhatsApp) to separate service
- Extract file storage to separate service
- Implement event-driven architecture with message queues



## Components and Interfaces

### API Endpoints Structure

#### Authentication Module (`/api/auth`)

```
POST   /api/auth/register              - Register new user
POST   /api/auth/login                 - Login with email/password
POST   /api/auth/otp/request           - Request OTP via email
POST   /api/auth/otp/verify            - Verify OTP and get JWT
POST   /api/auth/2fa/setup             - Setup TOTP 2FA
POST   /api/auth/2fa/verify            - Verify TOTP code
POST   /api/auth/refresh               - Refresh JWT token
POST   /api/auth/logout                - Logout and invalidate session
POST   /api/auth/password/reset        - Request password reset
POST   /api/auth/password/update       - Update password with reset token
```

#### User Management Module (`/api/users`)

```
GET    /api/users                      - List all users (paginated)
GET    /api/users/:id                  - Get user details
POST   /api/users                      - Create new user (Super Admin only)
PUT    /api/users/:id                  - Update user profile
PUT    /api/users/:id/roles            - Update user roles
DELETE /api/users/:id                  - Soft-delete user
GET    /api/users/:id/audit            - Get user's audit log
```

#### Client Management Module (`/api/clients`)

```
GET    /api/clients                    - List all clients (paginated, filtered)
GET    /api/clients/:id                - Get client details
POST   /api/clients                    - Create new client
PUT    /api/clients/:id                - Update client information
DELETE /api/clients/:id                - Soft-delete client
POST   /api/clients/:id/contacts       - Add contact to client
GET    /api/clients/:id/contacts       - List client contacts
PUT    /api/clients/:id/contacts/:cid  - Update contact
DELETE /api/clients/:id/contacts/:cid  - Delete contact
GET    /api/clients/:id/projects       - List client's projects
GET    /api/clients/:id/billing        - Get client billing summary
```

#### Project Management Module (`/api/projects`)

```
GET    /api/projects                   - List all projects (paginated, filtered)
GET    /api/projects/:id               - Get project details
POST   /api/projects                   - Create new project
PUT    /api/projects/:id               - Update project
PUT    /api/projects/:id/status        - Update project status
PUT    /api/projects/:id/deployment    - Add deployment URL
DELETE /api/projects/:id               - Soft-delete project
POST   /api/projects/:id/team          - Assign team member
DELETE /api/projects/:id/team/:uid     - Remove team member
```

#### Hosting Management Module (`/api/hosting`)

```
GET    /api/hosting                    - List all hosting accounts
GET    /api/hosting/:id                - Get hosting details
POST   /api/hosting                    - Create hosting account
PUT    /api/hosting/:id                - Update hosting account
DELETE /api/hosting/:id                - Soft-delete hosting
GET    /api/hosting/:id/usage          - Get resource usage metrics
POST   /api/hosting/packages           - Create hosting package
GET    /api/hosting/packages           - List hosting packages
```

#### Domain Management Module (`/api/domains`)

```
GET    /api/domains                    - List all domains
GET    /api/domains/:id                - Get domain details
POST   /api/domains                    - Create domain record
PUT    /api/domains/:id                - Update domain
PUT    /api/domains/:id/ssl            - Update SSL certificate info
DELETE /api/domains/:id                - Soft-delete domain
PUT    /api/domains/:id/renewal        - Update auto-renewal status
```

#### VPS Management Module (`/api/vps`)

```
GET    /api/vps                        - List all VPS servers
GET    /api/vps/:id                    - Get VPS details
POST   /api/vps                        - Create VPS record
PUT    /api/vps/:id                    - Update VPS
DELETE /api/vps/:id                    - Soft-delete VPS
POST   /api/vps/:id/metrics            - Record VPS metrics
GET    /api/vps/:id/metrics            - Get VPS metrics history
```

#### Password Vault Module (`/api/vault`)

```
GET    /api/vault                      - List vault credentials (labels only)
GET    /api/vault/:id                  - Get decrypted credential
POST   /api/vault                      - Store encrypted credential
PUT    /api/vault/:id                  - Update credential
DELETE /api/vault/:id                  - Soft-delete credential
```

#### File Management Module (`/api/files`)

```
POST   /api/files/upload               - Upload file with validation
GET    /api/files                      - List files (paginated, filtered)
GET    /api/files/:id/download         - Download file with token
DELETE /api/files/:id                  - Soft-delete file
```

#### Billing Module (`/api/billing`)

```
GET    /api/billing/invoices           - List invoices (paginated, filtered)
GET    /api/billing/invoices/:id       - Get invoice details
POST   /api/billing/invoices           - Create invoice
PUT    /api/billing/invoices/:id       - Update invoice
GET    /api/billing/quotes             - List quotes
POST   /api/billing/quotes             - Create quote
PUT    /api/billing/quotes/:id/convert - Convert quote to invoice
```

#### Payment Processing Module (`/api/payments`)

```
POST   /api/payments/mpesa/initiate    - Initiate M-Pesa payment
POST   /api/payments/mpesa/callback    - M-Pesa webhook callback
POST   /api/payments/intasend/initiate - Initiate IntaSend payment
POST   /api/payments/intasend/callback - IntaSend webhook callback
POST   /api/payments/paystack/initiate - Initiate Paystack payment
POST   /api/payments/paystack/callback - Paystack webhook callback
GET    /api/payments/transactions      - List transactions (paginated, filtered)
GET    /api/payments/transactions/:id  - Get transaction details
```

#### Communications Module (`/api/communications`)

```
POST   /api/communications/sms/send    - Send SMS via Africa's Talking/Twilio
POST   /api/communications/sms/campaign - Create SMS campaign
GET    /api/communications/sms/campaigns - List SMS campaigns
POST   /api/communications/whatsapp/send - Send WhatsApp message
POST   /api/communications/whatsapp/campaign - Create WhatsApp campaign
GET    /api/communications/whatsapp/campaigns - List WhatsApp campaigns
POST   /api/communications/whatsapp/webhook - WhatsApp webhook receiver
```

#### Support Tickets Module (`/api/tickets`)

```
GET    /api/tickets                    - List tickets (paginated, filtered)
GET    /api/tickets/:id                - Get ticket details
POST   /api/tickets                    - Create support ticket
PUT    /api/tickets/:id                - Update ticket
PUT    /api/tickets/:id/status         - Update ticket status
PUT    /api/tickets/:id/assign         - Assign ticket to staff
POST   /api/tickets/:id/comments       - Add comment to ticket
GET    /api/tickets/:id/comments       - Get ticket comments
```

#### Automation Engine Module (`/api/automations`)

```
GET    /api/automations                - List automation rules
GET    /api/automations/:id            - Get automation details
POST   /api/automations                - Create automation rule
PUT    /api/automations/:id            - Update automation
DELETE /api/automations/:id            - Delete automation
GET    /api/automations/:id/history    - Get execution history
```

#### Audit & Activity Module (`/api/audit`)

```
GET    /api/audit/logs                 - List audit logs (paginated, filtered)
GET    /api/audit/logs/:id             - Get audit log details
GET    /api/audit/activity             - Get activity feed
```



## Data Models

### Core Entity Relationships

```
Users (1) ──────────────────────────── (M) UserRoles
  │
  ├─ (M) Sessions
  ├─ (M) AuditLogs
  ├─ (M) Notifications
  └─ (M) UserClients

Clients (1) ──────────────────────────── (M) Contacts
  │
  ├─ (M) Projects
  ├─ (M) Hosting
  ├─ (M) Domains
  ├─ (M) VPS
  ├─ (M) Invoices
  ├─ (M) Quotes
  ├─ (M) SupportTickets
  └─ (M) UserClients

Projects (1) ──────────────────────────── (M) ProjectTeam
  │
  ├─ (M) Files
  └─ (1) Clients

Invoices (1) ──────────────────────────── (M) InvoiceItems
  │
  ├─ (M) Transactions
  └─ (1) Clients

Quotes (1) ──────────────────────────── (M) QuoteItems
  │
  └─ (1) Clients

SupportTickets (1) ──────────────────────────── (M) TicketComments
  │
  ├─ (1) Clients
  └─ (1) Users (assigned_to)

PasswordVault (1) ──────────────────────────── (M) VaultAccessLogs
  │
  └─ (1) Users (owner)

Automations (1) ──────────────────────────── (M) AutomationExecutions
```

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  avatar_url VARCHAR(500),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  totp_secret VARCHAR(255),
  totp_enabled BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  last_login_user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### UserRoles Table
```sql
CREATE TABLE user_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role ENUM('super_admin', 'admin', 'developer', 'support', 'finance', 'sales') NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by BIGINT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE KEY unique_user_role (user_id, role),
  INDEX idx_user_id (user_id),
  INDEX idx_role (role)
);
```

#### Sessions Table
```sql
CREATE TABLE sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_token_hash (token_hash)
);
```

#### Clients Table
```sql
CREATE TABLE clients (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  client_id VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  kra_pin VARCHAR(50),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_client_id (client_id),
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### Contacts Table
```sql
CREATE TABLE contacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  client_id BIGINT NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  INDEX idx_client_id (client_id),
  INDEX idx_email (email),
  INDEX idx_deleted_at (deleted_at)
);
```

#### Projects Table
```sql
CREATE TABLE projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('planning', 'in_progress', 'testing', 'deployed', 'completed') DEFAULT 'planning',
  budget DECIMAL(12, 2),
  spent DECIMAL(12, 2) DEFAULT 0,
  deadline DATE,
  deployment_url VARCHAR(500),
  deployed_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_project_id (project_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_deadline (deadline),
  INDEX idx_deleted_at (deleted_at)
);
```

#### ProjectTeam Table
```sql
CREATE TABLE project_team (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(100),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_project_user (project_id, user_id),
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id)
);
```

#### Hosting Table
```sql
CREATE TABLE hosting (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hosting_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT NOT NULL,
  domain_name VARCHAR(255) NOT NULL,
  cpanel_account VARCHAR(100),
  package_type VARCHAR(100),
  disk_quota_gb INT,
  bandwidth_limit_gb INT,
  disk_used_gb DECIMAL(10, 2) DEFAULT 0,
  bandwidth_used_gb DECIMAL(10, 2) DEFAULT 0,
  renewal_date DATE,
  status ENUM('active', 'suspended', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  INDEX idx_hosting_id (hosting_id),
  INDEX idx_client_id (client_id),
  INDEX idx_domain_name (domain_name),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### Domains Table
```sql
CREATE TABLE domains (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  domain_id VARCHAR(50) UNIQUE NOT NULL,
  domain_name VARCHAR(255) UNIQUE NOT NULL,
  registrar VARCHAR(100),
  registration_date DATE,
  expiration_date DATE,
  auto_renewal BOOLEAN DEFAULT FALSE,
  ssl_issuer VARCHAR(100),
  ssl_expiration_date DATE,
  ssl_renewal_status ENUM('active', 'expiring_soon', 'expired') DEFAULT 'active',
  status ENUM('active', 'expired', 'pending') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_domain_id (domain_id),
  INDEX idx_domain_name (domain_name),
  INDEX idx_expiration_date (expiration_date),
  INDEX idx_ssl_expiration_date (ssl_expiration_date),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### VPS Table
```sql
CREATE TABLE vps (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vps_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT,
  server_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  provider VARCHAR(100),
  cpu_cores INT,
  ram_gb INT,
  storage_gb INT,
  cpu_usage_percent DECIMAL(5, 2) DEFAULT 0,
  ram_usage_percent DECIMAL(5, 2) DEFAULT 0,
  disk_usage_percent DECIMAL(5, 2) DEFAULT 0,
  uptime_percent DECIMAL(5, 2) DEFAULT 100,
  status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  last_metrics_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  INDEX idx_vps_id (vps_id),
  INDEX idx_ip_address (ip_address),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### PasswordVault Table
```sql
CREATE TABLE password_vault (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  vault_id VARCHAR(50) UNIQUE NOT NULL,
  owner_id BIGINT NOT NULL,
  credential_type VARCHAR(100),
  label VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  encrypted_password LONGTEXT NOT NULL,
  encryption_key_id VARCHAR(50),
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  INDEX idx_vault_id (vault_id),
  INDEX idx_owner_id (owner_id),
  INDEX idx_status (status),
  INDEX idx_deleted_at (deleted_at)
);
```

#### Files Table
```sql
CREATE TABLE files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  file_id VARCHAR(50) UNIQUE NOT NULL,
  project_id BIGINT,
  original_filename VARCHAR(500) NOT NULL,
  stored_filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes BIGINT,
  storage_path VARCHAR(500),
  download_token VARCHAR(255) UNIQUE,
  download_token_expires_at TIMESTAMP,
  download_count INT DEFAULT 0,
  uploaded_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_file_id (file_id),
  INDEX idx_project_id (project_id),
  INDEX idx_download_token (download_token),
  INDEX idx_deleted_at (deleted_at)
);
```

#### Invoices Table
```sql
CREATE TABLE invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),
  tax_rate DECIMAL(5, 2),
  status ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  payment_status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_deleted_at (deleted_at)
);
```

#### InvoiceItems Table
```sql
CREATE TABLE invoice_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT NOT NULL,
  description VARCHAR(500),
  quantity INT,
  unit_price DECIMAL(12, 2),
  line_total DECIMAL(12, 2),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  INDEX idx_invoice_id (invoice_id)
);
```

#### Quotes Table
```sql
CREATE TABLE quotes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quote_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT NOT NULL,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  subtotal DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  total_amount DECIMAL(12, 2),
  tax_rate DECIMAL(5, 2),
  status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') DEFAULT 'draft',
  expiration_date DATE,
  converted_to_invoice_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_quote_id (quote_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_expiration_date (expiration_date),
  INDEX idx_deleted_at (deleted_at)
);
```

#### QuoteItems Table
```sql
CREATE TABLE quote_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quote_id BIGINT NOT NULL,
  description VARCHAR(500),
  quantity INT,
  unit_price DECIMAL(12, 2),
  line_total DECIMAL(12, 2),
  FOREIGN KEY (quote_id) REFERENCES quotes(id),
  INDEX idx_quote_id (quote_id)
);
```

#### Transactions Table
```sql
CREATE TABLE transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transaction_id VARCHAR(50) UNIQUE NOT NULL,
  invoice_id BIGINT,
  payment_method ENUM('mpesa', 'intasend', 'paystack', 'bank_transfer', 'cash') NOT NULL,
  amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'KES',
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  reference_number VARCHAR(255),
  gateway_response LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_payment_method (payment_method),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### SupportTickets Table
```sql
CREATE TABLE support_tickets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ticket_id VARCHAR(50) UNIQUE NOT NULL,
  client_id BIGINT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  assigned_to BIGINT,
  created_by BIGINT,
  resolved_at TIMESTAMP NULL,
  resolution_time_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_deleted_at (deleted_at)
);
```

#### TicketComments Table
```sql
CREATE TABLE ticket_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  ticket_id BIGINT NOT NULL,
  author_id BIGINT NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_author_id (author_id)
);
```

#### SMSCampaigns Table
```sql
CREATE TABLE sms_campaigns (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id VARCHAR(50) UNIQUE NOT NULL,
  campaign_name VARCHAR(255),
  message_template TEXT,
  provider ENUM('africas_talking', 'twilio') NOT NULL,
  recipient_count INT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
  scheduled_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_status (status),
  INDEX idx_scheduled_at (scheduled_at)
);
```

#### WhatsAppCampaigns Table
```sql
CREATE TABLE whatsapp_campaigns (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  campaign_id VARCHAR(50) UNIQUE NOT NULL,
  campaign_name VARCHAR(255),
  template_name VARCHAR(255),
  template_params JSON,
  recipient_count INT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
  scheduled_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_status (status),
  INDEX idx_scheduled_at (scheduled_at)
);
```

#### Automations Table
```sql
CREATE TABLE automations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  automation_id VARCHAR(50) UNIQUE NOT NULL,
  automation_name VARCHAR(255),
  trigger_type VARCHAR(100),
  trigger_condition JSON,
  action_type VARCHAR(100),
  action_parameters JSON,
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  last_execution_at TIMESTAMP NULL,
  last_execution_status VARCHAR(50),
  execution_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_automation_id (automation_id),
  INDEX idx_status (status),
  INDEX idx_trigger_type (trigger_type)
);
```

#### AuditLogs Table
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  action_type VARCHAR(100),
  resource_type VARCHAR(100),
  resource_id VARCHAR(50),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failure') DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_action_type (action_type),
  INDEX idx_resource_type (resource_type),
  INDEX idx_created_at (created_at)
);
```

#### Notifications Table
```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  notification_id VARCHAR(50) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  notification_type VARCHAR(100),
  title VARCHAR(255),
  message TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);
```



## Authentication & Authorization

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "email": "user@example.com",
    "roles": ["admin", "developer"],
    "iat": 1704067200,
    "exp": 1704153600,
    "iss": "abancool-api",
    "aud": "abancool-clients"
  }
}
```

### Authentication Flow

#### 1. Email/Password Login
```
1. User submits email + password
2. System validates email exists
3. System compares password with bcrypt hash
4. If valid:
   - Generate JWT token (24-hour expiration)
   - Create session record
   - Log login in audit log
   - Return JWT + user profile
5. If invalid:
   - Increment failed attempt counter
   - Lock account after 5 failed attempts
   - Return 401 Unauthorized
```

#### 2. OTP Verification Flow
```
1. User requests OTP
2. System generates 6-digit code
3. System stores OTP with 5-minute expiration
4. System sends OTP via email
5. User submits OTP
6. System validates OTP:
   - Check code matches
   - Check not expired
   - Check not exceeded max attempts (5)
7. If valid:
   - Issue JWT token
   - Clear OTP record
   - Log successful OTP verification
8. If invalid:
   - Increment attempt counter
   - Return 401 Unauthorized
```

#### 3. TOTP 2FA Setup Flow
```
1. User requests 2FA setup
2. System generates TOTP secret (base32 encoded)
3. System generates QR code (using qrcode library)
4. System returns QR code + secret to user
5. User scans QR code in authenticator app
6. User submits TOTP code
7. System validates TOTP code
8. If valid:
   - Enable TOTP for user
   - Store TOTP secret encrypted
   - Generate backup codes
   - Return backup codes to user
9. If invalid:
   - Return 400 Bad Request
```

#### 4. TOTP 2FA Login Flow
```
1. User logs in with email + password
2. System validates credentials
3. If TOTP enabled:
   - Return 202 Accepted (pending 2FA)
   - Return temporary token (5-minute expiration)
4. User submits TOTP code + temporary token
5. System validates TOTP code
6. If valid:
   - Issue full JWT token
   - Clear temporary token
   - Log successful 2FA verification
7. If invalid:
   - Return 401 Unauthorized
```

### Role-Based Access Control (RBAC)

#### Predefined Roles

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full system access, user management, role assignment, system configuration |
| **Admin** | Client management, project management, user management (except role assignment), billing oversight |
| **Developer** | Project management, hosting management, file uploads, view client info |
| **Support** | Support ticket management, client communication, view client info, limited project access |
| **Finance** | Billing management, invoice/quote creation, payment processing, financial reports |
| **Sales** | Client management, quote creation, project proposals, sales reporting |

#### Permission Matrix

```
Resource          | Super Admin | Admin | Developer | Support | Finance | Sales
------------------|-------------|-------|-----------|---------|---------|-------
Users             | CRUD        | CRU   | R         | R       | R       | R
Roles             | CRUD        | -     | -         | -       | -       | -
Clients           | CRUD        | CRUD  | R         | R       | R       | CRUD
Projects          | CRUD        | CRUD  | CRUD      | R       | R       | CRU
Hosting           | CRUD        | CRUD  | CRUD      | -       | -       | -
Domains           | CRUD        | CRUD  | CRUD      | -       | -       | -
VPS               | CRUD        | CRUD  | CRUD      | -       | -       | -
Vault             | CRUD        | CRUD  | R         | -       | -       | -
Files             | CRUD        | CRUD  | CRUD      | -       | -       | -
Invoices          | CRUD        | R     | -         | -       | CRUD    | R
Quotes            | CRUD        | R     | -         | -       | CRUD    | CRUD
Payments          | CRUD        | R     | -         | -       | CRUD    | -
Tickets           | CRUD        | CRUD  | R         | CRUD    | -       | -
Automations       | CRUD        | CRUD  | -         | -       | -       | -
Audit Logs        | R           | R     | -         | -       | -       | -
```

### Authorization Middleware

```javascript
// Middleware checks:
1. JWT token validity
2. Token expiration
3. User status (active/suspended)
4. User role permissions
5. Resource ownership (client-scoped access)
6. Rate limiting per user
```

### Session Management

- Sessions stored in database with expiration
- Session invalidation on logout
- Concurrent session limit: 5 per user
- Automatic session cleanup (cron job)
- Device fingerprinting for security tracking



## Integration Points

### Payment Gateway Integration

#### M-Pesa Daraja Integration

```javascript
// Initiate STK Push
POST /api/payments/mpesa/initiate
{
  "invoiceId": "INV-2024-001",
  "amount": 5000,
  "phoneNumber": "254712345678",
  "accountReference": "ABANCOOL-INV-001"
}

// Response
{
  "success": true,
  "checkoutRequestID": "ws_CO_DMZ_...",
  "customerMessage": "Enter your M-Pesa PIN to complete this transaction."
}

// Webhook Callback
POST /api/payments/mpesa/callback
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 5000 },
          { "Name": "MpesaReceiptNumber", "Value": "LHG31AL4V61" },
          { "Name": "TransactionDate", "Value": 20240101120000 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Implementation Details:**
- Use M-Pesa Daraja API (OAuth 2.0)
- Store consumer key/secret in environment variables
- Implement webhook signature verification
- Retry failed payments with exponential backoff
- Store transaction reference for reconciliation

#### IntaSend Integration

```javascript
// Initiate Payment
POST /api/payments/intasend/initiate
{
  "invoiceId": "INV-2024-001",
  "amount": 5000,
  "currency": "KES",
  "paymentMethod": "MPESA",
  "phoneNumber": "254712345678"
}

// Response
{
  "success": true,
  "paymentId": "...",
  "redirectUrl": "https://intasend.com/pay/..."
}

// Webhook Callback
POST /api/payments/intasend/callback
{
  "id": "...",
  "status": "COMPLETE",
  "amount": 5000,
  "currency": "KES",
  "reference": "INV-2024-001"
}
```

#### Paystack Integration

```javascript
// Initiate Payment
POST /api/payments/paystack/initiate
{
  "invoiceId": "INV-2024-001",
  "amount": 500000, // in cents
  "email": "client@example.com",
  "metadata": {
    "invoiceId": "INV-2024-001",
    "clientId": "CLIENT-001"
  }
}

// Response
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "...",
    "reference": "..."
  }
}

// Webhook Callback
POST /api/payments/paystack/callback
{
  "event": "charge.success",
  "data": {
    "id": 123456,
    "reference": "...",
    "amount": 500000,
    "status": "success",
    "customer": {
      "email": "client@example.com"
    }
  }
}
```

### SMS Provider Integration

#### Africa's Talking Integration

```javascript
// Send SMS
POST /api/communications/sms/send
{
  "provider": "africas_talking",
  "recipients": ["+254712345678"],
  "message": "Your OTP is: 123456"
}

// Response
{
  "success": true,
  "entries": [
    {
      "statusCode": 101,
      "number": "+254712345678",
      "status": "Success",
      "messageId": "ATXid_..."
    }
  ]
}
```

**Implementation Details:**
- Use Africa's Talking API key authentication
- Implement delivery status tracking
- Store SMS logs with delivery status
- Handle failed deliveries with retry logic

#### Twilio Integration

```javascript
// Send SMS
POST /api/communications/sms/send
{
  "provider": "twilio",
  "recipients": ["+254712345678"],
  "message": "Your OTP is: 123456"
}

// Response
{
  "success": true,
  "sid": "SM...",
  "status": "queued"
}
```

### WhatsApp Cloud API Integration

```javascript
// Send WhatsApp Message
POST /api/communications/whatsapp/send
{
  "recipientPhone": "254712345678",
  "templateName": "invoice_notification",
  "templateParams": {
    "invoiceNumber": "INV-2024-001",
    "amount": "5000 KES"
  }
}

// Response
{
  "success": true,
  "messageId": "wamid...."
}

// Webhook Callback (Message Status)
POST /api/communications/whatsapp/webhook
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "id": "wamid...",
                "status": "delivered",
                "timestamp": "1234567890"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Implementation Details:**
- Verify webhook signature using X-Hub-Signature header
- Store message templates in database
- Track delivery status and read receipts
- Handle incoming messages and create support tickets

### cPanel API Integration

```javascript
// Create Hosting Account
POST /api/hosting
{
  "domain": "example.com",
  "cpanelUsername": "user123",
  "packageType": "starter",
  "diskQuota": 50,
  "bandwidthLimit": 500
}

// Implementation:
// 1. Call cPanel API via UAPI
// 2. Create account with specified parameters
// 3. Store cPanel credentials encrypted in vault
// 4. Monitor account status via cron job
// 5. Sync resource usage metrics
```

### Email Service Integration (Nodemailer)

```javascript
// Send Email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// OTP Email
await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to: user.email,
  subject: "Your OTP Code",
  html: renderOTPTemplate({ code: "123456" })
});

// Invoice Email
await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to: client.email,
  subject: `Invoice ${invoice.invoiceNumber}`,
  html: renderInvoiceTemplate({ invoice }),
  attachments: [
    {
      filename: `${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer
    }
  ]
});
```



## Real-time Features with Socket.IO

### Socket.IO Architecture

```javascript
// Server Setup
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CORS_ORIGINS.split(','),
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
});

// Middleware: JWT Authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    socket.userId = decoded.sub;
    socket.userRoles = decoded.roles;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});
```

### Real-time Events

#### Notification Events

```javascript
// Emit notification to user
io.to(`user:${userId}`).emit('notification', {
  id: notificationId,
  type: 'ticket_assigned',
  title: 'Ticket Assigned',
  message: 'Ticket #123 has been assigned to you',
  data: { ticketId: 123 },
  timestamp: new Date()
});

// Notification Types:
// - ticket_assigned
// - ticket_updated
// - payment_received
// - invoice_created
// - project_status_changed
// - alert_triggered
// - domain_expiring_soon
// - ssl_expiring_soon
// - vps_alert
```

#### Activity Feed Events

```javascript
// Emit activity to subscribed users
io.to(`client:${clientId}`).emit('activity', {
  id: activityId,
  type: 'project_updated',
  actor: { id: userId, name: 'John Doe' },
  resource: { type: 'project', id: projectId, name: 'Project Name' },
  action: 'status_changed',
  details: { from: 'planning', to: 'in_progress' },
  timestamp: new Date()
});

// Activity Types:
// - project_created
// - project_updated
// - project_status_changed
// - invoice_created
// - payment_received
// - ticket_created
// - ticket_updated
// - file_uploaded
// - client_updated
```

#### Live Updates Events

```javascript
// Emit live metric updates
io.to(`vps:${vpsId}`).emit('metrics_update', {
  vpsId: vpsId,
  cpuUsage: 45.2,
  ramUsage: 62.8,
  diskUsage: 78.5,
  timestamp: new Date()
});

// Emit hosting resource updates
io.to(`hosting:${hostingId}`).emit('resource_update', {
  hostingId: hostingId,
  diskUsed: 25.5,
  bandwidthUsed: 150.2,
  timestamp: new Date()
});
```

### Channel Subscriptions

```javascript
// User subscribes to notifications
socket.on('subscribe:notifications', () => {
  socket.join(`user:${socket.userId}`);
  socket.emit('subscribed', { channel: 'notifications' });
});

// User subscribes to client updates
socket.on('subscribe:client', (data) => {
  const { clientId } = data;
  // Verify user has access to client
  socket.join(`client:${clientId}`);
  socket.emit('subscribed', { channel: `client:${clientId}` });
});

// User subscribes to project updates
socket.on('subscribe:project', (data) => {
  const { projectId } = data;
  // Verify user has access to project
  socket.join(`project:${projectId}`);
  socket.emit('subscribed', { channel: `project:${projectId}` });
});

// User unsubscribes
socket.on('unsubscribe', (data) => {
  const { channel } = data;
  socket.leave(channel);
  socket.emit('unsubscribed', { channel });
});
```

### Offline Message Queuing

```javascript
// When user is offline, queue notifications
async function queueNotification(userId, notification) {
  await redis.lpush(`notifications:queue:${userId}`, JSON.stringify(notification));
  await redis.expire(`notifications:queue:${userId}`, 86400); // 24 hours
}

// On reconnection, deliver queued messages
socket.on('connect', async () => {
  const queuedNotifications = await redis.lrange(
    `notifications:queue:${socket.userId}`,
    0,
    -1
  );
  
  queuedNotifications.forEach(notification => {
    socket.emit('notification', JSON.parse(notification));
  });
  
  await redis.del(`notifications:queue:${socket.userId}`);
});
```

## Security Implementation

### Helmet Middleware Configuration

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true
}));
```

### Rate Limiting

```javascript
// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.roles?.includes('super_admin'),
  keyGenerator: (req) => req.ip
});

// Auth endpoint limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.body.email || req.ip
});

// Payment endpoint limiter
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  keyGenerator: (req) => req.user.id
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/otp/request', authLimiter);
app.use('/api/payments', paymentLimiter);
```

### Input Validation with Zod

```javascript
// User registration schema
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[!@#$%^&*]/, 'Password must contain special character'),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100)
});

// Middleware for validation
const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.validated = validated;
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
  };
};

// Usage
app.post('/api/auth/register', validateRequest(registerSchema), authController.register);
```

### SQL Injection Prevention

```javascript
// Use parameterized queries
const query = 'SELECT * FROM users WHERE email = ? AND status = ?';
const [users] = await db.execute(query, [email, 'active']);

// Use ORM/Query Builder (recommended)
const user = await User.findOne({ email, status: 'active' });
```

### XSS Prevention

```javascript
// Sanitize user input
const sanitizeHtml = require('sanitize-html');

const sanitizedDescription = sanitizeHtml(req.body.description, {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
  allowedAttributes: {}
});

// Use template escaping
// In EJS/Handlebars: <%= variable %> (auto-escaped)
// In React: {variable} (auto-escaped)
```

### CSRF Protection

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: false }));

// Generate CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Verify CSRF token on state-changing requests
app.post('/api/users', (req, res, next) => {
  // CSRF middleware automatically validates
  next();
});
```

### Password Hashing

```javascript
const bcrypt = require('bcryptjs');

// Hash password on registration
const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

// Verify password on login
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### Encryption for Sensitive Data

```javascript
const crypto = require('crypto');

// Encrypt vault credentials
function encryptCredential(plaintext, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt vault credentials
function decryptCredential(encryptedData, encryptionKey) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encryptionKey), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```



## Error Handling & Response Standards

### Standard Response Format

#### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00Z",
    "version": "1.0"
  }
}
```

#### Paginated Response

```json
{
  "success": true,
  "message": "Records retrieved successfully",
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 150,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPreviousPage": false
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 12 characters"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-01T12:00:00Z",
    "requestId": "req_123abc"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 202 | Accepted | Async operation accepted (2FA pending) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists (duplicate email) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server error |
| 503 | Service Unavailable | Database/external service down |

### Error Codes

```
AUTH_ERRORS:
- INVALID_CREDENTIALS
- TOKEN_EXPIRED
- TOKEN_INVALID
- OTP_INVALID
- OTP_EXPIRED
- 2FA_REQUIRED
- ACCOUNT_LOCKED
- ACCOUNT_SUSPENDED

VALIDATION_ERRORS:
- VALIDATION_ERROR
- INVALID_EMAIL
- INVALID_PHONE
- INVALID_URL
- INVALID_DATE

AUTHORIZATION_ERRORS:
- INSUFFICIENT_PERMISSIONS
- RESOURCE_NOT_ACCESSIBLE
- ROLE_REQUIRED

RESOURCE_ERRORS:
- RESOURCE_NOT_FOUND
- RESOURCE_ALREADY_EXISTS
- RESOURCE_IN_USE

PAYMENT_ERRORS:
- PAYMENT_FAILED
- PAYMENT_GATEWAY_ERROR
- INSUFFICIENT_FUNDS
- TRANSACTION_TIMEOUT

EXTERNAL_SERVICE_ERRORS:
- SMS_SEND_FAILED
- EMAIL_SEND_FAILED
- CPANEL_API_ERROR
- PAYMENT_GATEWAY_UNAVAILABLE

SYSTEM_ERRORS:
- DATABASE_ERROR
- INTERNAL_SERVER_ERROR
- SERVICE_UNAVAILABLE
```

### Error Handling Middleware

```javascript
// Global error handler
app.use((err, req, res, next) => {
  const errorId = generateErrorId();
  
  // Log error
  logger.error({
    errorId,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip
  });

  // Determine status code
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      errorId: errorId,
      details: err.details || undefined
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});
```



## Deployment Architecture

### Deployment Targets

#### 1. cPanel Hosting

**Setup Process:**
```bash
# 1. SSH into cPanel server
ssh user@cpanel-server.com

# 2. Navigate to public_html or subdomain directory
cd ~/public_html/api

# 3. Clone repository
git clone https://github.com/abancool/backend.git .

# 4. Install dependencies
npm install --production

# 5. Create .env file
cp .env.example .env
# Edit .env with production values

# 6. Run database migrations
npm run migrate

# 7. Create admin user
npm run create-admin

# 8. Start with PM2 (see PM2 section below)
```

**cPanel Configuration:**
- Use Node.js selector in cPanel to select Node.js version (18+)
- Configure application startup file: `src/index.js`
- Set environment variables in cPanel
- Configure SSL certificate (auto-renew)
- Set up cron jobs for backups and automations

#### 2. VPS Deployment (Ubuntu/CentOS)

**Prerequisites:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL/PostgreSQL
sudo apt install -y mysql-server

# Install Redis (optional, for caching)
sudo apt install -y redis-server

# Install Nginx (reverse proxy)
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2
```

**Application Setup:**
```bash
# Create application directory
sudo mkdir -p /var/www/abancool-api
sudo chown $USER:$USER /var/www/abancool-api

# Clone repository
cd /var/www/abancool-api
git clone https://github.com/abancool/backend.git .

# Install dependencies
npm install --production

# Create .env file
cp .env.example .env
# Edit with production values

# Run migrations
npm run migrate

# Create admin user
npm run create-admin
```

**Nginx Configuration:**
```nginx
upstream abancool_api {
  server 127.0.0.1:4000;
  server 127.0.0.1:4001;
  server 127.0.0.1:4002;
  keepalive 64;
}

server {
  listen 80;
  server_name api.abancool.com;
  
  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.abancool.com;

  # SSL certificates
  ssl_certificate /etc/letsencrypt/live/api.abancool.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.abancool.com/privkey.pem;

  # SSL configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # Gzip compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  gzip_min_length 1000;

  # Proxy settings
  location / {
    proxy_pass http://abancool_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # WebSocket support
  location /socket.io {
    proxy_pass http://abancool_api;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # Rate limiting
  limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
  limit_req zone=api_limit burst=20 nodelay;
}
```

#### 3. PM2 Process Manager

**PM2 Ecosystem Configuration:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'abancool-api',
      script: './src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
      shutdown_with_message: true
    }
  ],
  deploy: {
    production: {
      user: 'deploy',
      host: 'api.abancool.com',
      ref: 'origin/main',
      repo: 'https://github.com/abancool/backend.git',
      path: '/var/www/abancool-api',
      'post-deploy': 'npm install --production && npm run migrate && pm2 reload ecosystem.config.js --env production'
    }
  }
};
```

**PM2 Commands:**
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# View logs
pm2 logs abancool-api

# Restart
pm2 restart abancool-api

# Stop
pm2 stop abancool-api

# Delete
pm2 delete abancool-api

# Save PM2 configuration
pm2 save

# Resurrect on reboot
pm2 startup
```

### Database Deployment

**MySQL Setup:**
```bash
# Create database
mysql -u root -p
CREATE DATABASE abancool_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'abancool'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON abancool_production.* TO 'abancool'@'localhost';
FLUSH PRIVILEGES;

# Run migrations
npm run migrate
```

**PostgreSQL Setup:**
```bash
# Create database
sudo -u postgres psql
CREATE DATABASE abancool_production;
CREATE USER abancool WITH PASSWORD 'strong_password';
ALTER ROLE abancool SET client_encoding TO 'utf8';
ALTER ROLE abancool SET default_transaction_isolation TO 'read committed';
ALTER ROLE abancool SET default_transaction_deferrable TO on;
ALTER ROLE abancool SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE abancool_production TO abancool;

# Run migrations
npm run migrate
```

### SSL/TLS Configuration

**Let's Encrypt with Certbot:**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d api.abancool.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal
sudo certbot renew --dry-run
```

### Backup Strategy

**Automated Backups:**
```bash
# Create backup script: /usr/local/bin/backup-abancool.sh
#!/bin/bash

BACKUP_DIR="/backups/abancool"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="abancool_production"
DB_USER="abancool"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Files backup
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/abancool-api/uploads

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR s3://abancool-backups/ --recursive

# Cron job: 0 2 * * * /usr/local/bin/backup-abancool.sh
```

### Monitoring & Logging

**Application Monitoring:**
```javascript
// Use PM2 Plus for monitoring
pm2 install pm2-auto-pull
pm2 install pm2-logrotate

// Configure log rotation
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 30
```

**Centralized Logging:**
```bash
# Install ELK Stack or use cloud service
# Example: Datadog, New Relic, or Sentry

// In application
const Sentry = require("@sentry/node");
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```



## Scalability & Performance Considerations

### Database Optimization

#### Connection Pooling

```javascript
// MySQL connection pool
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});
```

#### Query Optimization

```sql
-- Add indexes on frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_projects_client_status ON projects(client_id, status);
CREATE INDEX idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action_type);
```

#### Query Caching

```javascript
// Redis caching layer
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
});

// Cache user data
async function getUser(userId) {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  const cached = await client.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Query database
  const user = await User.findById(userId);
  
  // Store in cache (1 hour TTL)
  await client.setex(cacheKey, 3600, JSON.stringify(user));
  
  return user;
}

// Invalidate cache on update
async function updateUser(userId, data) {
  const user = await User.update(userId, data);
  await client.del(`user:${userId}`);
  return user;
}
```

### API Performance

#### Response Compression

```javascript
// Already configured in index.js
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

#### Pagination

```javascript
// Implement cursor-based pagination for large datasets
async function listClients(req, res) {
  const { limit = 20, cursor } = req.query;
  
  let query = Client.query();
  
  if (cursor) {
    query = query.where('id', '>', cursor);
  }
  
  const clients = await query
    .limit(limit + 1)
    .orderBy('id', 'asc');
  
  const hasMore = clients.length > limit;
  const data = hasMore ? clients.slice(0, -1) : clients;
  const nextCursor = hasMore ? data[data.length - 1].id : null;
  
  res.json({
    success: true,
    data,
    meta: {
      pagination: {
        limit,
        nextCursor,
        hasMore
      }
    }
  });
}
```

#### Lazy Loading

```javascript
// Load related data only when requested
async function getProject(req, res) {
  const { id } = req.params;
  const { include } = req.query; // ?include=team,files,budget
  
  let query = Project.query().where('id', id);
  
  if (include?.includes('team')) {
    query = query.withGraphFetched('team');
  }
  
  if (include?.includes('files')) {
    query = query.withGraphFetched('files');
  }
  
  const project = await query.first();
  
  res.json({
    success: true,
    data: project
  });
}
```

### Horizontal Scaling

#### Load Balancing

```nginx
# Nginx load balancer configuration
upstream api_backend {
  least_conn;
  server api1.abancool.com:4000 weight=1;
  server api2.abancool.com:4000 weight=1;
  server api3.abancool.com:4000 weight=1;
  
  # Health check
  check interval=3000 rise=2 fall=5 timeout=1000 type=http;
  check_http_send "GET /health HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx;
}

server {
  listen 80;
  server_name api.abancool.com;
  
  location / {
    proxy_pass http://api_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

#### Session Persistence

```javascript
// Store sessions in Redis for distributed systems
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

#### Sticky Sessions for WebSocket

```javascript
// Configure sticky sessions for Socket.IO
const io = require('socket.io')(server, {
  transports: ['websocket', 'polling'],
  adapter: require('socket.io-redis')({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  })
});

// Nginx sticky sessions
upstream api_backend {
  hash $remote_addr consistent;
  server api1.abancool.com:4000;
  server api2.abancool.com:4000;
  server api3.abancool.com:4000;
}
```

### Asynchronous Processing

#### Job Queue with Bull

```javascript
const Queue = require('bull');

// Create queues
const emailQueue = new Queue('emails', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

const smsQueue = new Queue('sms', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

// Process email jobs
emailQueue.process(async (job) => {
  const { to, subject, html } = job.data;
  await sendEmail({ to, subject, html });
  return { success: true };
});

// Add job to queue
async function sendOTPEmail(email, code) {
  await emailQueue.add(
    { to: email, subject: 'Your OTP', html: renderOTPTemplate({ code }) },
    { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
  );
}

// Monitor queue
emailQueue.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job ${job.id} failed:`, err.message);
});
```

#### Scheduled Tasks with Node-Cron

```javascript
const cron = require('node-cron');

// Check domain expiration daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const expiringDomains = await Domain.query()
    .whereRaw('DATEDIFF(expiration_date, CURDATE()) <= 30')
    .where('auto_renewal', false);
  
  for (const domain of expiringDomains) {
    await notificationService.sendDomainExpirationReminder(domain);
  }
});

// Check SSL certificate expiration daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  const expiringSSLs = await Domain.query()
    .whereRaw('DATEDIFF(ssl_expiration_date, CURDATE()) <= 30');
  
  for (const domain of expiringSSLs) {
    await notificationService.sendSSLExpirationReminder(domain);
  }
});

// Process automation rules every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const automations = await Automation.query()
    .where('status', 'active');
  
  for (const automation of automations) {
    await automationService.executeAutomation(automation);
  }
});

// Cleanup expired sessions daily at 4 AM
cron.schedule('0 4 * * *', async () => {
  await Session.query()
    .where('expires_at', '<', new Date())
    .delete();
});

// Backup database daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await backupService.backupDatabase();
});
```

### Monitoring & Metrics

#### Application Metrics

```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  
  next();
});

// Expose metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

#### Health Check Endpoint

```javascript
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.ping();
    
    // Check Redis connection
    await redis.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Performance Benchmarks

**Target Metrics:**
- API response time: < 200ms (p95)
- Database query time: < 100ms (p95)
- Throughput: 1000+ requests/second
- Availability: 99.9% uptime
- Error rate: < 0.1%

**Load Testing:**
```bash
# Using Apache Bench
ab -n 10000 -c 100 https://api.abancool.com/api/clients

# Using wrk
wrk -t12 -c400 -d30s https://api.abancool.com/api/clients

# Using k6
k6 run load-test.js
```



## Testing Strategy

### Unit Testing

**Framework:** Jest + Supertest

```javascript
// Example: User authentication tests
describe('Authentication Controller', () => {
  describe('POST /api/auth/login', () => {
    it('should return JWT token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'ValidPassword123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should lock account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'user@example.com',
            password: 'WrongPassword'
          });
      }
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'ValidPassword123!'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });
});
```

### Integration Testing

**Framework:** Jest + Supertest + Test Database

```javascript
describe('Invoice Creation Flow', () => {
  let client, invoice;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Create test client
    client = await Client.create({
      company_name: 'Test Company',
      email: 'test@example.com'
    });
  });

  afterEach(async () => {
    // Cleanup
    await Client.destroy({ where: { id: client.id } });
  });

  it('should create invoice and send email notification', async () => {
    const response = await request(app)
      .post('/api/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        items: [
          { description: 'Web Development', quantity: 1, unitPrice: 5000 }
        ],
        taxRate: 16
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.invoiceNumber).toBeDefined();
    
    // Verify email was queued
    const emailJob = await emailQueue.getJob(response.body.data.id);
    expect(emailJob).toBeDefined();
  });
});
```

### API Testing

**Framework:** Postman/Newman

```json
{
  "info": {
    "name": "ABANCOOL API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/api/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\"email\": \"user@example.com\", \"password\": \"Password123!\"}"
            }
          },
          "tests": "pm.test('Status is 200', function() { pm.response.to.have.status(200); }); pm.environment.set('token', pm.response.json().data.token);"
        }
      ]
    }
  ]
}
```

### Load Testing

**Framework:** k6

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.1']
  }
};

export default function () {
  const url = 'https://api.abancool.com/api/clients';
  const params = {
    headers: {
      'Authorization': `Bearer ${__ENV.TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  const response = http.get(url, params);
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has data': (r) => r.json('data') !== null
  });

  sleep(1);
}
```

### Security Testing

**Framework:** OWASP ZAP / Burp Suite

```bash
# Run OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.abancool.com \
  -r zap-report.html

# Test SQL Injection
curl -X GET "https://api.abancool.com/api/clients?search=1' OR '1'='1"

# Test XSS
curl -X POST "https://api.abancool.com/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name": "<script>alert(1)</script>"}'

# Test CSRF
# Verify CSRF token requirement on state-changing requests
```

### Test Coverage

**Target Coverage:**
- Unit tests: 80%+ coverage
- Integration tests: 60%+ coverage
- Critical paths: 100% coverage

```bash
# Generate coverage report
npm run test:coverage

# Expected output:
# =============================== Coverage summary ===============================
# Statements   : 82.5% ( 1650/2000 )
# Branches     : 78.3% ( 940/1200 )
# Functions    : 85.2% ( 512/600 )
# Lines        : 83.1% ( 1662/2000 )
```



## Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)
- [ ] Project setup and configuration
- [ ] Database schema creation and migrations
- [ ] Authentication system (JWT, OTP, 2FA)
- [ ] User and role management
- [ ] Basic RBAC middleware
- [ ] Error handling and response standards
- [ ] Logging and audit system

### Phase 2: Core Modules (Weeks 3-5)
- [ ] Client management
- [ ] Project management
- [ ] Hosting management
- [ ] Domain management
- [ ] VPS management
- [ ] Password vault with encryption
- [ ] File management

### Phase 3: Billing & Payments (Weeks 6-7)
- [ ] Invoice and quote generation
- [ ] M-Pesa integration
- [ ] IntaSend integration
- [ ] Paystack integration
- [ ] Transaction tracking
- [ ] Payment webhook handlers

### Phase 4: Communications (Weeks 8-9)
- [ ] SMS engine (Africa's Talking, Twilio)
- [ ] WhatsApp integration
- [ ] Email system with templates
- [ ] SMS/WhatsApp campaigns
- [ ] Notification system

### Phase 5: Support & Automation (Weeks 10-11)
- [ ] Support ticket system
- [ ] Automation engine
- [ ] Scheduled tasks (cron jobs)
- [ ] Real-time notifications (Socket.IO)
- [ ] Activity feed

### Phase 6: DevOps & Deployment (Weeks 12-13)
- [ ] Deployment scripts
- [ ] PM2 configuration
- [ ] Nginx setup
- [ ] SSL/TLS configuration
- [ ] Backup system
- [ ] Monitoring and logging

### Phase 7: Testing & Optimization (Weeks 14-15)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Load testing
- [ ] Security testing
- [ ] Performance optimization
- [ ] Documentation

### Phase 8: Production Launch (Week 16)
- [ ] Final testing
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Support handover

## Development Guidelines

### Code Structure

```
server/
├── src/
│   ├── config/              # Configuration files
│   │   ├── index.js
│   │   ├── db.js
│   │   └── constants.js
│   ├── controllers/         # Request handlers
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   ├── clients.controller.js
│   │   └── ...
│   ├── services/            # Business logic
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   ├── client.service.js
│   │   ├── payment.service.js
│   │   ├── email.service.js
│   │   ├── sms.service.js
│   │   └── ...
│   ├── models/              # Database models
│   │   ├── User.js
│   │   ├── Client.js
│   │   ├── Project.js
│   │   └── ...
│   ├── middleware/          # Express middleware
│   │   ├── auth.js
│   │   ├── error.js
│   │   ├── validation.js
│   │   └── ...
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── clients.routes.js
│   │   └── ...
│   ├── utils/               # Utility functions
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   ├── encryption.js
│   │   └── ...
│   ├── scripts/             # Database scripts
│   │   ├── migrate.js
│   │   ├── seed.js
│   │   └── create-admin.js
│   ├── jobs/                # Background jobs
│   │   ├── email.job.js
│   │   ├── sms.job.js
│   │   └── ...
│   ├── crons/               # Scheduled tasks
│   │   ├── domain-expiration.cron.js
│   │   ├── ssl-expiration.cron.js
│   │   └── ...
│   ├── index.js             # Application entry point
│   └── socket.js            # Socket.IO setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── package.json
└── README.md
```

### Naming Conventions

- **Files**: kebab-case (auth.controller.js)
- **Functions**: camelCase (getUserById)
- **Classes**: PascalCase (UserService)
- **Constants**: UPPER_SNAKE_CASE (MAX_LOGIN_ATTEMPTS)
- **Database tables**: snake_case (support_tickets)
- **Database columns**: snake_case (created_at)

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/user-management

# Make changes and commit
git add .
git commit -m "feat: implement user management endpoints"

# Push to remote
git push origin feature/user-management

# Create pull request
# After review and approval, merge to main
```

### Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=4000
APP_NAME=ABANCOOL Command Center

# Database
DB_HOST=db.example.com
DB_PORT=3306
DB_USER=abancool
DB_PASSWORD=strong_password
DB_NAME=abancool_production

# JWT
JWT_SECRET=very_long_random_secret_key
JWT_EXPIRES_IN=24h

# OTP
OTP_LENGTH=6
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@abancool.com
SMTP_PASSWORD=app_password
MAIL_FROM=noreply@abancool.com

# Redis
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Payment Gateways
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
INTASEND_API_KEY=your_key
PAYSTACK_SECRET_KEY=your_key

# SMS Providers
AFRICAS_TALKING_API_KEY=your_key
AFRICAS_TALKING_USERNAME=your_username
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token

# WhatsApp
WHATSAPP_BUSINESS_ACCOUNT_ID=your_id
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_id

# cPanel
CPANEL_HOST=cpanel.example.com
CPANEL_USERNAME=admin
CPANEL_PASSWORD=password

# CORS
CORS_ORIGINS=https://app.abancool.com,https://admin.abancool.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://your_sentry_dsn

# Backup
BACKUP_STORAGE=s3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=abancool-backups
```

## Conclusion

This comprehensive design document provides a production-ready blueprint for the ABANCOOL Command Center Backend. The system is architected for:

- **Scalability**: Horizontal scaling with load balancing and stateless design
- **Security**: Multi-layered security with encryption, rate limiting, and comprehensive audit trails
- **Reliability**: Redundancy, backup systems, and health monitoring
- **Maintainability**: Clear separation of concerns, modular architecture, and comprehensive documentation
- **Performance**: Optimized queries, caching strategies, and asynchronous processing

The monolithic architecture provides operational simplicity while maintaining the flexibility to evolve into microservices as the system scales. All components are designed with production deployment in mind, supporting cPanel, VPS, and PM2 environments.

### Key Deliverables

1. **API Specification**: 50+ RESTful endpoints across 14 modules
2. **Database Schema**: 20+ normalized tables with proper relationships and indexes
3. **Security Framework**: JWT authentication, RBAC, encryption, and audit logging
4. **Integration Points**: Payment gateways, SMS providers, WhatsApp, and cPanel APIs
5. **Real-time Features**: Socket.IO for live notifications and activity feeds
6. **Deployment Strategy**: cPanel, VPS, and PM2 configurations with SSL/TLS
7. **Scalability Plan**: Load balancing, caching, job queues, and monitoring

### Next Steps

1. Review and approve this design document
2. Set up development environment and database
3. Begin Phase 1 implementation (Core Infrastructure)
4. Establish CI/CD pipeline for automated testing and deployment
5. Set up monitoring and logging infrastructure
6. Conduct security audit before production launch

