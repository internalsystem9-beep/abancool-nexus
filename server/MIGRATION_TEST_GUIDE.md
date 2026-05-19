# Migration System Test Guide

## Prerequisites

Before testing the migration system, ensure:

1. **MySQL Server Running**: The database server must be running
2. **Database Created**: Create the development database
3. **.env Configured**: Database credentials must be set in `.env`

## Setup Instructions

### 1. Create Development Database

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE abancool_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Exit MySQL
EXIT;
```

### 2. Configure .env File

The `.env` file has been created with default development settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=abancool_dev
```

Adjust these values if your MySQL setup is different.

### 3. Install Dependencies

```bash
npm install
```

## Testing the Migration System

### Test 1: Check Migration Status

```bash
npm run migrate:status
```

**Expected Output:**
```
[migrations] Status:
────────────────────────────────────────────────────────
○ 20240101000001_create_users_table.js
○ 20240101000002_create_user_roles_table.js
○ 20240101000003_create_sessions_table.js
... (more migrations)
────────────────────────────────────────────────────────
Applied: 0/23
```

### Test 2: Run All Migrations (Up)

```bash
npm run migrate
```

**Expected Output:**
```
[migrations] ↑ Running: 20240101000001_create_users_table.js
[migrations] ✓ Applied: 20240101000001_create_users_table.js
[migrations] ↑ Running: 20240101000002_create_user_roles_table.js
[migrations] ✓ Applied: 20240101000002_create_user_roles_table.js
... (more migrations)
[migrations] ✓ Successfully applied 23 migration(s)
```

### Test 3: Verify Database Tables

After running migrations, verify all tables were created:

```bash
mysql -u root abancool_dev -e "SHOW TABLES;"
```

**Expected Output:**
```
Tables_in_abancool_dev
audit_logs
clients
contacts
domains
files
hosting
invoice_items
invoices
migrations
notifications
password_vault
project_team
projects
quote_items
quotes
sessions
sms_campaigns
support_tickets
ticket_comments
transactions
user_roles
users
vps
whatsapp_campaigns
```

### Test 4: Check Migration Status After Running

```bash
npm run migrate:status
```

**Expected Output:**
```
[migrations] Status:
────────────────────────────────────────────────────────
✓ 20240101000001_create_users_table.js
✓ 20240101000002_create_user_roles_table.js
✓ 20240101000003_create_sessions_table.js
... (all marked as applied)
────────────────────────────────────────────────────────
Applied: 23/23
```

### Test 5: Rollback Last Migration

```bash
npm run migrate:down
```

**Expected Output:**
```
[migrations] ↓ Rolling back: 20240101000023_create_notifications_table.js
[migrations] ✓ Rolled back: 20240101000023_create_notifications_table.js
```

### Test 6: Verify Rollback

```bash
npm run migrate:status
```

**Expected Output:**
```
Applied: 22/23
```

### Test 7: Re-apply Rolled Back Migration

```bash
npm run migrate
```

**Expected Output:**
```
[migrations] ↑ Running: 20240101000023_create_notifications_table.js
[migrations] ✓ Applied: 20240101000023_create_notifications_table.js
[migrations] ✓ Successfully applied 1 migration(s)
```

### Test 8: Seed Initial Data

```bash
npm run seed
```

**Expected Output:**
```
[seed] Starting database seeding...

[seed] Creating super admin user...
✓ Super Admin created (ID: 1)
[seed] Assigning super admin role...
✓ Super admin role assigned
[seed] Creating staff users...
✓ Dev user created (developer)
✓ Support user created (support)
✓ Finance user created (finance)
✓ Sales user created (sales)

[seed] Creating sample clients...
✓ Client created: Tech Solutions Ltd
✓ Client created: Digital Marketing Agency
✓ Client created: E-Commerce Store

... (more seeding output)

[seed] ✓ Database seeding completed successfully!
```

### Test 9: Verify Seeded Data

```bash
# Check users
mysql -u root abancool_dev -e "SELECT id, email, status FROM users LIMIT 5;"

# Check clients
mysql -u root abancool_dev -e "SELECT id, company_name, status FROM clients;"

# Check projects
mysql -u root abancool_dev -e "SELECT id, project_name, status FROM projects;"
```

### Test 10: Rollback All Migrations

```bash
npm run migrate:down-all
```

**Expected Output:**
```
[migrations] ↓ Rolling back: 20240101000023_create_notifications_table.js
[migrations] ✓ Rolled back: 20240101000023_create_notifications_table.js
[migrations] ↓ Rolling back: 20240101000022_create_audit_logs_table.js
[migrations] ✓ Rolled back: 20240101000022_create_audit_logs_table.js
... (all migrations rolled back)
[migrations] ✓ Successfully rolled back all 23 migration(s)
```

### Test 11: Verify All Tables Removed

```bash
mysql -u root abancool_dev -e "SHOW TABLES;"
```

**Expected Output:**
```
Empty set (0.00 sec)
```

## Troubleshooting

### Database Connection Error

**Error:**
```
Migration failed: Access denied for user ''@'localhost'
```

**Solution:**
- Check `.env` file has correct DB_USER and DB_PASSWORD
- Verify MySQL server is running
- Ensure database exists

### Table Already Exists Error

**Error:**
```
Migration failed: Table 'users' already exists
```

**Solution:**
- Run `npm run migrate:down-all` to rollback all migrations
- Or manually drop the database and recreate it

### Foreign Key Constraint Error

**Error:**
```
Migration failed: Cannot add or update a child row
```

**Solution:**
- Ensure migrations are run in order
- Check that parent tables are created before child tables
- Verify foreign key references are correct

### Migration File Not Found

**Error:**
```
Migration failed: Cannot find module
```

**Solution:**
- Verify migration files exist in `src/migrations/`
- Check file naming follows the pattern: `YYYYMMDDHHMMSS_description.js`
- Ensure migration files export `up` and `down` functions

## Performance Notes

- Initial migration run: ~2-5 seconds
- Seeding: ~5-10 seconds
- Rollback: ~1-3 seconds

Times vary based on system performance and MySQL configuration.

## Next Steps

After successful migration and seeding:

1. **Start Development Server:**
   ```bash
   npm run dev
   ```

2. **Test API Endpoints:**
   - Login with admin credentials
   - Create new resources
   - Verify audit logs

3. **Monitor Logs:**
   - Check console output for errors
   - Review database logs if issues occur

## Database Backup

Before making schema changes, backup your database:

```bash
# Backup database
mysqldump -u root abancool_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
mysql -u root abancool_dev < backup_20240115_143022.sql
```

## Additional Resources

- See `MIGRATIONS.md` for detailed migration documentation
- See `design.md` for database schema details
- See `requirements.md` for feature requirements
