const fs = require("fs");
const path = require("path");
const db = require("../config/db");

/**
 * Migration Runner - Manages database migrations with up/down functionality
 */
class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname);
  }

  /**
   * Get all migration files sorted by timestamp
   */
  async getMigrations() {
    const files = fs.readdirSync(this.migrationsDir);
    return files
      .filter((f) => f.match(/^\d{14}_.*\.js$/) && f !== "migration-runner.js")
      .sort();
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    try {
      const result = await db.query(
        "SELECT migration_name FROM migrations ORDER BY applied_at ASC"
      );
      return result.map((r) => r.migration_name);
    } catch (err) {
      // Table doesn't exist yet
      return [];
    }
  }

  /**
   * Initialize migrations table
   */
  async initMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_migration_name (migration_name)
      ) ENGINE=InnoDB;
    `;
    await db.query(sql);
  }

  /**
   * Run all pending migrations
   */
  async up() {
    await this.initMigrationsTable();

    const allMigrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = allMigrations.filter(
      (m) => !appliedMigrations.includes(m)
    );

    if (pendingMigrations.length === 0) {
      console.log("[migrations] ✓ All migrations are up to date");
      return;
    }

    for (const migrationFile of pendingMigrations) {
      try {
        const migration = require(path.join(this.migrationsDir, migrationFile));
        console.log(`[migrations] ↑ Running: ${migrationFile}`);

        await migration.up(db);

        await db.query(
          "INSERT INTO migrations (migration_name) VALUES (?)",
          [migrationFile]
        );

        console.log(`[migrations] ✓ Applied: ${migrationFile}`);
      } catch (err) {
        console.error(`[migrations] ✗ Failed: ${migrationFile}`);
        console.error(err.message);
        throw err;
      }
    }

    console.log(
      `[migrations] ✓ Successfully applied ${pendingMigrations.length} migration(s)`
    );
  }

  /**
   * Rollback the last migration
   */
  async down() {
    await this.initMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      console.log("[migrations] ✓ No migrations to rollback");
      return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];

    try {
      const migration = require(path.join(this.migrationsDir, lastMigration));
      console.log(`[migrations] ↓ Rolling back: ${lastMigration}`);

      await migration.down(db);

      await db.query("DELETE FROM migrations WHERE migration_name = ?", [
        lastMigration,
      ]);

      console.log(`[migrations] ✓ Rolled back: ${lastMigration}`);
    } catch (err) {
      console.error(`[migrations] ✗ Rollback failed: ${lastMigration}`);
      console.error(err.message);
      throw err;
    }
  }

  /**
   * Rollback all migrations
   */
  async downAll() {
    await this.initMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();

    if (appliedMigrations.length === 0) {
      console.log("[migrations] ✓ No migrations to rollback");
      return;
    }

    // Rollback in reverse order
    for (let i = appliedMigrations.length - 1; i >= 0; i--) {
      const migrationFile = appliedMigrations[i];

      try {
        const migration = require(path.join(this.migrationsDir, migrationFile));
        console.log(`[migrations] ↓ Rolling back: ${migrationFile}`);

        await migration.down(db);

        await db.query("DELETE FROM migrations WHERE migration_name = ?", [
          migrationFile,
        ]);

        console.log(`[migrations] ✓ Rolled back: ${migrationFile}`);
      } catch (err) {
        console.error(`[migrations] ✗ Rollback failed: ${migrationFile}`);
        console.error(err.message);
        throw err;
      }
    }

    console.log(
      `[migrations] ✓ Successfully rolled back all ${appliedMigrations.length} migration(s)`
    );
  }

  /**
   * Get migration status
   */
  async status() {
    await this.initMigrationsTable();

    const allMigrations = await this.getMigrations();
    const appliedMigrations = await this.getAppliedMigrations();

    console.log("\n[migrations] Status:");
    console.log("─".repeat(60));

    if (allMigrations.length === 0) {
      console.log("No migrations found");
      return;
    }

    for (const migration of allMigrations) {
      const status = appliedMigrations.includes(migration) ? "✓" : "○";
      console.log(`${status} ${migration}`);
    }

    console.log("─".repeat(60));
    console.log(
      `Applied: ${appliedMigrations.length}/${allMigrations.length}\n`
    );
  }
}

module.exports = MigrationRunner;
