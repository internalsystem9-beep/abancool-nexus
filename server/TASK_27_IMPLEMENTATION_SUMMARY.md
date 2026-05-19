# Task 27: Production Deployment - Complete Guide

## Overview

Task 27 provides complete production deployment infrastructure with pre-deployment validation, database setup, SSL/TLS configuration, monitoring setup, and comprehensive runbook for ABANCOOL backend.

**Status**: Production-Ready ✅  
**Last Updated**: May 2026  
**Deployment Instructions**: See PRODUCTION_RUNBOOK.md

## Components Implemented

### 1. Pre-Deployment Checklist Script (`scripts/pre-deployment-check.sh`)

**File Size**: 400+ lines  
**Purpose**: Comprehensive system validation before production deployment

#### Verification Categories

**System Requirements**:
- Node.js version check (≥ 16.0.0)
- npm installation verification
- MySQL client availability
- Redis client availability
- Git repository status
- Docker and Docker Compose (optional)

**Environment Configuration**:
- `.env.production` file existence
- All required environment variables configured
- No placeholder/default values

**Database Connectivity**:
- MySQL connection test
- Database existence verification
- Database user permissions

**Redis Connectivity**:
- Redis server reachability
- Redis authentication
- Connection pool status

**Dependencies**:
- `node_modules` directory exists
- `package.json` structure
- Security vulnerabilities scan (npm audit)

**SSL/TLS Certificates**:
- Certificate file existence
- Certificate validity period
- Certificate expiration warnings
- Key file permissions

**Application Code**:
- Main entry point exists (`server/src/index.js`)
- Linting validation (no syntax errors)
- End-to-end tests available
- Build configuration

**Process Management**:
- PM2 installation
- Ecosystem configuration
- Auto-restart configuration

**Nginx Configuration**:
- Configuration file presence
- Syntax validation
- SSL directives

**Backup Configuration**:
- Backup directory accessible
- Permissions correct
- Retention policy configured

**File Permissions**:
- Deploy scripts executable
- Rollback scripts executable
- Log directory writable

**Git Repository**:
- Repository initialized
- No uncommitted changes
- Remote configured

#### Execution

```bash
# Run pre-deployment checks
bash scripts/pre-deployment-check.sh

# Expected output: System is READY for production deployment
# Exit code: 0 (ready) or 1 (not ready)
```

### 2. Production Database Setup Script (`scripts/setup-production-db.sh`)

**File Size**: 300+ lines  
**Purpose**: Automated database initialization and configuration

#### Setup Steps

**Database Creation**:
- Create production database
- Set character encoding (utf8mb4)
- Configure collation (utf8mb4_unicode_ci)

**Migrations**:
- Execute all migration files in order
- Verify migration success
- Handle rollback on failure

**Indexes Creation**:
- User table indexes (email, role, status, created_at)
- Client table indexes (user_id, status, email, created_at)
- Project table indexes (client_id, user_id, status)
- Domain table indexes (client_id, domain_name, expiry_date)
- Hosting table indexes (client_id, domain_id, status)
- Invoice table indexes (client_id, status, due_date)
- Support ticket indexes (client_id, status, priority)
- Audit log indexes (user_id, resource_id, action, created_at)
- Session indexes (user_id, token, expires_at)

**Stored Procedures**:
- `sp_get_user_with_roles` - User with all roles
- `sp_get_client_invoices_summary` - Client financial summary

**User Permissions**:
- Grant all database privileges to app user
- Configure for both localhost and remote connections

**Data Seeding**:
- Insert default roles (super_admin, admin, support_agent, user)
- Insert default permissions (6 core permissions)
- Insert role-permission mappings
- Insert status definitions for all entities

**Database Optimization**:
- Run table optimization
- Update statistics
- Verify integrity

#### Execution

```bash
# Setup production database
bash scripts/setup-production-db.sh

# Expected actions:
# ✓ Database created
# ✓ Migrations applied
# ✓ Indexes created
# ✓ Procedures installed
# ✓ Initial data seeded
# ✓ Database optimized
```

### 3. SSL/TLS Setup Script (`scripts/setup-ssl.sh`)

**File Size**: 250+ lines  
**Purpose**: Automated SSL/TLS certificate installation and configuration

#### Certificate Options

**Option 1: Let's Encrypt**:
- Automatic certificate generation
- Multiple domain support
- Auto-renewal configuration
- Zero downtime renewal

**Option 2: Self-Signed**:
- For testing/staging environments
- Automatic generation
- Single domain support

#### Setup Process

**Certbot Installation**:
- Auto-detect package manager (apt/yum)
- Install Certbot and Nginx plugin
- Verify installation

**Certificate Installation**:
- Domain validation
- Certificate chain setup
- Key generation
- Copy to application directory

**Certificate Verification**:
- Validity period check
- Expiration warnings (< 30 days)
- Domain matching validation
- Certificate CN verification

**Auto-Renewal Setup**:
- Cron job configuration
- Renewal script creation
- Service restart automation
- Failed renewal alerts

**Nginx Configuration**:
- SSL protocol setup (TLSv1.2, TLSv1.3)
- Cipher configuration
- HSTS headers
- SSL stapling
- Session caching

**Permissions and Ownership**:
- Certificate: 644 permissions
- Key: 600 permissions
- Root ownership

**Service Restart**:
- Nginx reload
- API service restart
- Verification after restart

#### Execution

```bash
# Setup SSL/TLS certificates
sudo bash scripts/setup-ssl.sh api.abancool.com app.abancool.com

# Expected actions:
# ✓ Certbot verification
# ✓ Let's Encrypt certificate installed
# ✓ Auto-renewal configured
# ✓ Nginx SSL configured
# ✓ Services restarted
```

### 4. Monitoring Configuration (`server/monitoring.config.js`)

**File Size**: 500+ lines  
**Purpose**: Production monitoring and alerting setup

#### Monitoring Services

**Services Monitored**:
- API (port 4000, health check every 30s)
- MySQL database (60s interval)
- Redis cache (60s interval)
- Nginx reverse proxy (60s interval)

#### Alert Channels

**Email Alerts**:
- SMTP-based delivery
- Template support (critical, warning, info)
- Multiple recipient support
- Configurable via environment

**Slack Integration**:
- Direct webhook delivery
- Channel routing
- Mention support (@channel, @devops)
- Formatted messages

**PagerDuty Integration**:
- Critical incident creation
- On-call escalation
- Multi-severity support

**SMS Alerts**:
- Critical alerts only
- Twilio integration
- Multiple recipient support

#### Metrics and Thresholds

**API Metrics**:
- Response Time: Warning 500ms, Critical 1000ms
- Error Rate: Warning 1%, Critical 5%
- Requests/sec: Warning 1000, Critical 2000
- Uptime Target: 99.9%

**Database Metrics**:
- Connection Pool: Warning 80%, Critical 95%
- Query Time: Warning 200ms, Critical 500ms
- Replication Lag: Warning 10s, Critical 60s

**Redis Metrics**:
- Memory Usage: Warning 80%, Critical 95%
- Eviction Rate: Warning 1/s, Critical 10/s
- Cache Hit Rate: Warning 80%, Critical 60%

**System Metrics**:
- CPU Usage: Warning 75%, Critical 90%
- Memory Usage: Warning 80%, Critical 95%
- Disk Usage: Warning 80%, Critical 95%
- Network Bandwidth: Warning 80%, Critical 95%

#### Health Checks

**Endpoint Health Checks**:
- API Health (`/api/health`): 30s interval
- Database Health (`/api/health/db`): 60s interval
- Redis Health (`/api/health/redis`): 60s interval

**Command-Based Checks**:
- Node process count verification
- Nginx worker verification
- Service availability

#### Alert Rules

**10 Critical Alert Rules**:
1. High Response Time (> 1000ms)
2. High Error Rate (> 5%)
3. Database Connection Pool Exhausted
4. High Memory Usage (> 90%)
5. Critical Disk Space (> 95%)
6. API Down
7. Database Down
8. Redis Down
9. High CPU Usage (> 90%)
10. Low Cache Hit Rate (< 60%)

#### Uptime Monitoring

- SLA Tracking (99.9% target)
- Downtime tracking and alerts
- Incident documentation
- Monthly uptime reports

#### Logging Integration

**Log Destinations**:
- Console output
- File logging with rotation
- Error file logging
- Syslog support (optional)

**Log Levels**: 
- Production: info
- Debug: debug
- Errors: error

#### Third-Party Integrations

**Error Tracking**:
- Sentry DSN integration
- Exception capturing
- Trace sampling (10%)

**APM Services**:
- DataDog (optional)
- New Relic (optional)
- Prometheus (optional)
- Grafana dashboard support

### 5. Production Runbook (`PRODUCTION_RUNBOOK.md`)

**File Size**: 600+ lines  
**Purpose**: Complete deployment and operations guide

#### Pre-Deployment Preparation

**Infrastructure Requirements**:
- Minimum 2 vCPU, 4GB RAM
- 50GB application storage
- 100GB database storage
- 1Mbps network minimum
- OS: Ubuntu 20.04 LTS or CentOS 8+

**24-48 Hours Before**:
- [ ] Run pre-deployment checks
- [ ] Prepare database
- [ ] Install SSL certificates
- [ ] Configure environment variables
- [ ] Install dependencies
- [ ] Run test suite
- [ ] Backup current state

#### Deployment Phases

**Phase 1: Validation (30 minutes)**
- Pre-deployment checks
- Test suite verification
- Vulnerability scanning
- Configuration validation
- Database validation

**Phase 2: Backup (15 minutes)**
- Full database backup
- Application code backup
- System snapshot (if VMs)

**Phase 3: Service Deployment (10 minutes)**
- Pull latest code
- Install dependencies
- Run migrations
- Build assets
- Start services

**Phase 4: Nginx Configuration (5 minutes)**
- Test configuration
- Reload Nginx
- Verify service

**Phase 5: Health Verification (5 minutes)**
- API health check
- Database connectivity
- Redis connectivity
- Test authentication
- Smoke tests

#### Post-Deployment Verification

**Immediate (First Hour)**:
- [ ] Monitor error logs
- [ ] Check system resources
- [ ] Verify database connectivity
- [ ] Check SSL/TLS certificate
- [ ] Monitor API response times
- [ ] Verify rate limiting

**Short-term (24 Hours)**:
- [ ] Monitor critical endpoints
- [ ] Check error rates (< 1%)
- [ ] Verify response times (< 500ms)
- [ ] Monitor database performance
- [ ] Verify backup execution
- [ ] Test integrations

**Medium-term (1 Week)**:
- [ ] Performance baseline
- [ ] No critical alerts
- [ ] All integrations working
- [ ] Data consistency verified
- [ ] Security headers validated
- [ ] Uptime > 99.9%

#### Monitoring and Alerts

**Alert Channels**:
- Email to admin@abancool.com
- Slack #incidents channel
- SMS for critical (optional)
- PagerDuty escalation

**Key Metrics**:
- API Response Time: Warning 500ms, Critical 1000ms
- Error Rate: Warning 1%, Critical 5%
- CPU Usage: Warning 75%, Critical 90%
- Memory Usage: Warning 80%, Critical 95%
- Disk Usage: Warning 80%, Critical 95%

#### Troubleshooting Guide

**API Not Responding**:
1. Check PM2 status
2. Check logs for errors
3. Verify port 4000 availability
4. Test database connectivity
5. Restart service

**High Response Times**:
1. Check system load
2. Check database slow queries
3. Check Redis performance
4. Scale processes
5. Check network bandwidth

**Database Issues**:
1. Check MySQL status
2. Check connections
3. Check disk space
4. Verify replication

**SSL/TLS Issues**:
1. Check certificate validity
2. Verify certificate chain
3. Renew if near expiry

#### Rollback Procedures

**Emergency Rollback (< 5 minutes)**:
1. Stop services
2. Restore from backup
3. Verify service
4. Alert team

**Detailed Rollback**:
1. Create backup of current state
2. Stop services
3. Restore database
4. Restore application
5. Start services
6. Verify

**Partial Rollback**:
1. Identify failing service
2. Stop specific service
3. Restore service code
4. Restart service
5. Verify

#### SLA and Performance Targets

**Availability**:
- API Uptime: 99.9% (monthly)
- Database Availability: 99.95%
- RTO: 15 minutes
- RPO: 5 minutes

**Performance**:
- P95 Response Time: 300ms
- P99 Response Time: 500ms
- Error Rate: < 0.5%
- Throughput: 100 req/sec minimum

**Backup Strategy**:
- Frequency: Every 6 hours
- Retention: 30 days
- Type: Full daily, incremental hourly
- Test: Daily restoration test

#### Disaster Recovery

**Steps**:
1. Detection (0-5 min): Automated alerts
2. Assessment (5-15 min): Determine scope
3. Mitigation (15-45 min): Service recovery attempt
4. Recovery (45-90 min): Rollback/restore
5. Post-Incident (24-48 hours): RCA and prevention

#### Contact Information

**On-Call Schedule**:
- Primary: DevOps Lead
- Secondary: Backend Lead
- Tertiary: Tech Lead

**Escalation** (15-min intervals):
1. Level 1: Standard troubleshooting
2. Level 2: Secondary on-call
3. Level 3: Engineering Manager
4. Level 4: CTO

**Communication**:
- Internal: Slack #incidents
- External: status.abancool.com
- Stakeholders: Email + SMS

---

## Deployment Workflow Summary

```
1. Pre-Deployment Checks (30 min)
   ├─ Run pre-deployment-check.sh
   ├─ Verify all tests pass
   ├─ Check for vulnerabilities
   └─ Validate configuration

2. Database Setup (15 min)
   ├─ Run setup-production-db.sh
   ├─ Verify migrations
   ├─ Create indexes
   └─ Seed initial data

3. SSL/TLS Installation (10 min)
   ├─ Install certificates
   ├─ Configure auto-renewal
   ├─ Test HTTPS
   └─ Verify security

4. Service Deployment (20 min)
   ├─ Pull latest code
   ├─ Install dependencies
   ├─ Run migrations
   └─ Start PM2 processes

5. Monitoring Setup (10 min)
   ├─ Configure alert channels
   ├─ Set metric thresholds
   ├─ Test alerts
   └─ Start monitoring

6. Post-Deployment Verification (15 min)
   ├─ Health check endpoints
   ├─ Test critical flows
   ├─ Monitor logs
   └─ Alert team

Total Estimated Time: 100 minutes (~1.5 hours)
```

## Deployment Checklist

### Before Deployment

- [ ] All pre-deployment checks pass
- [ ] Database backup created
- [ ] SSL certificates valid
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Tests passing (coverage > 70%)
- [ ] No high-severity vulnerabilities
- [ ] Code review approved
- [ ] Team notification sent
- [ ] Maintenance window confirmed

### During Deployment

- [ ] Backup created before changes
- [ ] Database setup successful
- [ ] SSL/TLS configured
- [ ] Services started
- [ ] Health checks passing
- [ ] Performance baseline OK
- [ ] Error rate < 1%
- [ ] Response times < 500ms

### After Deployment

- [ ] Monitoring active
- [ ] Alerts configured
- [ ] Team notified of completion
- [ ] Runbook reviewed
- [ ] On-call schedule confirmed
- [ ] SLA targets met
- [ ] Documentation updated

## Verification Tests

```bash
# Health check
curl https://api.abancool.com/api/health

# Database connectivity
curl https://api.abancool.com/api/health/db

# Redis connectivity
curl https://api.abancool.com/api/health/redis

# Authentication
curl -X POST https://api.abancool.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Critical endpoints
bash tests/smoke-tests.sh
```

## Performance Baselines

| Metric | Target | Alert | Critical |
|--------|--------|-------|----------|
| Response Time (P95) | 300ms | 500ms | 1000ms |
| Error Rate | 0.5% | 1% | 5% |
| CPU Usage | 50% | 75% | 90% |
| Memory Usage | 60% | 80% | 95% |
| Disk Usage | 60% | 80% | 95% |
| Uptime | 99.9% | 99.5% | 99% |

## Key Files and Directories

```
/var/www/abancool/           # Application
/var/log/abancool/           # Logs
/var/backups/abancool/       # Backups
/etc/ssl/certs/              # SSL certs
/etc/nginx/conf.d/           # Nginx config
~/.pm2/                       # PM2 config
```

## Completion Status

✅ **Task 27: Production Deployment - COMPLETE**

**Deliverables**:
- ✅ Pre-deployment checklist script (400+ lines)
- ✅ Database setup automation (300+ lines)
- ✅ SSL/TLS installation script (250+ lines)
- ✅ Monitoring configuration (500+ lines)
- ✅ Production runbook (600+ lines)
- ✅ Complete deployment documentation

**Key Achievements**:
- Automated pre-deployment validation
- Comprehensive database setup with migrations
- SSL/TLS certificate automation
- Complete monitoring and alerting infrastructure
- Detailed runbook for deployment and operations
- Rollback procedures and disaster recovery
- SLA and performance tracking
- 24/7 on-call procedures
- Clear troubleshooting guides

**Coverage**:
- ✅ System requirements validation
- ✅ Database connectivity checks
- ✅ SSL/TLS setup and renewal
- ✅ Service deployment automation
- ✅ Health verification
- ✅ Monitoring and alerting
- ✅ Performance tracking
- ✅ Incident response
- ✅ Rollback procedures
- ✅ Operations runbook

**Final Status**: 🎉 **ALL 27 TASKS COMPLETE** 🎉

---

## What's Next

### Post-Deployment (First Week)
- Monitor production metrics
- Respond to any alerts
- Gather performance data
- Collect user feedback
- Document any issues

### Short-term (1-3 Months)
- Performance optimization
- Feature enhancements
- Security audits
- SLA validation
- Capacity planning

### Long-term (3-12 Months)
- Scaling strategies
- High availability setup
- Multi-region deployment
- Disaster recovery drills
- Major version upgrades

---

**Document Status**: Production-Ready v1.0  
**Last Updated**: May 2026  
**Owner**: DevOps Team  
**Classification**: Internal

