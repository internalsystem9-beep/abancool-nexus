# Authentication System Guide

## Overview

The ABANCOOL Command Center authentication system provides enterprise-grade security with multiple authentication methods:

1. **Email/Password Login** - Traditional username/password authentication
2. **OTP (One-Time Password)** - Email-based OTP for additional security
3. **TOTP 2FA** - Time-based One-Time Password using authenticator apps
4. **Session Management** - Device tracking and session invalidation
5. **Password Reset** - Secure password recovery flow

## Authentication Flows

### 1. Basic Email/Password Login

```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "success": true,
  "user": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "sessionId": 123
}
```

### 2. OTP-Based Login (Recommended)

**Step 1: Initiate Login**
```
POST /api/auth/login-init
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
{
  "success": true,
  "otpRequired": true,
  "email": "user@example.com",
  "expiresAt": "2024-01-15T10:30:00Z",
  "ttlSeconds": 600
}
```

**Step 2: Verify OTP**
```
POST /api/auth/verify-otp
{
  "email": "user@example.com",
  "code": "123456"
}

Response:
{
  "success": true,
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "sessionId": 123
}
```

### 3. TOTP 2FA Setup

**Step 1: Request 2FA Setup**
```
GET /api/auth/2fa/setup
Authorization: Bearer <token>

Response:
{
  "success": true,
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "qrCode": "data:image/png;base64,...",
  "backupCodes": [
    "ABC12345",
    "DEF67890",
    ...
  ]
}
```

**Step 2: Verify Setup**
```
POST /api/auth/2fa/verify-setup
Authorization: Bearer <token>
{
  "token": "123456",
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "backupCodes": [...]
}

Response:
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

### 4. TOTP 2FA Login

**Step 1: Login with Email/Password**
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response (if 2FA enabled):
{
  "success": true,
  "requiresTwoFactor": true,
  "userId": 1,
  "email": "user@example.com"
}
```

**Step 2: Verify TOTP Token**
```
POST /api/auth/2fa/verify
{
  "userId": 1,
  "token": "123456"
}

Response:
{
  "success": true,
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "sessionId": 123
}
```

### 5. Password Reset Flow

**Step 1: Request Reset**
```
POST /api/auth/password/reset-request
{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Step 2: Reset Password**
```
POST /api/auth/password/reset
{
  "userId": 1,
  "resetToken": "abc123def456...",
  "newPassword": "NewSecurePassword456!"
}

Response:
{
  "success": true,
  "message": "Password reset successfully. Please log in with your new password."
}
```

## Protected Endpoints

All endpoints requiring authentication must include the JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Example: Get Current User Profile
```
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

Response:
{
  "success": true,
  "user": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com",
    "status": "active",
    "totp_enabled": true,
    "last_login_at": "2024-01-15T10:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## Session Management

### List Active Sessions
```
GET /api/auth/sessions
Authorization: Bearer <token>

Response:
{
  "success": true,
  "sessions": [
    {
      "sessionId": 123,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "deviceFingerprint": "abc123...",
      "createdAt": "2024-01-15T10:00:00Z",
      "expiresAt": "2024-01-22T10:00:00Z"
    }
  ]
}
```

### Logout
```
POST /api/auth/logout
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Logout All Devices
```
POST /api/auth/logout-all
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Logged out from all devices"
}
```

## Token Management

### Refresh Token
```
POST /api/auth/refresh
Authorization: Bearer <token>

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "sessionId": 124
}
```

## Password Management

### Change Password (Authenticated)
```
POST /api/auth/password/change
Authorization: Bearer <token>
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}

Response:
{
  "success": true,
  "message": "Password changed successfully. Please log in again."
}
```

## 2FA Management

### Disable 2FA
```
POST /api/auth/2fa/disable
Authorization: Bearer <token>
{
  "password": "YourPassword123!"
}

Response:
{
  "success": true,
  "message": "Two-factor authentication disabled"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid input",
  "details": {
    "email": "Invalid email format"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden"
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Too many authentication attempts, please try again later"
}
```

## Security Best Practices

### For Developers

1. **Always use HTTPS** - Never transmit tokens over HTTP
2. **Store tokens securely** - Use httpOnly cookies or secure storage
3. **Validate input** - All endpoints validate input with Zod schemas
4. **Rate limiting** - Auth endpoints are rate-limited to prevent brute force
5. **Token expiration** - Tokens expire after 7 days by default
6. **Session tracking** - All sessions are tracked with device fingerprints

### For Users

1. **Use strong passwords** - Minimum 8 characters, mix of upper/lower/numbers/symbols
2. **Enable 2FA** - Use TOTP authenticator apps for additional security
3. **Save backup codes** - Store backup codes in a secure location
4. **Logout from unused devices** - Regularly review active sessions
5. **Never share tokens** - Tokens are personal and should never be shared

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Bcrypt Configuration
BCRYPT_ROUNDS=12

# OTP Configuration
OTP_LENGTH=6
OTP_TTL_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_DEV_RETURN=false  # Set to true only in development

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM=noreply@abancool.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=300           # 300 requests per window
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Auth Tests Only
```bash
npm run test:auth
```

### Test Coverage
- OTP generation and verification
- TOTP setup and verification
- Session management
- Password reset flow
- Device fingerprinting
- Security properties
- Edge cases and error handling

## Troubleshooting

### "Invalid credentials" Error
- Verify email and password are correct
- Check if account is active (not suspended)
- Ensure email is registered

### "OTP expired" Error
- OTP codes expire after 10 minutes
- Request a new code using `/api/auth/resend-otp`

### "Too many attempts" Error
- Rate limiting is active
- Wait 15 minutes before trying again
- Check if account is being attacked

### "Invalid TOTP token" Error
- Ensure authenticator app is synchronized
- Check system time on device
- Try a different code (they change every 30 seconds)

### "Session not found" Error
- Session may have expired
- Try logging in again
- Clear browser cache and cookies

## API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/signup | 10 | 15 min |
| /api/auth/login | 10 | 15 min |
| /api/auth/login-init | 10 | 15 min |
| /api/auth/verify-otp | 10 | 15 min |
| /api/auth/resend-otp | 10 | 15 min |
| /api/auth/password/reset-request | 10 | 15 min |
| /api/auth/password/reset | 10 | 15 min |
| Other endpoints | 300 | 15 min |

## Support

For issues or questions about the authentication system:
1. Check this guide
2. Review error messages
3. Check logs for detailed information
4. Contact support team

## References

- [JWT.io](https://jwt.io) - JWT documentation
- [Speakeasy](https://github.com/speakeasyjs/speakeasy) - TOTP library
- [Bcryptjs](https://github.com/dcodeIO/bcrypt.js) - Password hashing
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
