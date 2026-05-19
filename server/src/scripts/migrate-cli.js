#!/usr/bin/env node

const MigrationRunner = require("../migrations/migration-runner");

const command = process.argv[2] || "up";

(async () => {
  try {
    const runner = new MigrationRunner();

    switch (command) {
      case "up":
        await runner.up();
        break;
      case "down":
        await runner.down();
        break;
      case "down-all":
        await runner.downAll();
        break;
      case "status":
        await runner.status();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log("Available commands: up, down, down-all, status");
        process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
})();
