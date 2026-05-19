# User Management API Guide

## Overview
This guide provides detailed information about the User Management API endpoints with RBAC (Role-Based Access Control).

## Authentication
All endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Predefined Roles
- `super_admin` - Full system access
- `admin` - Administrative access
- `developer` - Development access
- `support` - Support access
- `finance` - Finance access
- `sales` - Sales access

## Endpoints

### 1. Create User
**POST** `/api/users`

**Required Role**: `super_admin`

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "1234567890",
  "roles": ["developer", "support"]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "1234567890",
    "status": "active",
    "roles": ["developer", "support"],
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### 2. List Users
**GET** `/api/users?page=1&limit=10&search=&status=&role=`

**Required Role**: Any authenticated user

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search by email, first_name, or last_name
- `status` (optional): Filter by status (active, inactive, suspended)
- `role` (optional): Filter by role

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "1234567890",
      "status": "active",
      "roles": ["developer", "support"],
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### 3. Get User Details
**GET** `/api/users/:id`

**Required Role**: Any authenticated user

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "1234567890",
    "avatar_url": "https://example.com/avatar.jpg",
    "status": "active",
    "roles": ["developer", "support"],
    "last_login_at": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 4. Update User Profile
**PUT** `/api/users/:id`

**Required Role**: Any authenticated user (can update own profile) or `super_admin` (can update any)

**Request Body**:
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "9876543210",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User profile updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "9876543210",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "status": "active",
    "roles": ["developer", "support"],
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### 5. Update User Roles
**PUT** `/api/users/:id/roles`

**Required Role**: `super_admin`

**Request Body**:
```json
{
  "roles": ["admin", "finance"]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User roles updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["admin", "finance"],
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### 6. Update User Status
**PUT** `/api/users/:id/status`

**Required Role**: `super_admin`

**Request Body**:
```json
{
  "status": "suspended"
}
```

**Valid Statuses**: `active`, `inactive`, `suspended`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "status": "suspended",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

### 7. Delete User (Soft Delete)
**DELETE** `/api/users/:id`

**Required Role**: `super_admin`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 8. Get User Audit Log
**GET** `/api/users/:id/audit?page=1&limit=10`

**Required Role**: Any authenticated user

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 2,
      "action": "user_updated",
      "resource_type": "users",
      "resource_id": 1,
      "old_values": {
        "first_name": "John"
      },
      "new_values": {
        "first_name": "Jane"
      },
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "status": "success",
      "created_at": "2024-01-15T11:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

### 9. Search Users
**GET** `/api/users/search?q=&role=&status=&page=1&limit=10`

**Required Role**: Any authenticated user

**Query Parameters**:
- `q` (optional): Search query (email, first_name, last_name)
- `role` (optional): Filter by role
- `status` (optional): Filter by status
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "1234567890",
      "status": "active",
      "roles": ["developer"],
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### 10. Assign User to Client
**POST** `/api/users/:id/clients/:clientId`

**Required Role**: `admin`, `super_admin`

**Response** (201 Created):
```json
{
  "success": true,
  "message": "User assigned to client successfully"
}
```

### 11. Remove User from Client
**DELETE** `/api/users/:id/clients/:clientId`

**Required Role**: `admin`, `super_admin`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User removed from client successfully"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Email and password are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Missing token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Only Super Admin can create users"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "User not found"
}
```

## Examples

### Create a new developer user
```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "securepass123",
    "first_name": "Dev",
    "last_name": "User",
    "roles": ["developer"]
  }'
```

### List all active users
```bash
curl -X GET "http://localhost:4000/api/users?status=active&limit=20" \
  -H "Authorization: Bearer <token>"
```

### Search for users by email
```bash
curl -X GET "http://localhost:4000/api/users/search?q=john@example.com" \
  -H "Authorization: Bearer <token>"
```

### Update user roles to admin and finance
```bash
curl -X PUT http://localhost:4000/api/users/1/roles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["admin", "finance"]
  }'
```

### Suspend a user
```bash
curl -X PUT http://localhost:4000/api/users/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended"
  }'
```

## Rate Limiting
- Authentication endpoints: 10 requests per 15 minutes
- Other endpoints: 300 requests per 15 minutes

## Notes
- All timestamps are in ISO 8601 format (UTC)
- Passwords are hashed with bcrypt (10 rounds)
- Soft-delete preserves data for audit trail
- All actions are logged in the audit_logs table
- User-client assignments enable client-scoped data access
- Pagination maximum limit is 100 items per page
