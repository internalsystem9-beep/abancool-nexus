# ABANCOOL Production Deployment Runbook

## Executive Summary

This comprehensive runbook covers all aspects of deploying the ABANCOOL backend API to production, including pre-deployment checks, deployment procedures, monitoring setup, and rollback procedures.

**Status**: Production-Ready v1.0  
**Last Updated**: May 2026  
**Next Review**: August 2026

---

## Table of Contents

1. [Pre-Deployment Preparation](#pre-deployment-preparation)
2. [Deployment Process](#deployment-process)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Troubleshooting](#troubleshooting)
6. [Rollback Procedures](#rollback-procedures)
7. [SLA and Performance Targets](#sla-and-performance-targets)

---

## Pre-Deployment Preparation

### 1. Environment Setup (24-48 hours before)

#### Infrastructure Requirements

- **Compute**: Minimum 2 vCPU, 4GB RAM for base installation
- **Storage**: 50GB for application + 100GB for database
- **Network**: 1Mbps dedicated connection minimum
- **OS**: Ubuntu 20.04 LTS or CentOS 8+

#### Pre-Deployment Checklist

```bash
# Run comprehensive pre-deployment checks
bash scripts/pre-deployment-check.sh

# Expected output:
# ✓ System is READY for production deployment
```

### 2. Database Preparation

#### Create Production Database

```bash
# Run database setup with automated migrations
bash scripts/setup-production-db.sh

# Expected actions:
# ✓ Database created
# ✓ All migrations applied
# ✓ Indexes created
# ✓ Initial data seeded
# ✓ Permissions configured
```

### 3. SSL/TLS Certificate Installation

#### Install Certificates

```bash
# Setup Let's Encrypt or self-signed certificates
sudo bash scripts/setup-ssl.sh api.abancool.com app.abancool.com

# Expected actions:
# ✓ Certificate installed
# ✓ Certificate verified
# ✓ Auto-renewal configured
# ✓ Nginx configured for SSL
```

### 4. Environment Variables

#### Configure Production Environment

```bash
# Copy and edit environment file
cp .env.example .env.production
nano .env.production

# Required variables:
NODE_ENV=production
PORT=4000
DB_HOST=localhost
DB_USER=abancool_user
DB_PASSWORD=<STRONG_PASSWORD>
DB_NAME=abancool_production
JWT_SECRET=<RANDOM_32_CHAR_STRING>
REDIS_HOST=localhost
REDIS_PASSWORD=<STRONG_PASSWORD>
SMTP_HOST=smtp.gmail.com
SMTP_USER=<EMAIL>
SMTP_PASSWORD=<APP_PASSWORD>
```

### 5. Dependencies Installation

```bash
# Install production dependencies
npm ci --production

# Verify installation
node -e "require('./server/src/index.js')" --version
```

---

## Deployment Process

### Phase 1: Pre-Deployment Validation (30 minutes)

```bash
# 1. Run final checks
bash scripts/pre-deployment-check.sh

# 2. Verify all tests pass
npm test -- --coverage

# 3. Check for vulnerabilities
npm audit --audit-level=moderate

# 4. Validate configuration
node -c "require('./.env.production')"

# 5. Database validation
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT COUNT(*) FROM users;"
```

### Phase 2: Backup and Snapshot (15 minutes)

```bash
# 1. Full database backup
bash scripts/deploy.sh backup

# 2. Application code backup
tar -czf ./backups/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=logs \
  ./

# 3. Take system snapshot (if using VMs)
# Contact infrastructure team for snapshot
```

### Phase 3: Service Deployment (10 minutes)

```bash
# 1. Pull latest code
cd /var/www/abancool
git pull origin main

# 2. Install dependencies
npm ci --production

# 3. Run database migrations
npm run migrate

# 4. Build assets (if applicable)
npm run build

# 5. Start services with PM2
pm2 start ecosystem.config.js --env production

# 6. Verify processes running
pm2 status
pm2 logs abancool-api --lines 20
```

### Phase 4: Nginx Configuration (5 minutes)

```bash
# 1. Test Nginx config
sudo nginx -t

# 2. Reload Nginx
sudo systemctl reload nginx

# 3. Verify Nginx running
sudo systemctl status nginx
```

### Phase 5: Health Verification (5 minutes)

```bash
# 1. Check API health
curl https://api.abancool.com/api/health

# 2. Verify database connectivity
curl https://api.abancool.com/api/health/db

# 3. Verify Redis connectivity
curl https://api.abancool.com/api/health/redis

# 4. Test authentication
curl -X POST https://api.abancool.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# 5. Test critical endpoints
bash tests/smoke-tests.sh
```

---

## Post-Deployment Verification

### Immediate (First Hour)

- [ ] Monitor error logs: `pm2 logs abancool-api`
- [ ] Check system resources: `htop`, `free -h`
- [ ] Verify database connectivity
- [ ] Verify Redis connectivity
- [ ] Check SSL/TLS certificate
- [ ] Monitor API response times
- [ ] Verify rate limiting working

### Short-term (First 24 hours)

- [ ] Monitor all critical endpoints
- [ ] Check error rates < 1%
- [ ] Verify response times < 500ms
- [ ] Monitor database performance
- [ ] Monitor backup job execution
- [ ] Verify email notifications working
- [ ] Test payment gateway webhooks

### Medium-term (First Week)

- [ ] Performance baseline established
- [ ] No critical alerts triggered
- [ ] All integrations functioning
- [ ] Data consistency verified
- [ ] Security headers validated
- [ ] Rate limiting effective
- [ ] Uptime > 99.9%

---

## Monitoring and Alerting

### Enable Monitoring Services

```bash
# 1. Start monitoring service
pm2 start monitoring.config.js --name "abancool-monitor"

# 2. Verify monitoring active
pm2 status

# 3. Check monitoring logs
pm2 logs abancool-monitor --lines 50
```

### Configure Alert Channels

```bash
# Email alerts
export ALERT_EMAIL_ENABLED=true
export ALERT_EMAIL_RECIPIENTS=admin@abancool.com

# Slack alerts
export ALERT_SLACK_ENABLED=true
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# SMS alerts (critical only)
export ALERT_SMS_ENABLED=true
export ALERT_SMS_RECIPIENTS=+254712345678
```

### Key Metrics to Monitor

| Metric | Warning | Critical |
|--------|---------|----------|
| API Response Time | 500ms | 1000ms |
| Error Rate | 1% | 5% |
| CPU Usage | 75% | 90% |
| Memory Usage | 80% | 95% |
| Disk Usage | 80% | 95% |
| Database Connections | 80% | 95% |
| Redis Memory | 80% | 95% |

---

## Troubleshooting

### API Not Responding

```bash
# 1. Check process status
pm2 status

# 2. Check logs
pm2 logs abancool-api --lines 100

# 3. Check port availability
lsof -i :4000

# 4. Check database connectivity
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD -e "SELECT 1"

# 5. Restart service
pm2 restart abancool-api
```

### High Response Times

```bash
# 1. Check system load
htop

# 2. Check database slow queries
mysql -e "SELECT query_time, sql_text FROM mysql.slow_log LIMIT 10"

# 3. Check Redis
redis-cli INFO stats

# 4. Increase process instances
pm2 scale abancool-api +2
```

### Database Issues

```bash
# 1. Check database status
systemctl status mysql

# 2. Check connections
mysql -e "SHOW PROCESSLIST"

# 3. Check disk space
df -h

# 4. Verify replication (if applicable)
mysql -e "SHOW SLAVE STATUS\G"
```

### SSL/TLS Issues

```bash
# 1. Check certificate
openssl x509 -in /etc/ssl/certs/abancool.crt -text -noout

# 2. Check certificate chain
openssl s_client -connect api.abancool.com:443

# 3. Renew if needed
sudo certbot renew
```

---

## Rollback Procedures

### Emergency Rollback (< 5 minutes)

```bash
# 1. Stop current services
pm2 stop abancool-api

# 2. Rollback to previous version
bash scripts/rollback.sh <TIMESTAMP>

# 3. Verify rollback
curl https://api.abancool.com/api/health

# 4. Alert team
# Send notification to #deployments channel
```

### Detailed Rollback Steps

```bash
# 1. Identify backup timestamp
ls -la /var/backups/abancool/

# 2. Create new backup of current state (for analysis)
bash scripts/deploy.sh backup

# 3. Stop services
pm2 stop ecosystem.config.js --env production

# 4. Restore database
mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < /var/backups/abancool/db_backup_YYYYMMDD_HHMMSS.sql

# 5. Restore application
rm -rf /var/www/abancool
tar -xzf /var/backups/abancool/app_backup_YYYYMMDD_HHMMSS.tar.gz \
  -C /var/www/

# 6. Install dependencies
cd /var/www/abancool
npm ci --production

# 7. Start services
pm2 start ecosystem.config.js --env production

# 8. Verify
curl https://api.abancool.com/api/health
```

### Partial Rollback (Specific Service)

```bash
# 1. Identify failing service
pm2 logs abancool-api

# 2. Stop only that service
pm2 stop abancool-api

# 3. Restore only that service code
git reset --hard HEAD~1

# 4. Install dependencies
npm ci --production

# 5. Start service
pm2 start ecosystem.config.js --name abancool-api --env production

# 6. Verify
curl https://api.abancool.com/api/health
```

---

## SLA and Performance Targets

### Availability SLA

- **API Uptime**: 99.9% (calculated monthly)
- **Database Availability**: 99.95%
- **RTO (Recovery Time Objective)**: 15 minutes
- **RPO (Recovery Point Objective)**: 5 minutes

### Performance Targets

| Metric | Target | Threshold |
|--------|--------|-----------|
| P95 Response Time | 300ms | 500ms |
| P99 Response Time | 500ms | 1000ms |
| Error Rate | < 0.5% | < 1% |
| Throughput | 100 req/sec | 50 req/sec minimum |
| Database Query Time | < 200ms | < 500ms |

### Backup Strategy

- **Frequency**: Every 6 hours (4x daily)
- **Retention**: 30 days
- **Type**: Full backups daily, incremental hourly
- **Verification**: Daily restoration test
- **Storage**: Primary + offsite redundant

### Disaster Recovery Plan

**Step 1: Detection (0-5 minutes)**
- Automated monitoring alerts
- Incident assigned to on-call engineer

**Step 2: Assessment (5-15 minutes)**
- Determine scope and severity
- Activate incident response team

**Step 3: Mitigation (15-45 minutes)**
- Attempt service recovery
- If unsuccessful, proceed to rollback

**Step 4: Recovery (45-90 minutes)**
- Execute rollback procedures
- Restore from backup if necessary
- Verify full functionality

**Step 5: Post-Incident (24-48 hours)**
- Root cause analysis
- Implement preventive measures
- Document lessons learned

---

## Contact and Escalation

### On-Call Schedule

- **Primary**: DevOps Lead
- **Secondary**: Backend Lead
- **Tertiary**: Tech Lead

### Escalation Path

1. **Level 1** (15 min): Try standard troubleshooting
2. **Level 2** (30 min): Engage secondary on-call
3. **Level 3** (45 min): Engage engineering manager
4. **Level 4** (60 min): Engage CTO

### Communication Channels

- **Internal**: Slack #incidents
- **External**: status.abancool.com
- **Stakeholders**: Email + SMS alerts

---

## Appendix

### Useful Commands

```bash
# View running processes
pm2 status

# View real-time logs
pm2 logs abancool-api -f

# Check system resources
htop

# Check disk usage
du -sh /var/www/abancool
df -h

# Check database size
mysql -e "SELECT table_schema, ROUND(SUM(data_length+index_length)/1024/1024) AS size_mb FROM information_schema.tables GROUP BY table_schema;"

# Check network connections
netstat -tlnp

# Monitor traffic
iftop
```

### Important Files and Directories

```
/var/www/abancool/           # Application root
/var/log/abancool/           # Application logs
/var/backups/abancool/       # Backups
/etc/ssl/certs/              # SSL certificates
/etc/nginx/conf.d/           # Nginx configuration
~/.pm2/                       # PM2 configuration
```

### Maintenance Windows

- **Preferred Time**: Sundays 2:00 AM - 4:00 AM UTC
- **Frequency**: Monthly
- **Duration**: Maximum 30 minutes
- **Notification**: 7 days advance notice

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial production deployment runbook |

---

**Document Classification**: Internal  
**Owner**: DevOps Team  
**Last Reviewed**: May 2026  
**Next Review**: August 2026

