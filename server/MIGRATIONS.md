# Database Migrations Guide

## Overview

The ABANCOOL Command Center uses a custom migration system for database versioning and schema management. This system provides:

- **Version Control**: Track all database schema changes
- **Reversibility**: Rollback migrations if needed
- **Consistency**: Ensure all environments have the same schema
- **Auditability**: Track which migrations have been applied

## Migration Files

All migration files are located in `src/migrations/` and follow the naming convention:

```
YYYYMMDDHHMMSS_description.js
```

Example: `20240101000001_create_users_table.js`

## Migration Structure

Each migration file exports two functions:

```javascript
exports.up = async (db) => {
  // Code to apply the migration
  await db.query(sql);
};

exports.down = async (db) => {
  // Code to rollback the migration
  await db.query(sql);
};
```

## Available Commands

### Run All Pending Migrations

```bash
npm run migrate
```

This will:
1. Create the `migrations` table if it doesn't exist
2. Identify pending migrations
3. Execute each migration in order
4. Record each applied migration

### Rollback Last Migration

```bash
npm run migrate:down
```

This will:
1. Identify the last applied migration
2. Execute its `down` function
3. Remove the migration record

### Rollback All Migrations

```bash
npm run migrate:down-all
```

This will:
1. Rollback all applied migrations in reverse order
2. Remove all migration records

### Check Migration Status

```bash
npm run migrate:status
```

This will display:
- List of all migrations
- Status of each migration (✓ applied, ○ pending)
- Count of applied vs total migrations

## Database Schema

### Migrations Table

The system automatically creates a `migrations` table to track applied migrations:

```sql
CREATE TABLE migrations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  migration_name VARCHAR(255) UNIQUE NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_migration_name (migration_name)
);
```

## Tables Created

The migration system creates the following tables:

1. **users** - User accounts with authentication fields
2. **user_roles** - Role-based access control (RBAC)
3. **sessions** - JWT token tracking and device fingerprinting
4. **clients** - Client company information
5. **contacts** - Client contact information
6. **projects** - Project tracking with budgets
7. **project_team** - Project team member assignments
8. **hosting** - cPanel hosting accounts
9. **domains** - Domain registration tracking
10. **vps** - VPS server management
11. **password_vault** - Encrypted credential storage
12. **files** - File management with download tokens
13. **invoices** - Billing invoices
14. **invoice_items** - Invoice line items
15. **quotes** - Pricing quotes
16. **quote_items** - Quote line items
17. **transactions** - Payment transactions
18. **support_tickets** - Support ticket tracking
19. **ticket_comments** - Support ticket comments
20. **sms_campaigns** - SMS campaign tracking
21. **whatsapp_campaigns** - WhatsApp campaign tracking
22. **audit_logs** - Comprehensive action logging
23. **notifications** - Real-time notifications

## Seeding Initial Data

After running migrations, seed the database with initial data:

```bash
npm run seed
```

This will create:
- 1 Super Admin user
- 4 Staff users (Developer, Support, Finance, Sales)
- 3 Sample clients
- 6 Sample contacts
- 3 Sample projects
- 3 Sample hosting accounts
- 3 Sample domains
- 2 Sample VPS servers
- 3 Sample invoices with items
- 6 Sample support tickets with comments

### Default Credentials

After seeding, use these credentials to login:

**Super Admin:**
- Email: `admin@abancool.com`
- Password: `Admin@123456`

**Staff Users:**
- Email: `{role}@abancool.com` (e.g., `developer@abancool.com`)
- Password: `Staff@123456`

## Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure database in .env
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=password
# DB_NAME=abancool

# 3. Run migrations
npm run migrate

# 4. Seed initial data
npm run seed

# 5. Start development server
npm run dev
```

### Making Schema Changes

1. Create a new migration file:
   ```bash
   # Use current timestamp for filename
   touch src/migrations/20240115143022_add_column_to_users.js
   ```

2. Implement the migration:
   ```javascript
   exports.up = async (db) => {
     await db.query(`ALTER TABLE users ADD COLUMN new_column VARCHAR(255);`);
   };

   exports.down = async (db) => {
     await db.query(`ALTER TABLE users DROP COLUMN new_column;`);
   };
   ```

3. Run the migration:
   ```bash
   npm run migrate
   ```

4. Test the rollback:
   ```bash
   npm run migrate:down
   npm run migrate
   ```

## Best Practices

### Migration Guidelines

1. **One Change Per Migration**: Each migration should make a single logical change
2. **Reversible**: Always implement both `up` and `down` functions
3. **Idempotent**: Use `IF NOT EXISTS` and `IF EXISTS` clauses
4. **Descriptive Names**: Use clear, descriptive migration names
5. **Test Rollbacks**: Always test that migrations can be rolled back
6. **No Data Loss**: Avoid destructive operations without backup strategy

### SQL Best Practices

1. **Use Transactions**: Wrap multiple statements in transactions
2. **Add Indexes**: Index frequently queried columns
3. **Set Defaults**: Provide sensible default values
4. **Use Constraints**: Enforce data integrity with foreign keys
5. **Charset**: Use UTF-8 for international character support

## Troubleshooting

### Migration Failed

If a migration fails:

1. Check the error message
2. Verify database connectivity
3. Check for syntax errors in the migration file
4. Ensure the migration hasn't already been applied
5. Check database permissions

### Rollback Issues

If a rollback fails:

1. Manually verify the database state
2. Check if the migration was actually applied
3. Review the `down` function for errors
4. Consider manual cleanup if needed

### Duplicate Migration Names

If you see duplicate migration errors:

1. Check the migrations table for duplicates
2. Manually remove duplicate records if necessary
3. Ensure migration filenames are unique

## Environment-Specific Migrations

For environment-specific changes, use environment variables:

```javascript
exports.up = async (db) => {
  if (process.env.NODE_ENV === 'production') {
    // Production-specific migration
  } else {
    // Development migration
  }
};
```

## Performance Considerations

- Migrations run sequentially to ensure consistency
- Large migrations may take time on production databases
- Consider running migrations during maintenance windows
- Monitor database performance during migrations
- Test migrations on staging before production

## Backup Strategy

Before running migrations on production:

1. Create a database backup
2. Test migrations on a staging environment
3. Have a rollback plan ready
4. Monitor the migration process
5. Verify data integrity after migration

## Support

For migration issues or questions:

1. Check this documentation
2. Review migration files in `src/migrations/`
3. Check database logs for errors
4. Consult the design document for schema details
