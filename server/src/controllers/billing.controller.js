/**
 * Billing Engine Controller
 * Handles invoice and quote management with automatic tax calculations
 */

const db = require("../config/db");
const crypto = require("crypto");
const { z } = require("zod");

/**
 * Generate unique invoice number with date prefix
 * Format: INV-2024-001, INV-2024-002, etc.
 */
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}`;

  // Get the highest number for this year
  const result = await db.query(
    `SELECT MAX(CAST(SUBSTRING(invoice_number, LENGTH(?) + 2) AS UNSIGNED)) as max_num
     FROM invoices WHERE invoice_number LIKE ? AND deleted_at IS NULL`,
    [prefix, `${prefix}-%`]
  );

  const maxNum = result[0]?.max_num || 0;
  const newNum = maxNum + 1;

  return `${prefix}-${String(newNum).padStart(3, "0")}`;
}

/**
 * Generate unique quote number with date prefix
 * Format: QUOTE-2024-001, QUOTE-2024-002, etc.
 */
async function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `QUOTE-${year}`;

  // Get the highest number for this year
  const result = await db.query(
    `SELECT MAX(CAST(SUBSTRING(quote_number, LENGTH(?) + 2) AS UNSIGNED)) as max_num
     FROM quotes WHERE quote_number LIKE ? AND deleted_at IS NULL`,
    [prefix, `${prefix}-%`]
  );

  const maxNum = result[0]?.max_num || 0;
  const newNum = maxNum + 1;

  return `${prefix}-${String(newNum).padStart(3, "0")}`;
}

/**
 * Generate unique invoice ID
 */
function generateInvoiceId() {
  return "INV_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Generate unique quote ID
 */
function generateQuoteId() {
  return "QUOTE_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Calculate subtotal and tax from line items
 */
function calculateTotals(items, taxRate) {
  let subtotal = 0;

  items.forEach((item) => {
    const lineTotal = item.quantity * item.unit_price;
    subtotal += lineTotal;
  });

  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total_amount: parseFloat(total.toFixed(2)),
  };
}

/**
 * Log billing audit
 */
async function logBillingAudit(userId, action, entityType, entityId, details, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, action, entityType, entityId, JSON.stringify(details || {}), ip, userAgent]
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}

// Validation schemas
const createInvoiceSchema = z.object({
  client_id: z.number().int().positive(),
  tax_rate: z.number().min(0).max(100),
  due_date: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
      })
    )
    .min(1),
});

const createQuoteSchema = z.object({
  client_id: z.number().int().positive(),
  tax_rate: z.number().min(0).max(100),
  expiration_date: z.string().datetime(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
      })
    )
    .min(1),
});

const updateInvoiceSchema = z.object({
  due_date: z.string().datetime().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
      })
    )
    .optional(),
});

/**
 * Create invoice
 * POST /api/invoices
 */
async function createInvoice(req, res, next) {
  try {
    // Validate input
    const validationResult = createInvoiceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { client_id, tax_rate, due_date, items } = validationResult.data;
    const userId = req.user.id;

    // Verify client exists
    const clientResult = await db.query(
      `SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL`,
      [client_id]
    );

    if (clientResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Client not found",
      });
    }

    // Generate invoice number and ID
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceId = generateInvoiceId();

    // Calculate totals
    const { subtotal, tax_amount, total_amount } = calculateTotals(items, tax_rate);

    // Insert invoice
    const result = await db.query(
      `INSERT INTO invoices (invoice_id, client_id, invoice_number, subtotal, tax_amount, total_amount, tax_rate, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, client_id, invoiceNumber, subtotal, tax_amount, total_amount, tax_rate, due_date || null, userId]
    );

    const invoiceDbId = result.insertId;

    // Insert line items
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceDbId, item.description, item.quantity, item.unit_price, lineTotal]
      );
    }

    // Log audit
    await logBillingAudit(userId, "invoice_created", "invoice", invoiceId, { invoice_number: invoiceNumber, client_id }, req);

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        client_id,
        subtotal,
        tax_amount,
        total_amount,
        tax_rate,
        status: "draft",
        payment_status: "unpaid",
        items_count: items.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get invoice details
 * GET /api/invoices/:id
 */
async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE invoice_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Fetch line items
    const items = await db.query(
      `SELECT description, quantity, unit_price, line_total FROM invoice_items WHERE invoice_id = ?`,
      [invoice.id]
    );

    // Fetch payment history (transactions)
    const transactions = await db.query(
      `SELECT transaction_id, payment_method, amount, status, reference_number, created_at
       FROM transactions WHERE invoice_id = ? AND status IN ('completed', 'pending', 'refunded')
       ORDER BY created_at DESC`,
      [invoice.id]
    );

    // Calculate payment summary
    let amountPaid = 0;
    transactions.forEach((txn) => {
      if (txn.status === "completed") {
        amountPaid += txn.amount;
      }
    });

    // Log access
    await logBillingAudit(req.user.id, "invoice_accessed", "invoice", id, { invoice_number: invoice.invoice_number }, req);

    res.json({
      success: true,
      data: {
        invoice_id: invoice.invoice_id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        subtotal: invoice.subtotal,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        tax_rate: invoice.tax_rate,
        status: invoice.status,
        payment_status: invoice.payment_status,
        due_date: invoice.due_date,
        paid_at: invoice.paid_at,
        items,
        payment_history: transactions,
        amount_paid: amountPaid,
        amount_remaining: invoice.total_amount - amountPaid,
        created_at: invoice.created_at,
        updated_at: invoice.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List invoices with filtering
 * GET /api/invoices
 */
async function listInvoices(req, res, next) {
  try {
    const { client_id, status, payment_status, start_date, end_date, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        id, invoice_id, invoice_number, client_id, subtotal, tax_amount, total_amount,
        status, payment_status, due_date, created_at, updated_at
      FROM invoices
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (client_id) {
      query += ` AND client_id = ?`;
      params.push(parseInt(client_id, 10));
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (payment_status) {
      query += ` AND payment_status = ?`;
      params.push(payment_status);
    }

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(new Date(end_date));
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const invoices = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL`;
    const countParams = [];

    if (client_id) {
      countQuery += ` AND client_id = ?`;
      countParams.push(parseInt(client_id, 10));
    }

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    if (payment_status) {
      countQuery += ` AND payment_status = ?`;
      countParams.push(payment_status);
    }

    if (start_date) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(new Date(start_date));
    }

    if (end_date) {
      countQuery += ` AND created_at <= ?`;
      countParams.push(new Date(end_date));
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    // Log access
    await logBillingAudit(req.user.id, "invoices_list_accessed", "invoice", null, { count: invoices.length }, req);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: invoices.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update invoice
 * PUT /api/invoices/:id
 */
async function updateInvoice(req, res, next) {
  try {
    const { id } = req.params;

    // Validate input
    const validationResult = updateInvoiceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE invoice_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];
    const { due_date, tax_rate, items } = validationResult.data;

    // If status is sent or paid, prevent editing
    if (invoice.status !== "draft") {
      return res.status(400).json({
        success: false,
        error: "Only draft invoices can be edited",
      });
    }

    let newTaxRate = invoice.tax_rate;
    if (tax_rate !== undefined) {
      newTaxRate = tax_rate;
    }

    let updateQuery = `UPDATE invoices SET updated_at = NOW()`;
    const updateParams = [];

    if (due_date !== undefined) {
      updateQuery += `, due_date = ?`;
      updateParams.push(due_date);
    }

    if (tax_rate !== undefined) {
      updateQuery += `, tax_rate = ?`;
      updateParams.push(tax_rate);
    }

    // If items provided, recalculate totals
    if (items) {
      const { subtotal, tax_amount, total_amount } = calculateTotals(items, newTaxRate);
      updateQuery += `, subtotal = ?, tax_amount = ?, total_amount = ?`;
      updateParams.push(subtotal, tax_amount, total_amount);

      // Delete old items and insert new ones
      await db.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoice.id]);

      for (const item of items) {
        const lineTotal = item.quantity * item.unit_price;
        await db.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [invoice.id, item.description, item.quantity, item.unit_price, lineTotal]
        );
      }
    }

    updateQuery += ` WHERE invoice_id = ?`;
    updateParams.push(id);

    await db.query(updateQuery, updateParams);

    // Log audit
    await logBillingAudit(req.user.id, "invoice_updated", "invoice", id, { invoice_number: invoice.invoice_number }, req);

    res.json({
      success: true,
      message: "Invoice updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update invoice status
 * PATCH /api/invoices/:id/status
 */
async function updateInvoiceStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE invoice_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Update status
    const paidAt = status === "paid" ? new Date() : null;
    await db.query(
      `UPDATE invoices SET status = ?, ${paidAt ? "paid_at = ?, " : ""}updated_at = NOW() WHERE invoice_id = ?`,
      paidAt ? [status, paidAt, id] : [status, id]
    );

    // Log audit
    await logBillingAudit(userId, "invoice_status_updated", "invoice", id, { new_status: status, old_status: invoice.status }, req);

    res.json({
      success: true,
      message: "Invoice status updated successfully",
      data: {
        invoice_id: id,
        status,
        paid_at: paidAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete invoice (soft delete)
 * DELETE /api/invoices/:id
 */
async function deleteInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE invoice_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Check if invoice has transactions
    const txnResult = await db.query(
      `SELECT COUNT(*) as count FROM transactions WHERE invoice_id = ? AND status = 'completed'`,
      [invoice.id]
    );

    if (txnResult[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete invoice with completed transactions",
      });
    }

    // Soft delete
    await db.query(`UPDATE invoices SET deleted_at = NOW() WHERE invoice_id = ?`, [id]);

    // Log audit
    await logBillingAudit(userId, "invoice_deleted", "invoice", id, { invoice_number: invoice.invoice_number }, req);

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create quote
 * POST /api/quotes
 */
async function createQuote(req, res, next) {
  try {
    // Validate input
    const validationResult = createQuoteSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    const { client_id, tax_rate, expiration_date, items } = validationResult.data;
    const userId = req.user.id;

    // Verify client exists
    const clientResult = await db.query(
      `SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL`,
      [client_id]
    );

    if (clientResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Client not found",
      });
    }

    // Generate quote number and ID
    const quoteNumber = await generateQuoteNumber();
    const quoteId = generateQuoteId();

    // Calculate totals
    const { subtotal, tax_amount, total_amount } = calculateTotals(items, tax_rate);

    // Insert quote
    const result = await db.query(
      `INSERT INTO quotes (quote_id, client_id, quote_number, subtotal, tax_amount, total_amount, tax_rate, expiration_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quoteId, client_id, quoteNumber, subtotal, tax_amount, total_amount, tax_rate, expiration_date, userId]
    );

    const quoteDbId = result.insertId;

    // Insert line items
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      await db.query(
        `INSERT INTO quote_items (quote_id, description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [quoteDbId, item.description, item.quantity, item.unit_price, lineTotal]
      );
    }

    // Log audit
    await logBillingAudit(userId, "quote_created", "quote", quoteId, { quote_number: quoteNumber, client_id }, req);

    res.status(201).json({
      success: true,
      message: "Quote created successfully",
      data: {
        quote_id: quoteId,
        quote_number: quoteNumber,
        client_id,
        subtotal,
        tax_amount,
        total_amount,
        tax_rate,
        expiration_date,
        status: "draft",
        items_count: items.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get quote details
 * GET /api/quotes/:id
 */
async function getQuote(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch quote
    const quoteResult = await db.query(
      `SELECT * FROM quotes WHERE quote_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (quoteResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quote not found",
      });
    }

    const quote = quoteResult[0];

    // Fetch line items
    const items = await db.query(
      `SELECT description, quantity, unit_price, line_total FROM quote_items WHERE quote_id = ?`,
      [quote.id]
    );

    // Check if expired
    const isExpired = new Date() > new Date(quote.expiration_date) && quote.status !== "converted" && quote.status !== "accepted";

    // Auto-update status if expired and not already updated
    if (isExpired && quote.status !== "expired") {
      await db.query(`UPDATE quotes SET status = 'expired' WHERE quote_id = ?`, [id]);
      quote.status = "expired";
    }

    // Log access
    await logBillingAudit(req.user.id, "quote_accessed", "quote", id, { quote_number: quote.quote_number }, req);

    res.json({
      success: true,
      data: {
        quote_id: quote.quote_id,
        quote_number: quote.quote_number,
        client_id: quote.client_id,
        subtotal: quote.subtotal,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        tax_rate: quote.tax_rate,
        status: quote.status,
        expiration_date: quote.expiration_date,
        is_expired: isExpired,
        converted_to_invoice_id: quote.converted_to_invoice_id,
        items,
        created_at: quote.created_at,
        updated_at: quote.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List quotes with filtering
 * GET /api/quotes
 */
async function listQuotes(req, res, next) {
  try {
    const { client_id, status, start_date, end_date, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        id, quote_id, quote_number, client_id, subtotal, tax_amount, total_amount,
        status, expiration_date, created_at, updated_at
      FROM quotes
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (client_id) {
      query += ` AND client_id = ?`;
      params.push(parseInt(client_id, 10));
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(new Date(end_date));
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const quotes = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM quotes WHERE deleted_at IS NULL`;
    const countParams = [];

    if (client_id) {
      countQuery += ` AND client_id = ?`;
      countParams.push(parseInt(client_id, 10));
    }

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    if (start_date) {
      countQuery += ` AND created_at >= ?`;
      countParams.push(new Date(start_date));
    }

    if (end_date) {
      countQuery += ` AND created_at <= ?`;
      countParams.push(new Date(end_date));
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    // Log access
    await logBillingAudit(req.user.id, "quotes_list_accessed", "quote", null, { count: quotes.length }, req);

    res.json({
      success: true,
      data: quotes,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: quotes.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update quote
 * PUT /api/quotes/:id
 */
async function updateQuote(req, res, next) {
  try {
    const { id } = req.params;

    // Validate input
    const validationResult = updateInvoiceSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    // Fetch quote
    const quoteResult = await db.query(
      `SELECT * FROM quotes WHERE quote_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (quoteResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quote not found",
      });
    }

    const quote = quoteResult[0];
    const { expiration_date, tax_rate, items } = req.body;

    // If status is not draft, prevent editing
    if (quote.status !== "draft") {
      return res.status(400).json({
        success: false,
        error: "Only draft quotes can be edited",
      });
    }

    let newTaxRate = quote.tax_rate;
    if (tax_rate !== undefined) {
      newTaxRate = tax_rate;
    }

    let updateQuery = `UPDATE quotes SET updated_at = NOW()`;
    const updateParams = [];

    if (expiration_date !== undefined) {
      updateQuery += `, expiration_date = ?`;
      updateParams.push(expiration_date);
    }

    if (tax_rate !== undefined) {
      updateQuery += `, tax_rate = ?`;
      updateParams.push(tax_rate);
    }

    // If items provided, recalculate totals
    if (items) {
      const { subtotal, tax_amount, total_amount } = calculateTotals(items, newTaxRate);
      updateQuery += `, subtotal = ?, tax_amount = ?, total_amount = ?`;
      updateParams.push(subtotal, tax_amount, total_amount);

      // Delete old items and insert new ones
      await db.query(`DELETE FROM quote_items WHERE quote_id = ?`, [quote.id]);

      for (const item of items) {
        const lineTotal = item.quantity * item.unit_price;
        await db.query(
          `INSERT INTO quote_items (quote_id, description, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?)`,
          [quote.id, item.description, item.quantity, item.unit_price, lineTotal]
        );
      }
    }

    updateQuery += ` WHERE quote_id = ?`;
    updateParams.push(id);

    await db.query(updateQuery, updateParams);

    // Log audit
    await logBillingAudit(req.user.id, "quote_updated", "quote", id, { quote_number: quote.quote_number }, req);

    res.json({
      success: true,
      message: "Quote updated successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update quote status
 * PATCH /api/quotes/:id/status
 */
async function updateQuoteStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["draft", "sent", "accepted", "rejected", "expired"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    // Fetch quote
    const quoteResult = await db.query(
      `SELECT * FROM quotes WHERE quote_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (quoteResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quote not found",
      });
    }

    const quote = quoteResult[0];

    // Update status
    await db.query(`UPDATE quotes SET status = ?, updated_at = NOW() WHERE quote_id = ?`, [status, id]);

    // Log audit
    await logBillingAudit(req.user.id, "quote_status_updated", "quote", id, { new_status: status, old_status: quote.status }, req);

    res.json({
      success: true,
      message: "Quote status updated successfully",
      data: {
        quote_id: id,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Convert quote to invoice
 * POST /api/quotes/:id/convert
 */
async function convertQuoteToInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const { due_date } = req.body;
    const userId = req.user.id;

    // Fetch quote
    const quoteResult = await db.query(
      `SELECT * FROM quotes WHERE quote_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (quoteResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quote not found",
      });
    }

    const quote = quoteResult[0];

    // Check if quote is expired
    if (new Date() > new Date(quote.expiration_date)) {
      return res.status(400).json({
        success: false,
        error: "Cannot convert expired quote to invoice",
      });
    }

    // Check if already converted
    if (quote.status === "converted") {
      return res.status(400).json({
        success: false,
        error: "Quote already converted to invoice",
      });
    }

    // Generate invoice
    const invoiceNumber = await generateInvoiceNumber();
    const invoiceId = generateInvoiceId();

    // Create invoice from quote
    const invoiceResult = await db.query(
      `INSERT INTO invoices (invoice_id, client_id, invoice_number, subtotal, tax_amount, total_amount, tax_rate, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, quote.client_id, invoiceNumber, quote.subtotal, quote.tax_amount, quote.total_amount, quote.tax_rate, due_date || null, userId]
    );

    const invoiceDbId = invoiceResult.insertId;

    // Copy quote items to invoice items
    const quoteItems = await db.query(
      `SELECT description, quantity, unit_price, line_total FROM quote_items WHERE quote_id = ?`,
      [quote.id]
    );

    for (const item of quoteItems) {
      await db.query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [invoiceDbId, item.description, item.quantity, item.unit_price, item.line_total]
      );
    }

    // Update quote status
    await db.query(
      `UPDATE quotes SET status = 'converted', converted_to_invoice_id = ?, updated_at = NOW() WHERE quote_id = ?`,
      [invoiceDbId, id]
    );

    // Log audit
    await logBillingAudit(userId, "quote_converted_to_invoice", "quote", id, { quote_number: quote.quote_number, invoice_number: invoiceNumber }, req);

    res.status(201).json({
      success: true,
      message: "Quote converted to invoice successfully",
      data: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        quote_id: id,
        total_amount: quote.total_amount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete quote (soft delete)
 * DELETE /api/quotes/:id
 */
async function deleteQuote(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Fetch quote
    const quoteResult = await db.query(
      `SELECT * FROM quotes WHERE quote_id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (quoteResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Quote not found",
      });
    }

    const quote = quoteResult[0];

    // Cannot delete converted quotes
    if (quote.status === "converted") {
      return res.status(400).json({
        success: false,
        error: "Cannot delete quote that has been converted to invoice",
      });
    }

    // Soft delete
    await db.query(`UPDATE quotes SET deleted_at = NOW() WHERE quote_id = ?`, [id]);

    // Log audit
    await logBillingAudit(userId, "quote_deleted", "quote", id, { quote_number: quote.quote_number }, req);

    res.json({
      success: true,
      message: "Quote deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get billing statistics
 * GET /api/billing/stats
 */
async function getBillingStats(req, res, next) {
  try {
    // Invoice stats
    const invoiceStats = await db.query(`
      SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END) as outstanding_amount,
        SUM(total_amount) as total_invoiced
      FROM invoices WHERE deleted_at IS NULL
    `);

    // Quote stats
    const quoteStats = await db.query(`
      SELECT 
        COUNT(*) as total_quotes,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted_count,
        SUM(total_amount) as total_quoted
      FROM quotes WHERE deleted_at IS NULL
    `);

    // Log access
    await logBillingAudit(req.user.id, "billing_stats_accessed", "billing", null, {}, req);

    res.json({
      success: true,
      data: {
        invoices: invoiceStats[0],
        quotes: quoteStats[0],
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  createQuote,
  getQuote,
  listQuotes,
  updateQuote,
  updateQuoteStatus,
  convertQuoteToInvoice,
  deleteQuote,
  getBillingStats,
};
