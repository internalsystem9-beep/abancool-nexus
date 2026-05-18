/**
 * Bootstrap an admin user. Usage:
 *   node src/scripts/create-admin.js "Admin Name" admin@example.com SuperSecret123
 */
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const config = require("../config");

(async () => {
  const [, , name, email, password] = process.argv;
  if (!name || !email || !password) {
    console.error('Usage: node src/scripts/create-admin.js "Name" email@x.com Password');
    process.exit(1);
  }
  try {
    const hash = await bcrypt.hash(password, config.bcryptRounds);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
      [name, email, hash]
    );
    console.log(`[create-admin] ✔ ${email}`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
