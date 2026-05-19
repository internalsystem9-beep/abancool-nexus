const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger OpenAPI Configuration
 * Comprehensive API documentation for all endpoints
 */

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ABANCOOL Command Center API',
      version: '1.0.0',
      description: 'Complete REST API for web hosting, domains, VPS management, and client billing',
      contact: {
        name: 'ABANCOOL Support',
        email: 'support@abancool.com',
        url: 'https://abancool.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development Server'
      },
      {
        url: 'https://api.abancool.com',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service communication'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'An error occurred' },
            errorCode: { type: 'string', example: 'ERROR_CODE' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'error', 'errorCode', 'timestamp']
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPreviousPage: { type: 'boolean', example: false }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            first_name: { type: 'string', example: 'John' },
            last_name: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+254712345678' },
            role: { type: 'string', enum: ['user', 'support_agent', 'super_admin'], example: 'user' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at', 'updated_at']
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 1 },
            company_name: { type: 'string', example: 'Tech Solutions Inc' },
            industry: { type: 'string', example: 'Technology' },
            country: { type: 'string', example: 'Kenya' },
            status: { type: 'string', enum: ['active', 'inactive', 'prospect'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'user_id', 'company_name', 'created_at', 'updated_at']
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            client_id: { type: 'integer', example: 1 },
            project_name: { type: 'string', example: 'E-commerce Platform' },
            description: { type: 'string', example: 'Custom e-commerce solution' },
            status: { type: 'string', enum: ['active', 'inactive', 'completed', 'archived'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'client_id', 'project_name', 'status', 'created_at', 'updated_at']
        },
        Domain: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            domain_name: { type: 'string', example: 'example.com' },
            registrar: { type: 'string', example: 'GoDaddy' },
            status: { type: 'string', enum: ['active', 'pending', 'expired', 'transferred'], example: 'active' },
            expiry_date: { type: 'string', format: 'date' },
            auto_renew: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'domain_name', 'status', 'expiry_date', 'created_at', 'updated_at']
        },
        Hosting: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            project_id: { type: 'integer', example: 1 },
            hosting_type: { type: 'string', enum: ['shared', 'vps', 'dedicated', 'cloud'], example: 'shared' },
            space: { type: 'string', example: '100GB' },
            bandwidth: { type: 'string', example: 'Unlimited' },
            status: { type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'project_id', 'hosting_type', 'status', 'created_at', 'updated_at']
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            client_id: { type: 'integer', example: 1 },
            invoice_number: { type: 'string', example: 'INV-2024-001' },
            total_amount: { type: 'number', format: 'double', example: 5000.00 },
            status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], example: 'sent' },
            due_date: { type: 'string', format: 'date' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'client_id', 'invoice_number', 'total_amount', 'status', 'due_date', 'created_at', 'updated_at']
        },
        Backup: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            backup_name: { type: 'string', example: 'Daily Backup' },
            backup_type: { type: 'string', enum: ['database', 'files', 'full'], example: 'full' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], example: 'completed' },
            size_bytes: { type: 'integer', example: 1073741824 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'backup_name', 'backup_type', 'status', 'created_at', 'updated_at']
        },
        SupportTicket: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            client_id: { type: 'integer', example: 1 },
            ticket_number: { type: 'string', example: 'TKT-2024-00001' },
            subject: { type: 'string', example: 'SSL Certificate Issue' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'high' },
            status: { type: 'string', enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'], example: 'open' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'client_id', 'ticket_number', 'subject', 'priority', 'status', 'created_at', 'updated_at']
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'message', 'data', 'timestamp']
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['data', 'pagination', 'timestamp']
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'Access forbidden',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        RateLimitError: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User management'
      },
      {
        name: 'Clients',
        description: 'Client management'
      },
      {
        name: 'Projects',
        description: 'Project management'
      },
      {
        name: 'Domains',
        description: 'Domain management'
      },
      {
        name: 'Hosting',
        description: 'Hosting management'
      },
      {
        name: 'Invoices',
        description: 'Invoice and billing management'
      },
      {
        name: 'Backups',
        description: 'Backup and restore operations'
      },
      {
        name: 'Support',
        description: 'Support tickets'
      },
      {
        name: 'Email',
        description: 'Email operations'
      },
      {
        name: 'SMS',
        description: 'SMS operations'
      },
      {
        name: 'Audit',
        description: 'Audit logging'
      },
      {
        name: 'DevOps',
        description: 'DevOps and monitoring'
      },
      {
        name: 'Health',
        description: 'Health and status checks'
      }
    ]
  },
  apis: [
    // This will be populated with JSDoc comments from route files
  ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
