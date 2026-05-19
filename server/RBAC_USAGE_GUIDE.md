# RBAC (Role-Based Access Control) Usage Guide

## Overview

The ABANCOOL Command Center implements a comprehensive Role-Based Access Control (RBAC) system with 6 predefined roles and 19 different permissions. This guide explains how to use the RBAC system in your application.

## Predefined Roles

### 1. Super Admin
**Description**: Full system access, can manage all resources and users

**Permissions**:
- create_user, read_user, update_user, delete_user
- manage_roles, manage_clients, manage_projects
- manage_hosting, manage_domains, manage_vps
- manage_vault, manage_files, manage_billing
- manage_payments, manage_communications, manage_tickets
- manage_automations, view_audit_logs, manage_system

**Use Cases**:
- System administrators
- Platform owners
- Account managers

### 2. Admin
**Description**: Administrative access to manage clients and projects

**Permissions**:
- read_user, update_user
- manage_clients, manage_projects
- manage_hosting, manage_domains, manage_vps
- manage_files, manage_billing
- manage_communications, manage_tickets
- view_audit_logs

**Use Cases**:
- Account administrators
- Project managers
- Operations managers

### 3. Developer
**Description**: Development access to manage projects and files

**Permissions**:
- read_user, update_user
- read_projects, update_projects
- manage_files, read_vault, read_tickets

**Use Cases**:
- Software developers
- DevOps engineers
- Technical leads

### 4. Support
**Description**: Support access to manage tickets and communications

**Permissions**:
- read_user, read_clients, read_projects
- manage_tickets, manage_communications, read_vault

**Use Cases**:
- Support staff
- Customer service representatives
- Help desk agents

### 5. Finance
**Description**: Finance access to manage billing and payments

**Permissions**:
- read_user, read_clients
- manage_billing, manage_payments
- view_audit_logs

**Use Cases**:
- Finance managers
- Accountants
- Billing specialists

### 6. Sales
**Description**: Sales access to manage clients and communications

**Permissions**:
- read_user, read_clients
- manage_clients, read_projects
- manage_communications

**Use Cases**:
- Sales representatives
- Account executives
- Business development managers

## Using RBAC in Routes

### Basic Role Check

```javascript
const { requireRole } = require("./middleware/rbac");

// Only super_admin can access this route
router.post("/api/users", authRequired, requireRole("super_admin"), users.create);

// Multiple roles allowed
router.post("/api/clients/:id/assign", authRequired, requireRole("admin", "super_admin"), clients.assign);
```

### Permission Check

```javascript
const { requirePermission } = require("./middleware/rbac");

// Check for specific permission
router.post("/api/billing/invoices", authRequired, requirePermission("manage_billing"), billing.createInvoice);

// Multiple permissions (user needs at least one)
router.get("/api/audit/logs", authRequired, requirePermission("view_audit_logs", "manage_system"), audit.getLogs);
```

## Using RBAC in Controllers

### Check Permission in Controller

```javascript
const { checkPermission } = require("../middleware/rbac");

async function createInvoice(req, res, next) {
  try {
    // Check if user has permission
    const hasPermission = await checkPermission(req.user.id, "manage_billing");
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to create invoices"
      });
    }

    // Create invoice logic here
  } catch (error) {
    next(error);
  }
}
```

### Get User Permissions

```javascript
const { getUserPermissions } = require("../middleware/rbac");

async function getUserInfo(req, res, next) {
  try {
    const permissions = await getUserPermissions(req.user.id);
    
    res.json({
      success: true,
      data: {
        user: req.user,
        permissions: permissions
      }
    });
  } catch (error) {
    next(error);
  }
}
```

## Creating Users with Roles

### Example: Create a Developer User

```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@example.com",
    "password": "securepassword123",
    "first_name": "John",
    "last_name": "Developer",
    "roles": ["developer"]
  }'
```

### Example: Create a Multi-Role User

```bash
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "securepassword123",
    "first_name": "Jane",
    "last_name": "Admin",
    "roles": ["admin", "finance"]
  }'
```

## Updating User Roles

### Example: Promote Developer to Admin

```bash
curl -X PUT http://localhost:4000/api/users/1/roles \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["admin", "developer"]
  }'
```

## Checking User Permissions

### Example: Get User Permissions

```bash
curl -X GET http://localhost:4000/api/users/1 \
  -H "Authorization: Bearer <token>"
```

Response includes user roles:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "roles": ["developer", "support"]
  }
}
```

## Permission Mapping Reference

### Super Admin Permissions
```
create_user, read_user, update_user, delete_user,
manage_roles, manage_clients, manage_projects,
manage_hosting, manage_domains, manage_vps,
manage_vault, manage_files, manage_billing,
manage_payments, manage_communications, manage_tickets,
manage_automations, view_audit_logs, manage_system
```

### Admin Permissions
```
read_user, update_user,
manage_clients, manage_projects,
manage_hosting, manage_domains, manage_vps,
manage_files, manage_billing,
manage_communications, manage_tickets,
view_audit_logs
```

### Developer Permissions
```
read_user, update_user,
read_projects, update_projects,
manage_files, read_vault, read_tickets
```

### Support Permissions
```
read_user, read_clients, read_projects,
manage_tickets, manage_communications, read_vault
```

### Finance Permissions
```
read_user, read_clients,
manage_billing, manage_payments,
view_audit_logs
```

### Sales Permissions
```
read_user, read_clients,
manage_clients, read_projects,
manage_communications
```

## Best Practices

### 1. Always Check Authorization
```javascript
// ✅ Good - Check authorization before action
if (!await checkPermission(req.user.id, "manage_billing")) {
  return res.status(403).json({ error: "Forbidden" });
}

// ❌ Bad - No authorization check
// Directly perform action
```

### 2. Use Middleware for Route Protection
```javascript
// ✅ Good - Use middleware
router.post("/api/users", authRequired, requireRole("super_admin"), users.create);

// ❌ Bad - No middleware protection
router.post("/api/users", users.create);
```

### 3. Log Authorization Failures
```javascript
// ✅ Good - Log failed authorization attempts
if (!hasPermission) {
  await logAudit(req.user.id, "unauthorized_access_attempt", "users", null, null, req);
  return res.status(403).json({ error: "Forbidden" });
}
```

### 4. Assign Minimal Permissions
```javascript
// ✅ Good - Assign only necessary roles
roles: ["developer"]

// ❌ Bad - Over-privileged
roles: ["super_admin"]
```

### 5. Review Permissions Regularly
```javascript
// ✅ Good - Audit user permissions
const permissions = await getUserPermissions(userId);
console.log("User permissions:", permissions);
```

## Common Scenarios

### Scenario 1: Create a Support Agent
```javascript
// Create user with support role
const user = await createUser({
  email: "support@example.com",
  password: "secure123",
  roles: ["support"]
});

// User can now:
// - Read users, clients, projects
// - Manage tickets and communications
// - Read vault credentials
```

### Scenario 2: Promote Developer to Admin
```javascript
// Update user roles
await updateUserRoles(userId, ["admin", "developer"]);

// User now has admin permissions plus developer permissions
```

### Scenario 3: Restrict Finance User
```javascript
// Create finance user with limited permissions
const user = await createUser({
  email: "finance@example.com",
  password: "secure123",
  roles: ["finance"]
});

// User can only:
// - Read users and clients
// - Manage billing and payments
// - View audit logs
```

### Scenario 4: Multi-Role User
```javascript
// Create user with multiple roles
const user = await createUser({
  email: "manager@example.com",
  password: "secure123",
  roles: ["admin", "finance", "sales"]
});

// User has combined permissions from all roles
```

## Troubleshooting

### Issue: User Cannot Access Resource
**Solution**: Check user roles and permissions
```javascript
const permissions = await getUserPermissions(userId);
console.log("User permissions:", permissions);
```

### Issue: Permission Denied Error
**Solution**: Verify user has required role
```bash
curl -X GET http://localhost:4000/api/users/1 \
  -H "Authorization: Bearer <token>"
```

### Issue: Audit Log Shows Unauthorized Access
**Solution**: Review user roles and update if necessary
```bash
curl -X PUT http://localhost:4000/api/users/1/roles \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"roles": ["developer"]}'
```

## API Response Examples

### Successful Authorization
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "roles": ["developer"]
  }
}
```

### Authorization Denied
```json
{
  "success": false,
  "error": "Only Super Admin can create users"
}
```

### Insufficient Permissions
```json
{
  "success": false,
  "error": "Forbidden - insufficient permissions"
}
```

## Summary

The RBAC system provides:
- ✅ 6 predefined roles
- ✅ 19 different permissions
- ✅ Flexible role assignment
- ✅ Permission checking at middleware level
- ✅ Audit logging of all actions
- ✅ Easy permission verification

Use this system to:
1. Protect sensitive operations
2. Enforce authorization rules
3. Maintain audit trails
4. Manage user access levels
5. Comply with security requirements
