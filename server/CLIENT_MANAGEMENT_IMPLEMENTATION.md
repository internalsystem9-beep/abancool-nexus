# Client Management System Implementation

## Overview

The Client Management System has been successfully implemented as part of Task 4 of the ABANCOOL Command Center Backend. This system provides comprehensive client management functionality including CRUD operations, contact management, and user-client associations with proper authorization controls.

## Features Implemented

### 1. Core Client Management
- ✅ **Create Client**: Full company information with validation
- ✅ **Read Client**: Detailed client information with related data
- ✅ **Update Client**: Partial updates with validation
- ✅ **Delete Client**: Soft delete functionality
- ✅ **List Clients**: Paginated listing with filtering

### 2. Client Information Fields
- ✅ **client_id**: Auto-generated unique identifier (CL-YYYY-XXXXXX format)
- ✅ **company_name**: Required company name
- ✅ **email**: Optional email with validation and uniqueness check
- ✅ **phone**: Optional phone with format validation
- ✅ **address**: Optional full address
- ✅ **city**: Optional city
- ✅ **country**: Optional country
- ✅ **kra_pin**: Optional Kenya Revenue Authority PIN
- ✅ **status**: Active/Inactive/Suspended status
- ✅ **created_by**: User who created the client
- ✅ **timestamps**: Created/Updated/Deleted timestamps

### 3. Contact Management
- ✅ **Add Contact**: Add multiple contacts per client
- ✅ **List Contacts**: Get all contacts for a client
- ✅ **Update Contact**: Modify contact information
- ✅ **Delete Contact**: Soft delete contacts
- ✅ **Primary Contact**: Mark one contact as primary per client

### 4. Advanced Features
- ✅ **Filtering**: Filter by status, creation date, assigned staff, search term
- ✅ **Pagination**: Configurable page size and navigation
- ✅ **Search**: Search across company name, email, and client ID
- ✅ **Related Data**: Projects and billing summary integration
- ✅ **Authorization**: Role-based access control with permissions
- ✅ **Validation**: Comprehensive input validation with Zod schemas
- ✅ **Error Handling**: Standardized API response format

## API Endpoints

### Client CRUD Operations
```
GET    /api/clients                    - List clients (paginated, filtered)
GET    /api/clients/:id                - Get client details with related data
POST   /api/clients                    - Create new client
PUT    /api/clients/:id                - Update client information
DELETE /api/clients/:id                - Soft delete client
```

### Contact Management
```
POST   /api/clients/:id/contacts       - Add contact to client
GET    /api/clients/:id/contacts       - List client contacts
PUT    /api/clients/:id/contacts/:cid  - Update contact
DELETE /api/clients/:id/contacts/:cid  - Delete contact
```

### Related Data
```
GET    /api/clients/:id/projects       - List client's projects
GET    /api/clients/:id/billing        - Get client billing summary
```

## Request/Response Examples

### Create Client
```json
POST /api/clients
{
  "company_name": "ACME Corporation Ltd",
  "email": "info@acme.com",
  "phone": "+254700123456",
  "address": "123 Business Street",
  "city": "Nairobi",
  "country": "Kenya",
  "kra_pin": "A123456789Z",
  "status": "active"
}

Response:
{
  "success": true,
  "message": "Client created successfully",
  "data": {
    "client": {
      "id": 1,
      "client_id": "CL-2024-123456",
      "company_name": "ACME Corporation Ltd",
      "email": "info@acme.com",
      "phone": "+254700123456",
      "address": "123 Business Street",
      "city": "Nairobi",
      "country": "Kenya",
      "kra_pin": "A123456789Z",
      "status": "active",
      "created_by": 1,
      "created_at": "2024-01-01T10:00:00.000Z",
      "updated_at": "2024-01-01T10:00:00.000Z",
      "deleted_at": null
    }
  }
}
```

### List Clients with Filtering
```json
GET /api/clients?page=1&limit=20&status=active&search=ACME&created_from=2024-01-01

Response:
{
  "success": true,
  "message": "Clients retrieved successfully",
  "data": {
    "clients": [
      {
        "id": 1,
        "client_id": "CL-2024-123456",
        "company_name": "ACME Corporation Ltd",
        "email": "info@acme.com",
        "phone": "+254700123456",
        "address": "123 Business Street",
        "city": "Nairobi",
        "country": "Kenya",
        "kra_pin": "A123456789Z",
        "status": "active",
        "created_at": "2024-01-01T10:00:00.000Z",
        "updated_at": "2024-01-01T10:00:00.000Z",
        "created_by_name": "John Admin",
        "contact_count": 2,
        "project_count": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

### Get Client Details
```json
GET /api/clients/1

Response:
{
  "success": true,
  "message": "Client details retrieved successfully",
  "data": {
    "client": {
      "id": 1,
      "client_id": "CL-2024-123456",
      "company_name": "ACME Corporation Ltd",
      "email": "info@acme.com",
      "phone": "+254700123456",
      "address": "123 Business Street",
      "city": "Nairobi",
      "country": "Kenya",
      "kra_pin": "A123456789Z",
      "status": "active",
      "created_by": 1,
      "created_at": "2024-01-01T10:00:00.000Z",
      "updated_at": "2024-01-01T10:00:00.000Z",
      "deleted_at": null,
      "created_by_name": "John Admin"
    },
    "contacts": [
      {
        "id": 1,
        "contact_name": "Jane Doe",
        "email": "jane@acme.com",
        "phone": "+254700123457",
        "role": "CEO",
        "is_primary": true,
        "created_at": "2024-01-01T10:05:00.000Z"
      }
    ],
    "projects": [
      {
        "id": 1,
        "project_id": "PRJ-2024-001",
        "project_name": "Website Redesign",
        "status": "in_progress",
        "budget": 50000.00,
        "deadline": "2024-03-01",
        "created_at": "2024-01-01T10:10:00.000Z"
      }
    ],
    "billing": {
      "total_invoices": 5,
      "total_paid": 75000.00,
      "total_outstanding": 25000.00
    }
  }
}
```

### Add Contact
```json
POST /api/clients/1/contacts
{
  "contact_name": "John Smith",
  "email": "john@acme.com",
  "phone": "+254700123458",
  "role": "CTO",
  "is_primary": false
}

Response:
{
  "success": true,
  "message": "Contact added successfully",
  "data": {
    "contact": {
      "id": 2,
      "client_id": 1,
      "contact_name": "John Smith",
      "email": "john@acme.com",
      "phone": "+254700123458",
      "role": "CTO",
      "is_primary": false,
      "created_at": "2024-01-01T10:15:00.000Z",
      "updated_at": "2024-01-01T10:15:00.000Z",
      "deleted_at": null
    }
  }
}
```

## Validation Rules

### Client Validation
- **company_name**: Required, 1-255 characters
- **email**: Optional, valid email format, unique across active clients
- **phone**: Optional, valid phone format (numbers, +, -, (), spaces)
- **address**: Optional, max 1000 characters
- **city**: Optional, max 100 characters
- **country**: Optional, max 100 characters
- **kra_pin**: Optional, max 50 characters
- **status**: Must be 'active', 'inactive', or 'suspended'

### Contact Validation
- **contact_name**: Required, 1-255 characters
- **email**: Optional, valid email format
- **phone**: Optional, max 20 characters
- **role**: Optional, max 100 characters
- **is_primary**: Boolean, only one primary contact per client

## Authorization

### Permissions Required
- **Read Operations**: All authenticated users can read client data
- **Create/Update**: Requires `manage_clients` permission
- **Delete**: Requires `manage_clients` permission
- **Billing Data**: Requires `manage_billing` permission

### Role Permissions
- **Super Admin**: Full access to all operations
- **Admin**: Full access to client management
- **Sales**: Can manage clients and read projects
- **Support**: Can read clients and projects
- **Finance**: Can read clients and manage billing
- **Developer**: Can read clients and projects

## Database Schema

### Clients Table
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

### Contacts Table
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

## Error Handling

### Standard Error Responses
```json
{
  "success": false,
  "error": "Error message",
  "details": [] // Optional validation details
}
```

### Common Error Codes
- **400 Bad Request**: Validation errors, invalid input
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Client or contact not found
- **500 Internal Server Error**: Server errors

## Integration Points

### User-Client Associations
The system integrates with the User Management module through the `user_clients` table for assigning staff to clients.

### Project Integration
Clients are linked to projects through the `projects.client_id` foreign key, enabling project tracking per client.

### Billing Integration
Clients are linked to invoices and quotes through foreign keys, enabling comprehensive billing management.

### Audit Logging
All client operations are logged through the audit system for compliance and tracking.

## Testing

The implementation includes comprehensive validation and error handling. A test suite has been created to verify:

1. ✅ Client CRUD operations
2. ✅ Contact management
3. ✅ Input validation
4. ✅ Authorization checks
5. ✅ Error handling
6. ✅ Response formatting

## Compliance with Requirements

This implementation fully satisfies **Requirement 3: Client Management with Company and Contact Information** from the requirements document:

1. ✅ Store company name, email, phone, address, and KRA PIN
2. ✅ Generate unique client ID and store creation timestamp
3. ✅ Validate email format and phone number format before saving
4. ✅ Store contact name, email, phone, and role
5. ✅ Create client-project relationships (via foreign keys)
6. ✅ Support filtering by status, creation date, and assigned staff
7. ✅ Soft-delete and preserve associated projects and contacts
8. ✅ Return company info, contacts, projects, and billing summary

## Next Steps

The Client Management System is now ready for integration with:
1. Project Management System (Task 5)
2. Billing Engine (Task 11)
3. Support Ticket System (Task 15)
4. Real-time notifications (Task 17)

All database migrations are in place and the API endpoints are fully functional with proper authorization and validation.