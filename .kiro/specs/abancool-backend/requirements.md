# ABANCOOL Command Center Backend - Requirements Document

## Introduction

ABANCOOL Command Center is an enterprise-grade SaaS platform designed to manage web hosting, domain registration, VPS infrastructure, and client billing operations. The backend is a production-ready Node.js + Express.js REST API with MySQL/PostgreSQL compatibility, deployable to cPanel, VPS, and PM2 environments.

This system serves as the central hub for managing multiple interconnected modules including authentication, user/role management, client operations, project tracking, hosting infrastructure, domain management, billing, payments, communications (SMS/WhatsApp), support tickets, and real-time notifications.

## Glossary

- **System**: ABANCOOL Command Center Backend API
- **User**: An authenticated individual with assigned roles and permissions
- **Client**: A company or organization using ABANCOOL services
- **Project**: A deliverable or service engagement tracked within the system
- **Hosting**: cPanel-based web hosting services with domains and packages
- **Domain**: A registered internet domain with DNS, SSL, and renewal management
- **VPS**: Virtual Private Server infrastructure with resource monitoring
- **Vault**: Encrypted credential storage for passwords and API keys
- **RBAC**: Role-Based Access Control with 6 predefined roles
- **JWT**: JSON Web Token for stateless authentication
- **OTP**: One-Time Password for multi-factor authentication
- **2FA**: Two-Factor Authentication mechanism
- **KRA PIN**: Kenya Revenue Authority Personal Identification Number
- **Invoice**: Billing document for services rendered
- **Quote**: Preliminary pricing proposal for client services
- **Payment Gateway**: Third-party service for processing payments (M-Pesa, IntaSend, Paystack)
- **SMS Engine**: Service for sending SMS messages via Africa's Talking or Twilio
- **WhatsApp Integration**: Cloud API for WhatsApp messaging and templates
- **Support Ticket**: Issue tracking record for customer support
- **Automation Engine**: Scheduled workflows and cron job execution
- **Audit Log**: Comprehensive record of system actions and user activities
- **Socket.IO**: Real-time bidirectional communication protocol
- **Helmet**: Security middleware for HTTP headers
- **Bcrypt**: Password hashing algorithm
- **Rate Limiting**: Mechanism to restrict request frequency
- **CSRF**: Cross-Site Request Forgery protection
- **XSS**: Cross-Site Scripting prevention
- **SQL Injection**: Prevention of malicious SQL query execution
- **cPanel**: Web hosting control panel
- **PM2**: Node.js process manager
- **Docker**: Containerization platform
- **SSL**: Secure Sockets Layer certificate
- **Nodemailer**: Email sending library
- **Zod**: TypeScript-first schema validation library


## Requirements

### Requirement 1: Authentication System with JWT, OTP, and 2FA

**User Story:** As a user, I want to authenticate securely with JWT tokens, OTP verification, and optional 2FA, so that my account is protected and I can access the system safely.

#### Acceptance Criteria

1. WHEN a user submits valid email and password, THE System SHALL validate credentials against bcrypt-hashed passwords and return a JWT token with 24-hour expiration
2. WHEN a user requests OTP, THE System SHALL generate a 6-digit code, store it with 5-minute expiration, and send it via email
3. WHEN a user submits a valid OTP, THE System SHALL verify the code and issue a JWT token
4. WHEN a user enables 2FA, THE System SHALL generate a TOTP secret, return a QR code, and require TOTP verification on subsequent logins
5. WHEN a user submits an invalid JWT token, THE System SHALL return a 401 Unauthorized response
6. WHEN a JWT token expires, THE System SHALL reject the request and require re-authentication
7. WHEN a user logs out, THE System SHALL invalidate the session token in the session tracking table
8. WHEN a user logs in from a new device, THE System SHALL log the device fingerprint (IP, user agent) for audit purposes


### Requirement 2: User and Role Management with RBAC

**User Story:** As an administrator, I want to manage users with role-based access control across 6 predefined roles, so that I can enforce proper authorization and delegate responsibilities.

#### Acceptance Criteria

1. THE System SHALL support exactly 6 roles: Super Admin, Admin, Developer, Support, Finance, Sales
2. WHEN a Super Admin creates a user, THE System SHALL assign one or more roles and store role assignments in the database
3. WHEN a user with a specific role attempts an action, THE System SHALL check role permissions and return 403 Forbidden if unauthorized
4. WHEN a Super Admin updates a user's roles, THE System SHALL immediately apply the changes to subsequent requests
5. WHEN a user is deleted, THE System SHALL soft-delete the record and preserve audit history
6. WHEN a user's password is reset, THE System SHALL generate a temporary token, send a reset link via email, and require new password on next login
7. WHEN a user profile is updated, THE System SHALL validate all fields and log the change in the audit log
8. WHEN a user is assigned to a client, THE System SHALL create a user-client relationship and enforce client-scoped data access


### Requirement 3: Client Management with Company and Contact Information

**User Story:** As a sales representative, I want to manage client companies, contacts, and KRA PIN information, so that I can track client relationships and billing details.

#### Acceptance Criteria

1. WHEN a user creates a client, THE System SHALL store company name, email, phone, address, and KRA PIN
2. WHEN a client is created, THE System SHALL generate a unique client ID and store creation timestamp
3. WHEN a user updates client information, THE System SHALL validate email format and phone number format before saving
4. WHEN a user adds a contact to a client, THE System SHALL store contact name, email, phone, and role
5. WHEN a user assigns a project to a client, THE System SHALL create a client-project relationship
6. WHEN a user queries clients, THE System SHALL support filtering by status, creation date, and assigned staff
7. WHEN a client is deleted, THE System SHALL soft-delete and preserve all associated projects and contacts
8. WHEN a user views client details, THE System SHALL return company info, contacts, projects, and billing summary


### Requirement 4: Project Management with Tracking, Budgets, and Deadlines

**User Story:** As a project manager, I want to track projects with budgets, deadlines, and deployment URLs, so that I can monitor project progress and resource allocation.

#### Acceptance Criteria

1. WHEN a user creates a project, THE System SHALL store project name, description, client ID, budget, deadline, and status
2. WHEN a project is created, THE System SHALL generate a unique project ID and set initial status to "Planning"
3. WHEN a user updates project status, THE System SHALL validate status transitions (Planning → In Progress → Testing → Deployed → Completed)
4. WHEN a user adds a deployment URL to a project, THE System SHALL validate URL format and store it with deployment timestamp
5. WHEN a project deadline approaches, THE System SHALL trigger a notification to assigned staff
6. WHEN a user queries projects, THE System SHALL support filtering by client, status, deadline, and assigned developer
7. WHEN a project budget is exceeded, THE System SHALL flag the project and notify the Finance role
8. WHEN a user views project details, THE System SHALL return all project info, assigned team members, and budget utilization percentage


### Requirement 5: Hosting Management with cPanel Integration

**User Story:** As a hosting administrator, I want to manage cPanel domains, packages, and resource usage, so that I can track hosting services and monitor resource allocation.

#### Acceptance Criteria

1. WHEN a user creates a hosting record, THE System SHALL store domain name, cPanel account, package type, disk quota, and bandwidth limit
2. WHEN a hosting package is created, THE System SHALL store package name, price, disk space, bandwidth, and feature list
3. WHEN a user updates hosting resource limits, THE System SHALL validate new limits against cPanel account capacity
4. WHEN a hosting account is queried, THE System SHALL return current disk usage percentage and bandwidth usage percentage
5. WHEN disk usage exceeds 80% of quota, THE System SHALL trigger an alert notification
6. WHEN bandwidth usage exceeds 80% of limit, THE System SHALL trigger an alert notification
7. WHEN a user views hosting details, THE System SHALL return domain, package, resource usage, renewal date, and associated client
8. WHEN a hosting account is deleted, THE System SHALL soft-delete and preserve billing history


### Requirement 6: Domain Management with Registrar and SSL Tracking

**User Story:** As a domain administrator, I want to track domain registrations, SSL certificates, and auto-renewal settings, so that I can prevent domain and certificate expiration.

#### Acceptance Criteria

1. WHEN a user creates a domain record, THE System SHALL store domain name, registrar, registration date, expiration date, and auto-renewal status
2. WHEN a domain is created, THE System SHALL validate domain name format and check for duplicates
3. WHEN a user updates SSL certificate information, THE System SHALL store certificate issuer, expiration date, and renewal status
4. WHEN a domain expiration date approaches (30 days), THE System SHALL trigger a renewal reminder notification
5. WHEN an SSL certificate expiration date approaches (30 days), THE System SHALL trigger a renewal reminder notification
6. WHEN a user enables auto-renewal, THE System SHALL mark the domain for automatic renewal and log the action
7. WHEN a user queries domains, THE System SHALL support filtering by registrar, expiration date, and SSL status
8. WHEN a user views domain details, THE System SHALL return domain info, SSL status, renewal settings, and associated hosting account


### Requirement 7: VPS Management with Server Monitoring and Resource Tracking

**User Story:** As a DevOps engineer, I want to monitor VPS servers, track resource usage, and receive alerts, so that I can ensure optimal server performance.

#### Acceptance Criteria

1. WHEN a user creates a VPS record, THE System SHALL store server name, IP address, provider, CPU cores, RAM, and storage capacity
2. WHEN a VPS is created, THE System SHALL generate a unique VPS ID and set initial status to "Active"
3. WHEN a user updates VPS resource metrics, THE System SHALL store CPU usage percentage, RAM usage percentage, and disk usage percentage
4. WHEN CPU usage exceeds 85%, THE System SHALL trigger an alert notification
5. WHEN RAM usage exceeds 85%, THE System SHALL trigger an alert notification
6. WHEN disk usage exceeds 85%, THE System SHALL trigger an alert notification
7. WHEN a user queries VPS servers, THE System SHALL support filtering by provider, status, and resource utilization
8. WHEN a user views VPS details, THE System SHALL return server info, current resource metrics, uptime percentage, and associated client


### Requirement 8: Password Vault with Encrypted Credential Storage

**User Story:** As a system administrator, I want to securely store and retrieve encrypted credentials, so that I can manage sensitive information safely.

#### Acceptance Criteria

1. WHEN a user stores a credential in the vault, THE System SHALL encrypt it using AES-256 encryption before storing
2. WHEN a credential is stored, THE System SHALL record the credential type, label, username, and encrypted password
3. WHEN a user retrieves a credential, THE System SHALL decrypt it and return the plaintext only to authorized users
4. WHEN a user updates a credential, THE System SHALL re-encrypt the new value and log the change in audit log
5. WHEN a user deletes a credential, THE System SHALL soft-delete and preserve deletion timestamp
6. WHEN a user queries vault credentials, THE System SHALL support filtering by credential type and label
7. WHEN a credential is accessed, THE System SHALL log the access with user ID, timestamp, and IP address
8. WHEN a user views vault details, THE System SHALL return credential labels and types without exposing encrypted values


### Requirement 9: File Management with Upload Validation and Secure Storage

**User Story:** As a user, I want to upload files with validation and secure storage, so that I can manage project documents and resources safely.

#### Acceptance Criteria

1. WHEN a user uploads a file, THE System SHALL validate file type, size (max 50MB), and scan for malware
2. WHEN a file is uploaded, THE System SHALL store it with a unique identifier, original filename, MIME type, and upload timestamp
3. WHEN a file is uploaded, THE System SHALL generate a secure download token with 24-hour expiration
4. WHEN a user downloads a file, THE System SHALL verify authorization and log the download
5. WHEN a file is deleted, THE System SHALL remove it from storage and soft-delete the database record
6. WHEN a user queries files, THE System SHALL support filtering by project, upload date, and file type
7. WHEN a file is accessed, THE System SHALL log the access with user ID, timestamp, and IP address
8. WHEN a user views file details, THE System SHALL return filename, size, upload date, and download count


### Requirement 10: Billing Engine with Invoices, Quotes, and Tax Calculations

**User Story:** As a finance manager, I want to generate invoices and quotes with automatic tax calculations, so that I can manage billing accurately.

#### Acceptance Criteria

1. WHEN a user creates an invoice, THE System SHALL store client ID, invoice number, items, quantities, unit prices, and tax rate
2. WHEN an invoice is created, THE System SHALL calculate subtotal, tax amount, and total automatically
3. WHEN an invoice is created, THE System SHALL generate a unique invoice number with date prefix (e.g., INV-2024-001)
4. WHEN a user creates a quote, THE System SHALL store similar fields as invoice with quote-specific status and expiration date
5. WHEN a quote expires, THE System SHALL mark it as expired and prevent conversion to invoice
6. WHEN a user converts a quote to invoice, THE System SHALL create an invoice with quote items and set quote status to "Converted"
7. WHEN a user queries invoices, THE System SHALL support filtering by client, status, date range, and payment status
8. WHEN a user views invoice details, THE System SHALL return all invoice info, payment history, and tax breakdown


### Requirement 11: Payment Integration with M-Pesa, IntaSend, and Paystack

**User Story:** As a finance manager, I want to process payments through multiple gateways, so that I can offer flexible payment options to clients.

#### Acceptance Criteria

1. WHEN a user initiates M-Pesa payment, THE System SHALL call M-Pesa Daraja STK Push API with invoice amount and phone number
2. WHEN M-Pesa payment is confirmed, THE System SHALL receive webhook callback, verify signature, and update invoice payment status
3. WHEN a user initiates IntaSend payment, THE System SHALL call IntaSend API with invoice amount and payment method
4. WHEN IntaSend payment is confirmed, THE System SHALL receive webhook callback and update invoice payment status
5. WHEN a user initiates Paystack payment, THE System SHALL call Paystack API with invoice amount and email
6. WHEN Paystack payment is confirmed, THE System SHALL receive webhook callback and update invoice payment status
7. WHEN a payment is received, THE System SHALL create a transaction record with payment method, amount, and timestamp
8. WHEN a user queries transactions, THE System SHALL support filtering by payment method, date range, and status


### Requirement 12: SMS Engine with Africa's Talking and Twilio Support

**User Story:** As a communication manager, I want to send SMS messages through multiple providers, so that I can reach clients via SMS.

#### Acceptance Criteria

1. WHEN a user sends an SMS via Africa's Talking, THE System SHALL call Africa's Talking API with recipient phone, message, and sender ID
2. WHEN SMS is sent via Africa's Talking, THE System SHALL receive delivery status and store it in SMS campaign record
3. WHEN a user sends an SMS via Twilio, THE System SHALL call Twilio API with recipient phone and message
4. WHEN SMS is sent via Twilio, THE System SHALL receive delivery status and store it in SMS campaign record
5. WHEN a user creates an SMS campaign, THE System SHALL store campaign name, message template, recipient list, and scheduled send time
6. WHEN a scheduled SMS campaign time arrives, THE System SHALL automatically send SMS to all recipients
7. WHEN a user queries SMS campaigns, THE System SHALL support filtering by status, date range, and provider
8. WHEN a user views SMS campaign details, THE System SHALL return campaign info, delivery status per recipient, and success rate


### Requirement 13: WhatsApp Integration with Cloud API and Templates

**User Story:** As a communication manager, I want to send WhatsApp messages using templates and webhooks, so that I can communicate with clients via WhatsApp.

#### Acceptance Criteria

1. WHEN a user sends a WhatsApp message, THE System SHALL call WhatsApp Cloud API with recipient phone, template name, and parameters
2. WHEN WhatsApp message is sent, THE System SHALL receive delivery status and store it in WhatsApp campaign record
3. WHEN a user creates a WhatsApp campaign, THE System SHALL store campaign name, template name, recipient list, and scheduled send time
4. WHEN a scheduled WhatsApp campaign time arrives, THE System SHALL automatically send messages to all recipients
5. WHEN WhatsApp webhook is received, THE System SHALL verify webhook signature and process message status updates
6. WHEN a user queries WhatsApp campaigns, THE System SHALL support filtering by status, date range, and template
7. WHEN a user views WhatsApp campaign details, THE System SHALL return campaign info, delivery status per recipient, and success rate
8. WHEN a WhatsApp message is received from a client, THE System SHALL store it and create a support ticket if configured


### Requirement 14: Support Ticket System with Issue Tracking and Assignment

**User Story:** As a support manager, I want to track support tickets with assignment and priority levels, so that I can manage customer issues effectively.

#### Acceptance Criteria

1. WHEN a user creates a support ticket, THE System SHALL store ticket title, description, client ID, priority level, and status
2. WHEN a ticket is created, THE System SHALL generate a unique ticket ID and set initial status to "Open"
3. WHEN a user assigns a ticket to staff, THE System SHALL update the assigned_to field and send notification to assigned staff
4. WHEN a user updates ticket status, THE System SHALL validate status transitions (Open → In Progress → Resolved → Closed)
5. WHEN a user adds a comment to a ticket, THE System SHALL store comment text, author, and timestamp
6. WHEN a ticket is updated, THE System SHALL send notification to assigned staff and ticket creator
7. WHEN a user queries tickets, THE System SHALL support filtering by status, priority, assigned staff, and date range
8. WHEN a user views ticket details, THE System SHALL return ticket info, comments, assignment history, and resolution time


### Requirement 15: Automation Engine with Cron Jobs and Scheduled Workflows

**User Story:** As a system administrator, I want to schedule automated workflows and cron jobs, so that I can automate repetitive tasks.

#### Acceptance Criteria

1. WHEN a user creates an automation rule, THE System SHALL store trigger type, trigger condition, action type, and action parameters
2. WHEN an automation rule is created, THE System SHALL validate trigger and action configurations
3. WHEN a scheduled automation time arrives, THE System SHALL execute the automation action and log the execution
4. WHEN an automation action fails, THE System SHALL retry up to 3 times with exponential backoff
5. WHEN an automation action completes, THE System SHALL log the result and send notification if configured
6. WHEN a user queries automations, THE System SHALL support filtering by status, trigger type, and last execution date
7. WHEN a user views automation details, THE System SHALL return automation config, execution history, and success rate
8. WHEN a user disables an automation, THE System SHALL stop scheduling new executions and log the change


### Requirement 16: Real-time Features with Socket.IO and Live Notifications

**User Story:** As a user, I want to receive real-time notifications and activity updates, so that I can stay informed of system events.

#### Acceptance Criteria

1. WHEN a user connects to Socket.IO, THE System SHALL authenticate the connection using JWT token
2. WHEN a system event occurs (ticket update, payment received, alert), THE System SHALL emit a real-time notification to subscribed users
3. WHEN a user subscribes to a channel (e.g., client updates), THE System SHALL add the user to the channel and send confirmation
4. WHEN a user unsubscribes from a channel, THE System SHALL remove the user from the channel
5. WHEN a user is offline, THE System SHALL queue notifications and deliver them on reconnection
6. WHEN a user views the activity feed, THE System SHALL return recent system events filtered by user permissions
7. WHEN a notification is delivered, THE System SHALL log the delivery with timestamp and user ID
8. WHEN a user marks a notification as read, THE System SHALL update the notification status and log the action


### Requirement 17: Email System with Nodemailer and HTML Templates

**User Story:** As a system administrator, I want to send emails with HTML templates for OTP, invoices, and notifications, so that I can communicate with users professionally.

#### Acceptance Criteria

1. WHEN a user requests OTP, THE System SHALL render OTP email template with code and send via Nodemailer
2. WHEN an invoice is created, THE System SHALL render invoice email template with invoice details and send to client
3. WHEN a support ticket is created, THE System SHALL render ticket confirmation email and send to client
4. WHEN a user is invited, THE System SHALL render invitation email with setup link and send to user email
5. WHEN an email is sent, THE System SHALL log the email with recipient, subject, and timestamp
6. WHEN email sending fails, THE System SHALL retry up to 3 times with exponential backoff
7. WHEN a user updates email preferences, THE System SHALL respect unsubscribe requests and skip sending to opted-out users
8. WHEN a user views email logs, THE System SHALL return sent emails filtered by recipient, date range, and status


### Requirement 18: Audit and Activity Logging with Comprehensive Tracking

**User Story:** As a compliance officer, I want to track all system actions and user activities, so that I can maintain audit trails for compliance.

#### Acceptance Criteria

1. WHEN a user performs an action (create, update, delete), THE System SHALL log the action with user ID, timestamp, IP address, and action details
2. WHEN a user logs in, THE System SHALL log the login with user ID, timestamp, IP address, and device fingerprint
3. WHEN a user logs out, THE System SHALL log the logout with user ID and timestamp
4. WHEN a user accesses sensitive data (vault, client info), THE System SHALL log the access with user ID, timestamp, and IP address
5. WHEN a user's role is changed, THE System SHALL log the role change with old role, new role, and changed by user ID
6. WHEN a user queries audit logs, THE System SHALL support filtering by user, action type, date range, and resource type
7. WHEN a user views audit log details, THE System SHALL return action info, user info, timestamp, and IP address
8. WHEN audit logs are queried, THE System SHALL return results in reverse chronological order with pagination support


### Requirement 19: DevOps Module with Server Monitoring and SSL Tracking

**User Story:** As a DevOps engineer, I want to monitor servers, Docker containers, and SSL certificates, so that I can ensure infrastructure health.

#### Acceptance Criteria

1. WHEN a user creates a server monitoring record, THE System SHALL store server name, IP address, monitoring status, and alert threshold
2. WHEN server health metrics are received, THE System SHALL store CPU, RAM, disk, and network metrics with timestamp
3. WHEN a metric exceeds alert threshold, THE System SHALL trigger an alert notification
4. WHEN a user queries server metrics, THE System SHALL support filtering by server, metric type, and date range
5. WHEN a user views server details, THE System SHALL return current metrics, historical trends, and uptime percentage
6. WHEN a Docker container status changes, THE System SHALL log the change and send notification if configured
7. WHEN an SSL certificate expiration date approaches, THE System SHALL trigger a renewal reminder
8. WHEN a user views DevOps dashboard, THE System SHALL return overall infrastructure health, alert count, and critical issues


### Requirement 20: Backup System with Database and File Backups

**User Story:** As a system administrator, I want to schedule and manage database and file backups, so that I can ensure data recovery capability.

#### Acceptance Criteria

1. WHEN a backup schedule is created, THE System SHALL store backup type (database/files), frequency, retention days, and storage location
2. WHEN a scheduled backup time arrives, THE System SHALL execute the backup and store backup file with timestamp
3. WHEN a database backup is created, THE System SHALL dump the entire database and compress it
4. WHEN a file backup is created, THE System SHALL archive all uploaded files and compress the archive
5. WHEN a backup completes, THE System SHALL log the backup with size, duration, and status
6. WHEN a backup fails, THE System SHALL retry and send alert notification
7. WHEN a user queries backups, THE System SHALL support filtering by type, date range, and status
8. WHEN a user initiates a restore, THE System SHALL verify backup integrity and restore data to specified point in time


### Requirement 21: API Response Standard and Error Handling

**User Story:** As a frontend developer, I want consistent API response formats and clear error messages, so that I can handle responses predictably.

#### Acceptance Criteria

1. WHEN an API request succeeds, THE System SHALL return response with success=true, message, data object, and optional meta object
2. WHEN an API request fails, THE System SHALL return response with success=false, error message, error code, and optional details
3. WHEN a validation error occurs, THE System SHALL return 400 Bad Request with field-level error details
4. WHEN an authentication error occurs, THE System SHALL return 401 Unauthorized with error message
5. WHEN an authorization error occurs, THE System SHALL return 403 Forbidden with error message
6. WHEN a resource is not found, THE System SHALL return 404 Not Found with error message
7. WHEN a server error occurs, THE System SHALL return 500 Internal Server Error with error ID for tracking
8. WHEN a request is rate-limited, THE System SHALL return 429 Too Many Requests with retry-after header


### Requirement 22: Security Implementation with Helmet, Rate Limiting, and Input Validation

**User Story:** As a security officer, I want the system to implement comprehensive security measures, so that I can protect against common attacks.

#### Acceptance Criteria

1. WHEN the API starts, THE System SHALL apply Helmet middleware to set secure HTTP headers (CSP, X-Frame-Options, X-Content-Type-Options)
2. WHEN a request is received, THE System SHALL validate input using Zod schema and reject invalid requests with 400 Bad Request
3. WHEN a request exceeds rate limit (100 requests per 15 minutes), THE System SHALL return 429 Too Many Requests
4. WHEN a request contains SQL injection patterns, THE System SHALL sanitize input and log the attempt
5. WHEN a request contains XSS patterns, THE System SHALL sanitize input and log the attempt
6. WHEN a CSRF token is missing or invalid, THE System SHALL return 403 Forbidden
7. WHEN a password is stored, THE System SHALL hash it using bcrypt with salt rounds of 10
8. WHEN a request is received, THE System SHALL log IP address and user agent for security tracking


### Requirement 23: Database Schema and Data Persistence

**User Story:** As a database administrator, I want a well-structured database schema with proper relationships, so that I can manage data integrity.

#### Acceptance Criteria

1. THE System SHALL create and maintain tables for: Users, Clients, Projects, Hosting, Domains, VPS, PasswordVault, Files, Invoices, Quotes, Transactions, SupportTickets, SMSCampaigns, WhatsAppCampaigns, Staff, Automations, APIIntegrations, AuditLogs, Sessions, Notifications
2. WHEN the database is initialized, THE System SHALL create all tables with proper indexes on frequently queried columns
3. WHEN a record is created, THE System SHALL store created_at timestamp automatically
4. WHEN a record is updated, THE System SHALL update updated_at timestamp automatically
5. WHEN a record is deleted, THE System SHALL soft-delete by setting deleted_at timestamp instead of removing the record
6. WHEN a foreign key relationship is violated, THE System SHALL return a database error and log the violation
7. WHEN a database migration is needed, THE System SHALL provide migration scripts that can be run safely
8. WHEN a user queries data, THE System SHALL apply soft-delete filters automatically to exclude deleted records


## Deployment Requirements

### Requirement 24: cPanel Node.js App Deployment Compatibility

**User Story:** As a DevOps engineer, I want to deploy the backend to cPanel Node.js App, so that I can host on shared hosting environments.

#### Acceptance Criteria

1. WHEN the application starts on cPanel, THE System SHALL read environment variables from cPanel UI configuration
2. WHEN the application runs on cPanel, THE System SHALL listen on the port assigned by cPanel (typically 3000+)
3. WHEN the application is deployed to cPanel, THE System SHALL use cPanel's MySQL database with prefixed names
4. WHEN the application starts, THE System SHALL verify database connectivity and log connection status
5. WHEN the application is restarted via cPanel, THE System SHALL gracefully shutdown existing connections and restart cleanly
6. WHEN the application runs on cPanel, THE System SHALL support Passenger reverse proxy without requiring nginx configuration
7. WHEN the application is deployed, THE System SHALL include migration scripts that can be run via cPanel terminal
8. WHEN the application is deployed, THE System SHALL support Node.js versions 18 and 20 on cPanel


### Requirement 25: PM2 Process Manager Support

**User Story:** As a DevOps engineer, I want to manage the application with PM2, so that I can ensure process reliability and auto-restart.

#### Acceptance Criteria

1. WHEN the application is started with PM2, THE System SHALL start successfully and listen on configured port
2. WHEN the application crashes, THE System SHALL be automatically restarted by PM2
3. WHEN the application is deployed, THE System SHALL include PM2 ecosystem configuration file
4. WHEN PM2 is configured, THE System SHALL support clustering mode for multi-core utilization
5. WHEN the application is running under PM2, THE System SHALL log to PM2 log files with rotation
6. WHEN PM2 is restarted, THE System SHALL restore saved process list and restart all applications
7. WHEN the application is deployed, THE System SHALL support PM2 startup on system boot
8. WHEN the application is running, THE System SHALL expose PM2 metrics for monitoring


### Requirement 26: VPS Deployment Readiness

**User Story:** As a DevOps engineer, I want to deploy the backend to a VPS, so that I can have full control over the infrastructure.

#### Acceptance Criteria

1. WHEN the application is deployed to a VPS, THE System SHALL support Ubuntu 20.04 LTS and later
2. WHEN the application is deployed, THE System SHALL include installation scripts for dependencies (Node.js, MySQL, nginx)
3. WHEN the application is deployed, THE System SHALL support nginx reverse proxy with SSL termination
4. WHEN the application is deployed, THE System SHALL include systemd service file for process management
5. WHEN the application is deployed, THE System SHALL support automatic SSL certificate renewal via Let's Encrypt
6. WHEN the application is deployed, THE System SHALL include firewall configuration recommendations
7. WHEN the application is deployed, THE System SHALL support database backup scripts
8. WHEN the application is deployed, THE System SHALL include monitoring and alerting setup instructions


### Requirement 27: Environment Configuration and .env Management

**User Story:** As a DevOps engineer, I want to manage environment variables securely, so that I can configure the application for different environments.

#### Acceptance Criteria

1. WHEN the application starts, THE System SHALL load environment variables from .env file or system environment
2. WHEN the application starts, THE System SHALL validate all required environment variables are present
3. WHEN a required environment variable is missing, THE System SHALL log an error and exit with status code 1
4. WHEN the application is deployed, THE System SHALL include .env.example with all required variables documented
5. WHEN the application is deployed, THE System SHALL support different configurations for development, staging, and production
6. WHEN the application is deployed, THE System SHALL never commit .env file to version control
7. WHEN the application is deployed, THE System SHALL support environment variable overrides via command-line arguments
8. WHEN the application is deployed, THE System SHALL log which environment it is running in (development/staging/production)


### Requirement 28: Database Migration Scripts

**User Story:** As a database administrator, I want to run migration scripts to initialize and update the database schema, so that I can manage schema changes safely.

#### Acceptance Criteria

1. WHEN a migration script is executed, THE System SHALL create all required tables with proper schema
2. WHEN a migration script is executed, THE System SHALL create indexes on frequently queried columns
3. WHEN a migration script is executed, THE System SHALL create foreign key relationships between tables
4. WHEN a migration script is executed, THE System SHALL be idempotent (safe to run multiple times)
5. WHEN a migration script is executed, THE System SHALL log all schema changes with timestamp
6. WHEN a migration script fails, THE System SHALL rollback changes and log the error
7. WHEN a user runs migrations, THE System SHALL support both forward and backward migrations
8. WHEN a user queries migration status, THE System SHALL return list of applied migrations and pending migrations


## Acceptance Criteria Testing Strategy

### Property-Based Testing Guidance

For the following acceptance criteria, property-based testing is recommended:

1. **Requirement 1 (Authentication)**: Test that valid credentials always produce valid JWT tokens, and invalid credentials always fail
2. **Requirement 10 (Billing)**: Test that invoice calculations are always correct (subtotal + tax = total) for any combination of items and tax rates
3. **Requirement 23 (Database)**: Test that soft-delete filters always exclude deleted records from queries
4. **Requirement 22 (Security)**: Test that bcrypt hashing always produces different hashes for the same password (due to salt)

### Integration Testing Guidance

For the following acceptance criteria, integration testing with 1-3 representative examples is recommended:

1. **Requirement 11 (Payment Integration)**: Test M-Pesa, IntaSend, and Paystack webhook callbacks with mock responses
2. **Requirement 12 (SMS Engine)**: Test Africa's Talking and Twilio API calls with mock responses
3. **Requirement 13 (WhatsApp)**: Test WhatsApp Cloud API calls and webhook processing with mock responses
4. **Requirement 24-28 (Deployment)**: Test deployment to cPanel, PM2, and VPS with representative configurations

### Unit Testing Guidance

For the following acceptance criteria, unit tests with representative examples are recommended:

1. **Requirement 2 (RBAC)**: Test role permission checks for each of the 6 roles
2. **Requirement 3 (Client Management)**: Test client creation, update, and soft-delete operations
3. **Requirement 4 (Project Management)**: Test project status transitions and budget calculations
4. **Requirement 5-9 (Hosting, Domain, VPS, Vault, Files)**: Test CRUD operations and validation logic

