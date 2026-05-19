# Quick Start Guide - Database Setup

## 5-Minute Setup

### 1. Create Database

```bash
mysql -u root -p
CREATE DATABASE abancool_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Migrations

```bash
npm run migrate
```

### 4. Seed Data

```bash
npm run seed
```

### 5. Start Server

```bash
npm run dev
```

## Default Credentials

**Admin:**
- Email: `admin@abancool.com`
- Password: `Admin@123456`

**Staff:**
- Email: `{role}@abancool.com` (e.g., `developer@abancool.com`)
- Password: `Staff@123456`

## Common Commands

```bash
# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down

# Rollback all migrations
npm run migrate:down-all

# Reseed database
npm run migrate:down-all && npm run migrate && npm run seed
```

## Database Tables

23 tables created:
- Users, UserRoles, Sessions
- Clients, Contacts
- Projects, ProjectTeam
- Hosting, Domains, VPS
- PasswordVault, Files
- Invoices, InvoiceItems, Quotes, QuoteItems, Transactions
- SupportTickets, TicketComments
- SMSCampaigns, WhatsAppCampaigns
- AuditLogs, Notifications

## Configuration

Edit `.env` for database settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=abancool_dev
```

## Documentation

- `MIGRATIONS.md` - Complete migration guide
- `MIGRATION_TEST_GUIDE.md` - Testing procedures
- `TASK_1_IMPLEMENTATION_SUMMARY.md` - Full implementation details

## Troubleshooting

**Connection Error?**
- Check MySQL is running
- Verify `.env` database credentials
- Ensure database exists

**Migration Failed?**
- Run `npm run migrate:status` to check status
- Run `npm run migrate:down-all` to reset
- Check error message for details

**Need Fresh Start?**
```bash
# Drop and recreate database
mysql -u root -p -e "DROP DATABASE abancool_dev; CREATE DATABASE abancool_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Re-run migrations and seed
npm run migrate && npm run seed
```

## Next Steps

1. Start the development server: `npm run dev`
2. Test API endpoints with Postman or curl
3. Implement authentication (Task 2)
4. Build API endpoints (Tasks 3+)

## Support

See documentation files for detailed information:
- Migration issues → `MIGRATIONS.md`
- Testing → `MIGRATION_TEST_GUIDE.md`
- Implementation details → `TASK_1_IMPLEMENTATION_SUMMARY.md`
