# WHM/cPanel Integration - Complete Implementation Guide

**Version**: 1.0  
**Status**: Production Ready  
**Last Updated**: May 19, 2026

---

## Table of Contents

1. [Setup](#setup)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Database Schema](#database-schema)
5. [Configuration](#configuration)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Monitoring & Logging](#monitoring--logging)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

---

## Setup

### Prerequisites

- Node.js 18+
- Express.js
- MySQL 8.0+
- cPanel/WHM Server with API Token
- ABANCOOL backend already running

### Installation

#### 1. Environment Variables

Add to `.env.production`:

```env
# WHM Configuration
WHM_HOST=https://your-server-hostname:2087
WHM_USERNAME=your_reseller_username
WHM_TOKEN=your_whm_api_token
```

#### 2. Install Dependencies

```bash
npm install axios
```

#### 3. Database Migration

Run migration to create WHM tables:

```bash
npm run migrate:latest
# or
node server/scripts/run-migrations.js
```

#### 4. Integrate Routes

Update `server/src/routes.js`:

```javascript
const whmRoutes = require('./routes/whm.routes');

// Add to router
router.use('/api/hosting', whmRoutes);
```

#### 5. Start Server

```bash
npm start
# or
pm2 start ecosystem.config.js --env production
```

---

## Architecture

### Service Layer

```
src/integrations/whm/
├── whm.client.js         # Axios client with retry logic
├── accounts.service.js   # Account management
├── packages.service.js   # Package management
├── bandwidth.service.js  # Bandwidth monitoring
├── ssl.service.js        # SSL certificate management
├── sessions.service.js   # Login sessions & SSO
├── dns.service.js        # DNS management
└── index.js              # Exports all services
```

### Controller Layer

```
src/controllers/whm.controller.js
- Handles all WHM endpoint requests
- Maps services to HTTP endpoints
- Formats responses
- Error handling
```

### Routes Layer

```
src/routes/whm.routes.js
- REST API endpoint definitions
- Middleware application
- Request validation
```

### Validation Layer

```
src/validators/whm.validator.js
- Zod schema definitions
- Request body validation
- Parameter validation
```

---

## API Endpoints

### Accounts Management

#### Create Account
```http
POST /api/hosting/accounts/create
Content-Type: application/json

{
  "username": "newuser",
  "domain": "example.com",
  "password": "SecurePassword123!",
  "contactemail": "contact@example.com",
  "plan": "default"
}

Response: 201 Created
{
  "status": "success",
  "data": {
    "account_id": "123456",
    "username": "newuser"
  }
}
```

#### List Accounts
```http
GET /api/hosting/accounts?search=example

Response: 200 OK
{
  "status": "success",
  "data": [
    {
      "user": "account1",
      "domain": "example.com",
      "email": "contact@example.com",
      "plan": "default",
      "suspended": "0"
    }
  ]
}
```

#### Get Account Details
```http
GET /api/hosting/accounts/:username

Response: 200 OK
{
  "status": "success",
  "data": {
    "user": "username",
    "domain": "example.com",
    "bandwidth_usage": 45.3,
    "disk_usage": 12.5,
    ...
  }
}
```

#### Suspend Account
```http
POST /api/hosting/accounts/:username/suspend
Content-Type: application/json

{
  "reason": "Non-payment"
}

Response: 200 OK
```

#### Unsuspend Account
```http
POST /api/hosting/accounts/:username/unsuspend

Response: 200 OK
```

#### Terminate Account
```http
POST /api/hosting/accounts/:username/terminate
Content-Type: application/json

{
  "keepDns": false
}

Response: 200 OK
```

#### Change Password
```http
POST /api/hosting/accounts/:username/password
Content-Type: application/json

{
  "password": "NewPassword123!"
}

Response: 200 OK
```

#### Upgrade Account
```http
POST /api/hosting/accounts/:username/upgrade
Content-Type: application/json

{
  "newPlan": "premium"
}

Response: 200 OK
```

### Packages Management

#### List Packages
```http
GET /api/hosting/packages

Response: 200 OK
{
  "status": "success",
  "data": [
    {
      "name": "default",
      "featurelist": "default",
      "diskspace": "100",
      "bandwidth": "unlimited"
    }
  ]
}
```

#### Create Package
```http
POST /api/hosting/packages
Content-Type: application/json

{
  "name": "premium",
  "featurelist": "default",
  "maxaddon": 10,
  "maxpark": 10,
  "maxsql": 5,
  "maxpop": 50,
  "maxemail": 500,
  "diskspace": "250",
  "bandwidth": "1000"
}

Response: 201 Created
```

#### Edit Package
```http
PUT /api/hosting/packages/:name
Content-Type: application/json

{
  "maxaddon": 15,
  "diskspace": "300"
}

Response: 200 OK
```

### Bandwidth Monitoring

#### Get Bandwidth Usage
```http
GET /api/hosting/bandwidth?username=account1

Response: 200 OK
{
  "status": "success",
  "data": {
    "account": "account1",
    "used": 45.3,
    "limit": "unlimited",
    "percent": 0
  }
}
```

#### Get Bandwidth History
```http
GET /api/hosting/bandwidth/:username/history?days=30

Response: 200 OK
{
  "status": "success",
  "data": [
    {
      "used_gb": 45.3,
      "limit_gb": null,
      "percent_used": 0,
      "snapshot_date": "2026-05-19T10:30:00Z"
    }
  ]
}
```

### SSL Management

#### List SSL Certificates
```http
GET /api/hosting/ssl?username=account1

Response: 200 OK
{
  "status": "success",
  "data": [
    {
      "domain": "example.com",
      "ssl": "1",
      "ip": "192.168.1.1"
    }
  ]
}
```

#### Generate CSR
```http
POST /api/hosting/ssl/csr
Content-Type: application/json

{
  "username": "account1",
  "domain": "example.com",
  "countryCode": "US",
  "state": "California",
  "city": "San Francisco",
  "organization": "Example Inc"
}

Response: 201 Created
{
  "status": "success",
  "data": {
    "csr": "-----BEGIN CERTIFICATE REQUEST-----...",
    "key": "-----BEGIN PRIVATE KEY-----..."
  }
}
```

#### Get SSL Status
```http
GET /api/hosting/ssl/:username/status

Response: 200 OK
{
  "status": "success",
  "data": {
    "totalCertificates": 3,
    "expiringCertificates": 1,
    "certificates": [...]
  }
}
```

### Sessions & SSO

#### Create Login Session
```http
POST /api/hosting/sessions/login
Content-Type: application/json

{
  "username": "account1",
  "redirectUrl": "https://example.com/dashboard"
}

Response: 201 Created
{
  "status": "success",
  "data": {
    "url": "https://server.com:2083/login?session=...",
    "sessionId": "session_hash_123"
  }
}
```

#### Generate SSO Link
```http
POST /api/hosting/sso-link?returnUrl=https://app.example.com/dashboard
Content-Type: application/json

{
  "username": "account1"
}

Response: 201 Created
{
  "status": "success",
  "data": {
    "link": "https://yourapp.com/api/hosting/sso?hash=...&return=..."
  }
}
```

### DNS Management

#### List DNS Zones
```http
GET /api/hosting/dns?username=account1

Response: 200 OK
{
  "status": "success",
  "data": ["example.com", "test.com"]
}
```

#### Create DNS Zone
```http
POST /api/hosting/dns/zones
Content-Type: application/json

{
  "domain": "example.com",
  "nameserver1": "ns1.example.com",
  "nameserver2": "ns2.example.com"
}

Response: 201 Created
```

#### Create MX Record
```http
POST /api/hosting/dns/mx
Content-Type: application/json

{
  "domain": "example.com",
  "priority": 10,
  "exchange": "mail.example.com"
}

Response: 201 Created
```

---

## Database Schema

### hosting_accounts
- id (INT, PK)
- username (VARCHAR, UNIQUE)
- domain (VARCHAR)
- email (VARCHAR)
- plan (VARCHAR)
- status (ENUM: active, suspended, terminated)
- account_id (VARCHAR)
- bandwidth_limit (VARCHAR)
- disk_limit (VARCHAR)
- suspended_reason (TEXT)
- suspended_at (TIMESTAMP)
- password_changed_at (TIMESTAMP)
- upgraded_at (TIMESTAMP)
- terminated_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)

### hosting_packages
- id (INT, PK)
- name (VARCHAR, UNIQUE)
- feature_list (VARCHAR)
- max_addon (INT)
- max_park (INT)
- max_sql (INT)
- max_pop (INT)
- max_email (INT)
- max_list (INT)
- max_forwarders (INT)
- disk_space (VARCHAR)
- bandwidth (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)

### bandwidth_usage
- id (INT, PK)
- username (VARCHAR, FK)
- used_gb (DECIMAL)
- limit_gb (DECIMAL)
- percent_used (DECIMAL)
- snapshot_date (TIMESTAMP)

### ssl_certificates
- id (INT, PK)
- username (VARCHAR, FK)
- domain (VARCHAR, UNIQUE)
- certificate (LONGTEXT)
- private_key (LONGTEXT)
- ca_bundle (LONGTEXT)
- status (ENUM: active, inactive, expired)
- expires_at (TIMESTAMP)
- installed_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)

### login_sessions
- id (INT, PK)
- username (VARCHAR, FK)
- session_hash (VARCHAR, UNIQUE)
- redirect_url (VARCHAR)
- session_url (VARCHAR)
- expires_at (TIMESTAMP)
- revoked_at (TIMESTAMP)
- created_at (TIMESTAMP)

### dns_zones
- id (INT, PK)
- domain (VARCHAR, UNIQUE)
- nameserver1-4 (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)

### dns_records
- id (INT, PK)
- domain (VARCHAR, FK)
- record_type (VARCHAR)
- name (VARCHAR)
- value (VARCHAR)
- priority (INT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- deleted_at (TIMESTAMP)

---

## Configuration

### Environment Variables

```env
# Required
WHM_HOST=https://your-cpanel-server.com:2087
WHM_USERNAME=your_reseller_account
WHM_TOKEN=your_generated_api_token

# Optional
WHM_RETRY_ATTEMPTS=3
WHM_REQUEST_TIMEOUT=30000
WHM_SSL_VERIFY=false
```

### WHM API Token Setup

1. Log into WHM as reseller account
2. Go to: Development → API Tokens
3. Click "Generate Token"
4. Enter name: "abancool_command_center"
5. Set expiration: "The API Token will not expire"
6. Select privileges:
   - Account Summary
   - List Accounts
   - Create Accounts
   - Suspend/Unsuspend Accounts
   - Terminate Accounts
   - Change Passwords
   - Create User Session
   - Show Bandwidth
   - Fetch SSL VHosts
   - Manage DNS Records
   - Add/Remove Packages
   - Edit Packages
7. Click "Generate"
8. Copy token and save to `.env.production`

---

## Usage Examples

### Example 1: Create and Configure New Account

```javascript
const { AccountsService, DNSService, SSLService } = require('./integrations/whm');

async function setupNewClient(clientData) {
  try {
    // 1. Create account
    const account = await AccountsService.createAccount({
      username: clientData.username,
      domain: clientData.domain,
      password: clientData.password,
      contactemail: clientData.email,
      plan: 'premium',
    });

    // 2. Create DNS zones
    await DNSService.createDNSZone(
      clientData.domain,
      '208.74.92.1',
      '208.74.92.2'
    );

    // 3. Add MX records
    await DNSService.createMXRecord(
      clientData.domain,
      10,
      `mail.${clientData.domain}`
    );

    // 4. Generate SSL CSR
    const csr = await SSLService.generateCSR(
      clientData.username,
      clientData.domain,
      'US',
      'CA',
      'San Francisco',
      clientData.company
    );

    return {
      account,
      dns: true,
      mx: true,
      csr: csr.csr,
    };
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}
```

### Example 2: Monitor Account Bandwidth

```javascript
const { BandwidthService } = require('./integrations/whm');

async function monitorBandwidth(username) {
  const status = await BandwidthService.getAccountBandwidthStatus(username);

  if (status.latest.percent_used > 90) {
    console.warn(`⚠️ ${username} using ${status.latest.percent_used}% bandwidth`);
    // Send alert notification
  }

  return status;
}
```

### Example 3: Generate One-Click Login

```javascript
const { SessionsService } = require('./integrations/whm');

async function generateClientLoginLink(username) {
  const ssoLink = await SessionsService.generateSSOLink(
    username,
    'https://app.example.com/dashboard'
  );

  return {
    url: ssoLink,
    expiresIn: '30 minutes',
  };
}
```

---

## Error Handling

### Retry Logic

- Automatic retry on: 408, 429, 500, 502, 503, 504
- Retry attempts: 3
- Backoff: Exponential (1s, 2s, 4s)

### Error Response Format

```json
{
  "status": "error",
  "message": "Account creation failed",
  "code": "WHM_API_ERROR",
  "statusCode": 500
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API token | Regenerate token in WHM |
| 400 Bad Request | Invalid parameters | Check parameter format |
| 403 Forbidden | Insufficient privileges | Add privileges to API token |
| 409 Conflict | Username already exists | Use unique username |
| 500 Server Error | WHM server error | Retry or contact hosting |

---

## Monitoring & Logging

### Structured Logging

All operations logged with context:

```javascript
logger.info('[WHM] Creating account: newuser (example.com)');
logger.error('[WHM] Account creation failed', {
  username: 'newuser',
  error: 'Username already exists'
});
```

### Audit Trail

All account actions stored in database:
- Account creation
- Suspensions/unsuspensions
- Terminations
- Password changes
- SSL operations
- DNS modifications

### Performance Monitoring

- Request duration tracking
- Retry attempts logged
- API response times monitored
- Connection pooling enabled

---

## Security

### API Token Security

✓ Stored in `.env.production`  
✓ Never committed to git  
✓ File permissions: 600  
✓ Rotate tokens annually  
✓ Use IP whitelisting in WHM  

### Data Protection

✓ HTTPS only (WHM host: 2087)  
✓ SSL certificate verification (can disable for self-signed)
✓ Sensitive data not logged
✓ Passwords hashed in database

### Access Control

✓ Admin/super_admin only
✓ Authentication middleware enforced
✓ Request validation with Zod
✓ Rate limiting recommended

---

## Troubleshooting

### Connection Issues

**Problem**: "connect to host: Connection refused"

**Solution**:
```bash
# Verify WHM is running
curl -k https://your-cpanel-server.com:2087/json-api/accountsummary

# Check firewall
sudo ufw allow 2087
```

### Authentication Issues

**Problem**: "401 Unauthorized"

**Solution**:
```bash
# Regenerate API token in WHM
# Verify WHM_USERNAME and WHM_TOKEN in .env
# Check IP whitelisting in WHM
```

### Performance Issues

**Problem**: "Request timeout"

**Solution**:
```bash
# Increase timeout
WHM_REQUEST_TIMEOUT=60000

# Reduce concurrent requests
# Check WHM server resources
top # on WHM server
```

### Database Issues

**Problem**: "Foreign key constraint failed"

**Solution**:
```bash
# Run migrations
npm run migrate:latest

# Check foreign key relationships
```

---

## Support & Documentation

- WHM API Documentation: https://documentation.cpanel.net/
- cPanel Support: support@cpanel.net
- ABANCOOL Docs: See main README.md

---

**Version**: 1.0  
**Production Ready**: Yes  
**Last Updated**: May 19, 2026
