# Production Deployment Guide - ABANCOOL

**Server**: 109.199.113.40 (cPanel Shared Hosting)  
**Username**: kzinlgmw  
**cPanel URL**: https://abancool.com:2083/

## Current Status

✓ Production configuration verified (90.5% test pass rate)  
✓ Email and SMS integrations working  
✓ Database credentials configured  
✗ SSH access: Not available on shared hosting

## Deployment Options

### Option 1: Via cPanel File Manager (Recommended for Shared Hosting)
1. Log in to cPanel: https://abancool.com:2083/
2. Use **File Manager** to navigate to your public_html or app directory
3. Upload your application files
4. Create .env.production with your credentials
5. Run npm install via terminal (if available) or use cPanel's terminal feature

### Option 2: Via SFTP
Since SSH is disabled, SFTP might be available:
- **Host**: 109.199.113.40
- **Port**: 22 (or check cPanel settings)
- **Username**: kzinlgmw
- **Authentication**: SSH key or password
- **Tools**: WinSCP, FileZilla, or VS Code's Remote Explorer

Steps:
```
1. Connect via SFTP
2. Navigate to /home/kzinlgmw/public_html/ or your app directory
3. Upload: server/ and all configuration files
4. Create .env.production with production settings
```

### Option 3: Via Git (If Available)
If your hosting supports Git:
```bash
git clone <your-repo> /home/kzinlgmw/your-app
cd /home/kzinlgmw/your-app
npm install
```

### Option 4: Contact Hosting Provider
Ask your hosting provider:
- "Can you enable SSH access for my account?"
- "What's the correct SSH port for my account?"
- "Do you support Node.js applications?"
- "Can I use a custom port for my application?"

## Files to Deploy

Essential files for production:
```
server/
├── src/
│   ├── index.js          (Main entry point)
│   ├── routes.js
│   ├── config/           (Database config)
│   ├── controllers/      (Route handlers)
│   ├── middleware/       (Auth, RBAC, errors)
│   ├── services/         (SMS, email, etc.)
│   └── migrations/       (Database migrations)
├── package.json
└── ecosystem.config.js

.env.production          (Credentials - create locally, don't upload)
```

## Deployment Checklist

### Before Upload:
- [ ] Review .env.production (database, email, SMS credentials)
- [ ] Run production tests: `node test-production-config.cjs`
- [ ] Verify npm dependencies: `npm install`
- [ ] Check file permissions

### Upload Process:
- [ ] Create app directory in cPanel (e.g., /apps/abancool)
- [ ] Upload server files
- [ ] Upload .env.production
- [ ] Upload package.json

### Post-Upload:
- [ ] Run `npm install` on server
- [ ] Run database migrations
- [ ] Start application with PM2 or Node.js
- [ ] Test health endpoint
- [ ] Monitor logs

## Next Steps

**Please choose your preferred deployment method**:
1. **Provide cPanel credentials** - I can guide you through cPanel File Manager
2. **Provide SFTP details** - I can help with SFTP setup
3. **Check with hosting provider** - Get SSH port or alternative access method
4. **Test locally first** - We can run the full stack locally before deploying

## Important Notes

⚠️ **Security**:
- Never commit .env.production to git
- Change SSH key passphrase
- Use strong database passwords
- Enable HTTPS/SSL on cPanel

📋 **Production Requirements**:
- Node.js 18+ on server
- MySQL 8.0
- Redis (optional, for caching)
- Process manager (PM2 or similar)
- Reverse proxy (Nginx or Apache)

## Support Info

**Database**: kzinlgmw_internal / kzinlgmw_Panda  
**Email**: SMTP to mail.abancool.com:465  
**SMS**: Bulk SMS API configured and tested  
**Status**: 90.5% of integrations verified working

What would you like to do next?
