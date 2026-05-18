const db = require("../config/db");

async function summary(req, res, next) {
  try {
    const [[clients], [revenue], [hosting], [domains], [tickets]] = await Promise.all([
      db.query("SELECT COUNT(*) AS count FROM clients").then((r) => r),
      db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status = 'paid'").then((r) => r),
      db.query("SELECT COUNT(*) AS count FROM hosting_accounts WHERE status = 'active'").then((r) => r),
      db.query("SELECT COUNT(*) AS count FROM domains WHERE status = 'active'").then((r) => r),
      db.query("SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'open'").then((r) => r),
    ]);

    res.json({
      clients: clients?.count ?? 0,
      revenue: Number(revenue?.total ?? 0),
      hosting: hosting?.count ?? 0,
      domains: domains?.count ?? 0,
      openTickets: tickets?.count ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary };
