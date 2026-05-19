# Task 25: Deployment and DevOps Configuration - Complete Guide

## Overview

Task 25 provides production-ready deployment infrastructure with Docker, PM2, Nginx, CI/CD pipelines, and comprehensive DevOps tooling for ABANCOOL backend.

## Components Implemented

### 1. Environment Configuration (`.env.example`)

**File Size**: 300+ lines  
**Sections**: 15 major configuration categories

#### Configuration Categories

| Section | Purpose |
|---------|---------|
| APPLICATION | Node.js environment, ports, API config |
| DATABASE | MySQL connection, pooling, backups |
| AUTHENTICATION | JWT, OAuth, token management |
| EMAIL | SMTP configuration for Nodemailer |
| SMS | Africa's Talking, Twilio setup |
| PAYMENT GATEWAYS | Stripe, M-Pesa, IntaSend, Paystack |
| EXTERNAL SERVICES | AWS S3, Redis, caching |
| LOGGING & MONITORING | Sentry, DataDog, log levels |
| SECURITY | CORS, rate limiting, SSL certificates |
| BACKUP & RECOVERY | Database backups, replication |
| DEPLOYMENT | PM2, Docker, Kubernetes settings |
| FEATURE FLAGS | Enable/disable features |
| MAINTENANCE | Maintenance mode, updates |
| DEVELOPMENT ONLY | Debug, Swagger, test config |

#### Key Variables

**Database**:
```bash
DB_HOST=localhost
DB_USER=abancool_user
DB_PASSWORD=secure_password
DB_NAME=abancool_production
DB_POOL_MIN=5
DB_POOL_MAX=20
```

**Authentication**:
```bash
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_REFRESH_EXPIRY=7d
```

**Deployment**:
```bash
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.abancool.com
FRONTEND_URL=https://app.abancool.com
```

### 2. Docker Configuration

#### Dockerfile (Multi-stage)

**File Size**: 50+ lines  
**Stages**: 2 (builder, runtime)

**Stage 1: Builder**
- Node.js 18 Alpine
- Install build dependencies
- Install production dependencies
- Minimize image size

**Stage 2: Runtime**
- Node.js 18 Alpine (lean)
- Non-root user (nodejs:nodejs)
- Health checks included
- Proper signal handling (dumb-init)
- Log directory setup

**Features**:
- ✅ Multi-stage for minimal image size
- ✅ Security: non-root user
- ✅ Health checks every 30 seconds
- ✅ Graceful shutdown handling
- ✅ Optimized layers
- ✅ Production-ready

**Build Command**:
```bash
docker build -t abancool-api:latest .
```

**Run Command**:
```bash
docker run -p 4000:4000 \
  --env-file .env.production \
  --health-cmd='curl -f http://localhost:4000/api/health' \
  abancool-api:latest
```

#### docker-compose.yml

**Services**: 4 (MySQL, Redis, API, Nginx)

**MySQL Database**:
- Image: mysql:8.0
- Persistence: mysql_data volume
- Health checks
- Environment configuration
- Character set: utf8mb4

**Redis Cache**:
- Image: redis:7-alpine
- Persistence: redis_data volume
- Password protection
- Health checks
- Append-only persistence

**API Application**:
- Built from Dockerfile
- Depends on: MySQL, Redis
- Health checks
- Volume mounts for development
- Environment variables

**Nginx Reverse Proxy**:
- Image: nginx:alpine
- Ports: 80 (HTTP), 443 (HTTPS)
- SSL support
- Health checks
- Log files

**Volumes**:
- mysql_data: Database storage
- redis_data: Cache storage
- logs: Application logs
- ssl: SSL certificates

**Networks**:
- abancool_network: Bridge network for inter-service communication

**Usage**:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Remove volumes
docker-compose down -v
```

### 3. PM2 Ecosystem Configuration (`ecosystem.config.js`)

**File Size**: 150+ lines  
**Configuration**: Production-grade process management

#### Application Settings

**Process Management**:
- Name: `abancool-api`
- Script: `./server/src/index.js`
- Instances: `max` (all CPU cores)
- Mode: `cluster` (load balancing)
- Max memory: 512MB restart threshold

**Environment Variables**:
```javascript
env: {
  NODE_ENV: 'development',
  PORT: 4000
},
env_production: {
  NODE_ENV: 'production',
  PORT: 4000
}
```

**Logging**:
- Output: `./logs/pm2/out.log`
- Error: `./logs/pm2/error.log`
- Format: JSON with timestamps
- Merge logs from all instances

**Auto-restart**:
- Max restarts: 10
- Min uptime: 30 seconds
- Graceful shutdown: 5 seconds
- Cron restart: Daily at 2 AM

**Node Arguments**:
```javascript
node_args: '--max-old-space-size=4096'
```

#### Deployment Configuration

**Production Deploy**:
```javascript
deploy: {
  production: {
    user: 'deploy',
    host: 'api.abancool.com',
    key: '~/.ssh/deploy_key',
    ref: 'origin/main',
    repo: 'git@github.com:yourusername/abancool-nexus.git',
    path: '/var/www/abancool',
    'post-deploy': 'npm ci --production && npm run migrate && pm2 reload ecosystem.config.js --env production'
  }
}
```

**Usage**:
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs

# Reload (zero-downtime restart)
pm2 reload abancool-api

# Deploy
pm2 deploy ecosystem.config.js production setup
pm2 deploy ecosystem.config.js production update
```

### 4. Nginx Configuration (`nginx/nginx.conf`)

**File Size**: 300+ lines  
**Workers**: Auto-detected
**Optimization**: Production-grade

#### Performance Settings

**Worker Configuration**:
- Auto worker processes
- 4096 connections per worker
- epoll event processing
- 65535 file descriptor limit

**Compression**:
- Gzip enabled
- Min length: 1024 bytes
- Compression level: 6
- Types: text, CSS, JavaScript, JSON

**Caching**:
```nginx
proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zones=static_cache:100m max_size=5g inactive=30d;
```

#### Security Headers

**HTTPS Enforcement**:
- TLS 1.2, 1.3 only
- High-grade ciphers
- HSTS 1 year
- Stapling enabled

**Security Headers**:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

#### Rate Limiting

**Zones**:
- General API: 100 requests/minute
- Auth endpoints: 5 requests/minute
- Upload endpoints: 10 requests/minute

**Configuration**:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
location /api/ {
  limit_req zone=api_limit burst=10 nodelay;
}
```

#### Upstream Configuration

**Load Balancing**:
```nginx
upstream api_backend {
  least_conn;
  server api:4000 max_fails=3 fail_timeout=30s weight=1;
  keepalive 64;
}
```

**Proxy Settings**:
- HTTP/1.1 connection pooling
- Real IP and X-Forwarded headers
- 30-second timeouts
- Request ID tracking
- Buffering enabled

#### Location Blocks

**API Endpoints** (`/api/`):
- Rate limiting
- Caching disabled
- Request/response buffering
- Custom error pages

**Authentication** (`/api/auth/`):
- Stricter rate limiting (2 burst)
- Direct proxying

**Uploads** (`/api/files/upload`):
- No buffering for large files
- Upload rate limiting

**Static Assets**:
- 30-day cache
- Gzip compression
- Cache status header

**Health Check** (`/api/health`):
- No logging
- Direct proxying
- Used for load balancer checks

**Blocked Locations**:
- Hidden files (`.*`)
- Sensitive paths

#### Error Handling

**Error Pages**:
- 50x errors: JSON response
- Consistent format
- Proper content type

### 5. GitHub Actions CI/CD Pipeline

**File Size**: 300+ lines  
**Jobs**: 5 (test, build, deploy-staging, deploy-production, security)

#### Job 1: Test

**Services**:
- MySQL 8.0 (database)
- Redis 7 (cache)

**Steps**:
1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Run linter
5. Run tests with coverage
6. Upload to Codecov

**Triggers**: Push to main/master, pull requests

#### Job 2: Build

**Prerequisites**: Test job must pass

**Steps**:
1. Checkout code
2. Setup Docker Buildx
3. Login to registry
4. Extract metadata
5. Build and push Docker image

**Registry**: GitHub Container Registry  
**Caching**: GitHub Actions cache

#### Job 3: Deploy to Staging

**Triggers**: Pull requests only

**Deployment**:
- Pull latest from `develop` branch
- Install production dependencies
- Run staging migrations
- Reload with PM2

**Environment**: Staging

#### Job 4: Deploy to Production

**Triggers**: Push to main branch only

**Environment**: Production (approval required)

**Steps**:
1. Deploy application
2. Health checks (30s wait, 10 retries)
3. Slack notification
4. Failure alert

**Health Check**:
```bash
curl -f https://api.abancool.com/api/health
```

#### Job 5: Security Scanning

**Tools**:
- Snyk (vulnerability scanning)
- OWASP Dependency Check

**Steps**:
1. Checkout code
2. Run Snyk security scan
3. Run dependency check

### 6. Deployment Scripts (`scripts/deploy.sh`)

**File Size**: 300+ lines  
**Features**: Automated deployment with rollback

#### Functions

**backup_current()**:
- Database dump
- Application tar.gz
- Timestamped backups

**pull_code()**:
- Git fetch and merge
- Branch selection (main/develop)

**install_dependencies()**:
- npm ci --production

**run_migrations()**:
- Database schema updates
- Environment-specific

**build_assets()**:
- Optional asset compilation

**restart_service()**:
- PM2 reload
- 10-second wait

**health_check()**:
- 10 retry attempts
- 5-second intervals
- Fails deployment if unhealthy

**rollback()**:
- Restore from backup
- Database restore
- Application restore
- Service restart

**cleanup_old_backups()**:
- Delete backups older than 30 days

#### Usage

**Deploy**:
```bash
./scripts/deploy.sh deploy
```

**Rollback**:
```bash
./scripts/deploy.sh rollback 20240515_143022
```

**Health Check**:
```bash
./scripts/deploy.sh health-check
```

**Manual Backup**:
```bash
./scripts/deploy.sh backup
```

## Deployment Architectures

### Architecture 1: Docker Compose (Single Server)

```
┌─────────────────────────────────────┐
│      Docker Host (Single Server)    │
├─────────────────────────────────────┤
│  Nginx (Reverse Proxy, Load Bal)    │
│    ├─ HTTP/HTTPS Termination       │
│    ├─ Rate Limiting                 │
│    └─ SSL/TLS                       │
├─────────────────────────────────────┤
│  API Container (Node.js)            │
│    ├─ Port 4000                     │
│    └─ Health Checks                 │
├─────────────────────────────────────┤
│  MySQL Container                    │
│    ├─ Port 3306                     │
│    └─ Data Volume                   │
├─────────────────────────────────────┤
│  Redis Container                    │
│    ├─ Port 6379                     │
│    └─ Cache Volume                  │
└─────────────────────────────────────┘
```

**Advantages**:
- Simple single-server setup
- All services in one place
- Easy management with docker-compose
- Development-to-production parity

**Limitations**:
- Single point of failure
- Vertical scaling only
- No multi-server deployment

### Architecture 2: PM2 + Nginx (VPS/Dedicated)

```
┌─────────────────────────────────────┐
│    VPS/Dedicated Server             │
├─────────────────────────────────────┤
│  Nginx (Port 80/443)                │
│    ├─ Reverse Proxy                 │
│    ├─ Load Balancer (if 2+ APIs)   │
│    └─ SSL/TLS                       │
├─────────────────────────────────────┤
│  PM2 Cluster (4 Processes)          │
│    ├─ Process 1 (Port 4000)         │
│    ├─ Process 2 (Port 4001)         │
│    ├─ Process 3 (Port 4002)         │
│    └─ Process 4 (Port 4003)         │
├─────────────────────────────────────┤
│  MySQL Server                       │
│    ├─ Local or Remote              │
│    └─ Backup Cron Jobs              │
├─────────────────────────────────────┤
│  Redis Server                       │
│    ├─ Caching                       │
│    └─ Session Storage               │
└─────────────────────────────────────┘
```

**Advantages**:
- Native process management
- Full server control
- CPU utilization optimal
- Cost-effective

**Setup**:
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Architecture 3: Kubernetes (Multi-server)

```
┌──────────────────────────────────────┐
│  Kubernetes Cluster                  │
├──────────────────────────────────────┤
│  Ingress (Nginx/Traefik)             │
│    ├─ SSL Termination                │
│    └─ Routing                        │
├──────────────────────────────────────┤
│  API Pods (3 replicas)               │
│    ├─ Pod 1 (Node 1)                 │
│    ├─ Pod 2 (Node 2)                 │
│    └─ Pod 3 (Node 3)                 │
├──────────────────────────────────────┤
│  MySQL StatefulSet                   │
│    ├─ Primary (Read/Write)           │
│    └─ Replica (Read)                 │
├──────────────────────────────────────┤
│  Redis StatefulSet                   │
│    └─ Cluster Mode                   │
└──────────────────────────────────────┘
```

**Requirements**:
- Kubernetes cluster (3+ nodes)
- Container registry
- Helm charts
- Persistent volumes

**Advantages**:
- High availability
- Auto-scaling
- Self-healing
- Multi-region ready

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code review approved
- [ ] Security scan passed
- [ ] Database migrations tested
- [ ] Backup created
- [ ] Deployment script tested
- [ ] Health check endpoint working
- [ ] SSL certificates valid
- [ ] Environment variables configured
- [ ] Rate limiting configured

### Deployment

- [ ] Execute deployment script
- [ ] Monitor logs during deployment
- [ ] Run health checks
- [ ] Verify API response
- [ ] Test key endpoints
- [ ] Check database status
- [ ] Verify Redis connection
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Notify team of deployment

### Post-Deployment

- [ ] Monitor for errors
- [ ] Check application logs
- [ ] Verify background jobs
- [ ] Test email/SMS functionality
- [ ] Verify payment integrations
- [ ] Check API performance
- [ ] Monitor server resources
- [ ] Run integration tests
- [ ] Document any issues
- [ ] Update deployment log

## Monitoring and Maintenance

### Daily Tasks

- [ ] Check error logs
- [ ] Monitor server resources
- [ ] Verify backups completed
- [ ] Check API response times

### Weekly Tasks

- [ ] Review security logs
- [ ] Check database size
- [ ] Verify SSL certificate expiry
- [ ] Run full test suite

### Monthly Tasks

- [ ] Security vulnerability scan
- [ ] Database optimization
- [ ] Backup restoration test
- [ ] Performance analysis

## Troubleshooting

### Common Issues

**API not responding**:
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs abancool-api

# Restart service
pm2 restart abancool-api
```

**Database connection error**:
```bash
# Check MySQL status
systemctl status mysql

# Check connection
mysql -u $DB_USER -p$DB_PASSWORD -h $DB_HOST -e "SELECT 1"
```

**High memory usage**:
```bash
# Check memory
free -h

# Restart PM2 processes
pm2 reload ecosystem.config.js

# Check for memory leaks
pm2 monit
```

**SSL certificate issues**:
```bash
# Check certificate
openssl x509 -in /etc/ssl/certs/abancool.crt -text -noout

# Verify key
openssl key -in /etc/ssl/private/abancool.key -check
```

## Completion Status

✅ **Task 25: Deployment and DevOps Configuration - COMPLETE**

**Deliverables**:
- ✅ 300+ line environment configuration
- ✅ Production-grade Dockerfile
- ✅ docker-compose.yml with 4 services
- ✅ PM2 ecosystem configuration
- ✅ 300+ line Nginx configuration
- ✅ GitHub Actions CI/CD pipeline
- ✅ 300+ line deployment script
- ✅ Complete deployment documentation

**Key Achievements**:
- Multi-stage Docker build
- Docker Compose full stack
- PM2 cluster mode setup
- Nginx reverse proxy with rate limiting
- CI/CD pipeline with tests, build, deploy
- Automated deployment with rollback
- Security scanning integration
- Production-grade monitoring
- Zero-downtime deployments
- Comprehensive health checks

**Next Steps**: Task 26 - Integration Testing and Quality Assurance

