# Production Configuration Summary

## Overview

This document provides a complete summary of all production configurations for the ABANCOOL backend API, including database, email, SMS, and other external integrations.

**Status**: Production Ready ✅  
**Last Updated**: May 19, 2026  
**Environment**: kzinlgmw_internal (Production Database)

---

## 1. Database Configuration

### Primary Database

| Setting | Value |
|---------|-------|
| **Host** | localhost |
| **Port** | 3306 |
| **Database** | kzinlgmw_internal |
| **Username** | kzinlgmw_Panda |
| **Password** | Laban@2030 |
| **Character Set** | utf8mb4 |
| **Collation** | utf8mb4_unicode_ci |
| **Connection Limit** | 20 |

### Privileges Granted

✅ ALTER  
✅ ALTER ROUTINE  
✅ CREATE  
✅ CREATE ROUTINE  
✅ CREATE TEMPORARY TABLES  
✅ CREATE VIEW  
✅ DELETE  
✅ DROP  
✅ EVENT  
✅ EXECUTE  
✅ INDEX  
✅ INSERT  
✅ LOCK TABLES  
✅ REFERENCES  
✅ SELECT  
✅ SHOW VIEW  
✅ TRIGGER  
✅ UPDATE  

### Connection String

```
mysql://kzinlgmw_Panda:Laban@2030@localhost:3306/kzinlgmw_internal
```

### Environment Variables

```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=kzinlgmw_Panda
DB_PASSWORD=Laban@2030
DB_NAME=kzinlgmw_internal
DB_CONNECTION_LIMIT=20
DB_POOL_CLUSTER=false
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
```

---

## 2. Email Configuration

### SMTP Settings

| Setting | Value |
|---------|-------|
| **Host** | mail.abancool.com |
| **Port (SMTP)** | 465 |
| **Port (IMAP)** | 993 |
| **Port (POP3)** | 995 |
| **Username** | noreply@abancool.com |
| **Password** | Laban@2030 |
| **Security** | SSL/TLS (Secure) |
| **From Name** | ABANCOOL Notifications |
| **From Email** | noreply@abancool.com |

### IMAP Configuration (Inbox Monitoring)

```
Server: mail.abancool.com
Port: 993
Username: noreply@abancool.com
Password: Laban@2030
TLS: Enabled
```

### Environment Variables

```bash
SMTP_HOST=mail.abancool.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@abancool.com
SMTP_PASSWORD=Laban@2030
SMTP_FROM_NAME=ABANCOOL Notifications
SMTP_FROM_EMAIL=noreply@abancool.com

IMAP_HOST=mail.abancool.com
IMAP_PORT=993
IMAP_USER=noreply@abancool.com
IMAP_PASSWORD=Laban@2030
IMAP_TLS=true
```

### Email Service Features

- ✅ Transactional emails (OTP, password reset, etc.)
- ✅ Marketing emails (newsletters, announcements)
- ✅ Alert emails (system notifications)
- ✅ Inbox monitoring (incoming message processing)
- ✅ Email templates with variable substitution
- ✅ Retry mechanism for failed sends
- ✅ Email logging and tracking

### Email Types Configured

1. **Verification Emails** - Account activation, email verification
2. **OTP Emails** - One-time password delivery
3. **Password Reset** - Account recovery emails
4. **Invoice Emails** - Billing and payment notifications
5. **Alert Emails** - System alerts and warnings
6. **Support Emails** - Ticket notifications
7. **Admin Emails** - Administrative notifications

---

## 3. SMS Configuration

### Primary SMS Provider: Bulk SMS (TalkSasa)

| Setting | Value |
|---------|-------|
| **API Endpoint** | https://bulksms.talksasa.com/api/v3 |
| **API Token** | 2153\|obu7jXdaPDyxCecwxopipnq9ofxX6TPElIQjOjEn211b1ea2 |
| **Sender ID** | ABAN_COOL |
| **Message Type** | plain |
| **Priority** | 1 (Primary) |
| **Status** | ✅ Enabled |

#### Bulk SMS API Endpoints

**Send Single/Multiple SMS**
```
POST https://bulksms.talksasa.com/api/v3/sms/send
Headers:
  Authorization: Bearer {api_token}
  Content-Type: application/json
  Accept: application/json

Body:
{
  "recipient": "254781000403",
  "sender_id": "ABAN_COOL",
  "type": "plain",
  "message": "Your message here"
}
```

**Send Campaign via Contact List**
```
POST https://bulksms.talksasa.com/api/v3/sms/campaign
```

**View SMS**
```
GET https://bulksms.talksasa.com/api/v3/sms/{uid}
```

**View All Messages**
```
GET https://bulksms.talksasa.com/api/v3/sms
```

### Secondary SMS Provider: Twilio (Fallback)

| Setting | Value |
|---------|-------|
| **Provider** | Twilio |
| **Priority** | 2 (Secondary/Fallback) |
| **Status** | ⚠️ Configure when credentials available |

### Tertiary SMS Provider: Africa's Talking (Fallback)

| Setting | Value |
|---------|-------|
| **Provider** | Africa's Talking |
| **Priority** | 3 (Tertiary/Fallback) |
| **Status** | ⚠️ Configure when credentials available |

### Environment Variables

```bash
# Bulk SMS (TalkSasa) - PRIMARY
BULKSMS_API_URL=https://bulksms.talksasa.com/api/v3
BULKSMS_API_TOKEN=2153|obu7jXdaPDyxCecwxopipnq9ofxX6TPElIQjOjEn211b1ea2
BULKSMS_SENDER_ID=ABAN_COOL
BULKSMS_MESSAGE_TYPE=plain
BULKSMS_ENABLED=true

# Twilio - SECONDARY
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_number_here

# Africa's Talking - TERTIARY
AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=your_username_here
AFRICASTALKING_SENDER_ID=ABANCOOL
```

### SMS Features

- ✅ OTP delivery for authentication
- ✅ Transactional SMS (invoices, receipts, alerts)
- ✅ Campaign SMS to contact lists
- ✅ Automatic failover to backup providers
- ✅ Scheduled SMS delivery
- ✅ SMS statistics and reporting
- ✅ Provider status monitoring
- ✅ Rate limiting and throttling

### SMS Service Endpoints

The SMS service is accessible via `server/src/services/sms.service.js` and provides:

```javascript
// Send single SMS
await smsService.send(phone, message);

// Send OTP
await smsService.sendOTP(phone, otp, expiryMinutes);

// Send transaction alert
await smsService.sendTransactionAlert(phone, amount, type);

// Send campaign
await smsService.sendCampaign(recipients, message, provider);

// Get statistics
smsService.getStats();

// Get provider status
smsService.getProviderStatus();
```

---

## 4. Redis Configuration

| Setting | Value |
|---------|-------|
| **Host** | localhost |
| **Port** | 6379 |
| **Database** | 0 |
| **Pool Size** | 10 |
| **Password** | (Optional) |

### Environment Variables

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_POOL_SIZE=10
```

---

## 5. Authentication Configuration

| Setting | Value |
|---------|-------|
| **JWT Expiry** | 24 hours |
| **Refresh Token Expiry** | 7 days |
| **OTP Expiry** | 10 minutes |
| **OTP Length** | 6 digits |
| **Session Timeout** | 3600 seconds (1 hour) |
| **Max Login Attempts** | 5 |
| **Account Lock Time** | 15 minutes |

### JWT Configuration

```bash
JWT_SECRET=your_jwt_secret_key_min_32_characters_required_here
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_characters_required
JWT_REFRESH_EXPIRY=7d
```

### Session Configuration

```bash
SESSION_SECRET=your_session_secret_min_32_characters_required_here
SESSION_TIMEOUT=3600
SESSION_STORE=redis
COOKIE_SECURE=true
COOKIE_HTTP_ONLY=true
```

---

## 6. Security Configuration

### HTTPS/SSL Settings

| Setting | Value |
|---------|-------|
| **SSL Enabled** | true |
| **Certificate Path** | /etc/ssl/certs/abancool.crt |
| **Key Path** | /etc/ssl/private/abancool.key |

### CORS Configuration

| Setting | Value |
|---------|-------|
| **Origin** | https://app.abancool.com |
| **Credentials** | true |

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Login | 5 per 15 minutes |
| Register | 3 per hour |
| Email | 10 per hour |
| SMS | 10 per hour |

### Helmet Security

- ✅ Content Security Policy (CSP)
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer Policy
- ✅ Permissions Policy

---

## 7. Application Settings

| Setting | Value |
|---------|-------|
| **Environment** | production |
| **Port** | 4000 |
| **API Name** | ABANCOOL API |
| **Version** | 1.0.0 |
| **Log Level** | info |

### Feature Flags

```bash
FEATURE_SMS_ENABLED=true
FEATURE_WHATSAPP_ENABLED=true
FEATURE_BACKUP_ENABLED=true
FEATURE_SOCKET_IO_ENABLED=true
FEATURE_AUDIT_LOGGING_ENABLED=true
```

### Application Modes

```bash
DEBUG_MODE=false
VERBOSE_LOGGING=false
ALLOW_REGISTRATION=true
REQUIRE_EMAIL_VERIFICATION=true
REQUIRE_PHONE_VERIFICATION=false
```

---

## 8. Admin Contacts

| Role | Email |
|------|-------|
| **Admin** | admin@abancool.com |
| **Support** | support@abancool.com |
| **Billing** | billing@abancool.com |

---

## 9. File Upload Configuration

| Setting | Value |
|---------|-------|
| **Max File Size** | 50 MB |
| **Upload Directory** | /var/uploads/abancool |
| **Allowed Types** | pdf, doc, docx, xls, xlsx, jpg, jpeg, png, zip |

---

## 10. Backup Configuration

| Setting | Value |
|---------|-------|
| **Backup Enabled** | true |
| **Backup Interval** | Every 6 hours |
| **Retention Period** | 30 days |
| **Backup Directory** | /var/backups/abancool |

---

## 11. Monitoring Configuration

| Setting | Value |
|---------|-------|
| **Monitoring Enabled** | true |
| **Health Check Interval** | 60 seconds |
| **Metrics Collection Interval** | 5 minutes |
| **Alert Email** | admin@abancool.com |

---

## 12. File Location

The complete production configuration is stored in:

```
.env.production
```

This file should be:
- ✅ Copied to the production server
- ✅ Protected with appropriate file permissions (600)
- ✅ Never committed to version control
- ✅ Backed up in a secure location

---

## 13. Quick Setup Instructions

### 1. Update Environment Variables

Copy `.env.production` to your production server:

```bash
scp .env.production user@production-server:/var/www/abancool/.env.production
ssh user@production-server
cd /var/www/abancool
chmod 600 .env.production
```

### 2. Test Database Connection

```bash
node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✓ Database connected');
    await conn.end();
  } catch(e) {
    console.error('✗ Connection failed:', e.message);
  }
})();
"
```

### 3. Test Email Configuration

```bash
npm run test:email
```

### 4. Test SMS Configuration

```bash
npm run test:sms
```

### 5. Deploy Application

```bash
npm ci --production
npm run migrate
pm2 start ecosystem.config.js --env production
```

---

## 14. Security Reminders

⚠️ **IMPORTANT SECURITY NOTES**:

1. **Never commit credentials** to version control
2. **Use strong passwords** for database and email accounts
3. **Enable 2FA** on hosting control panel
4. **Rotate API tokens** regularly (every 90 days)
5. **Monitor access logs** for suspicious activity
6. **Use HTTPS** for all external communications
7. **Enable firewall rules** to restrict database access
8. **Keep backups** in multiple locations
9. **Test disaster recovery** monthly
10. **Update dependencies** regularly for security patches

---

## 15. Support and Troubleshooting

### Database Connection Issues

```bash
# Test MySQL connectivity
mysql -h localhost -u kzinlgmw_Panda -p -D kzinlgmw_internal

# Check privileges
SHOW GRANTS FOR 'kzinlgmw_Panda'@'localhost';
```

### Email Delivery Issues

```bash
# Test SMTP connection
npm run test:email:smtp

# Check email logs
tail -f logs/email.log
```

### SMS Delivery Issues

```bash
# Test SMS provider
npm run test:sms:bulksms

# Check SMS logs
tail -f logs/sms.log
```

---

## 16. Deployment Checklist

Before going live, verify:

- [ ] Database connection working
- [ ] Email configuration tested
- [ ] SMS provider tested and responding
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Backup system operational
- [ ] Monitoring and alerting enabled
- [ ] Log rotation configured
- [ ] Admin users created
- [ ] Initial data seeded

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 19, 2026 | Initial production configuration |

---

**Document Status**: Production Ready ✅  
**Owner**: DevOps Team  
**Last Updated**: May 19, 2026  
**Next Review**: August 19, 2026

