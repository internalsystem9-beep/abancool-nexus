/**
 * Payment Gateway Integration Controller
 * Handles M-Pesa, IntaSend, and Paystack payment processing with webhooks
 */

const db = require("../config/db");
const crypto = require("crypto");
const axios = require("axios");
const { z } = require("zod");

/**
 * Generate unique transaction ID
 */
function generateTransactionId() {
  return "TXN_" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

/**
 * Log payment audit
 */
async function logPaymentAudit(userId, action, transactionId, details, req) {
  try {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.get("user-agent") || "unknown";

    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, action, "payment", transactionId, JSON.stringify(details || {}), ip, userAgent]
    );
  } catch (error) {
    console.error("Audit logging failed:", error);
  }
}

/**
 * Verify M-Pesa webhook signature
 */
function verifyMpesaSignature(body, signature) {
  const secretKey = process.env.MPESA_CONSUMER_SECRET || "";
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(JSON.stringify(body))
    .digest("base64");
  return hash === signature;
}

/**
 * Verify Paystack signature
 */
function verifyPaystackSignature(body, signature) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(JSON.stringify(body))
    .digest("hex");
  return hash === signature;
}

/**
 * Verify IntaSend webhook signature
 */
function verifyIntaSendSignature(body, signature) {
  const publicKey = process.env.INTASEND_PUBLIC_KEY || "";
  const hash = crypto
    .createHmac("sha256", publicKey)
    .update(JSON.stringify(body))
    .digest("hex");
  return hash === signature;
}

// Validation schemas
const initiatePaymentSchema = z.object({
  invoice_id: z.number().int().positive(),
  amount: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  payment_method: z.enum(["mpesa", "card", "bank_transfer"]),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  metadata: z.record(z.string()).optional(),
});

/**
 * Initiate payment with M-Pesa
 */
async function initiateMpesaPayment(req, res, next) {
  try {
    const { invoice_id, amount, phone_number, metadata } = req.body;
    const userId = req.user.id;

    // Validate invoice exists
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL`,
      [invoice_id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Verify amount doesn't exceed invoice total
    if (amount > invoice.total_amount) {
      return res.status(400).json({
        success: false,
        error: "Payment amount exceeds invoice total",
      });
    }

    // Generate transaction ID
    const transactionId = generateTransactionId();

    // Create transaction record
    await db.query(
      `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, reference_number, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, invoice_id, "mpesa", amount, "KES", "pending", phone_number, userId]
    );

    // Initiate M-Pesa STK push
    try {
      const mpesaResponse = await axios.post(
        `${process.env.MPESA_API_URL || "https://sandbox.safaricom.co.ke"}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: process.env.MPESA_SHORTCODE || "",
          Password: Buffer.from(
            `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${new Date().toISOString().split("T")[0].replace(/-/g, "")}`
          ).toString("base64"),
          Timestamp: new Date().toISOString().split("T")[0].replace(/-/g, ""),
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.floor(amount),
          PartyA: phone_number,
          PartyB: process.env.MPESA_SHORTCODE || "",
          PhoneNumber: phone_number,
          CallBackURL: `${process.env.API_URL || "http://localhost:4000"}/api/payments/mpesa/webhook`,
          AccountReference: transactionId,
          TransactionDesc: `Invoice ${invoice.invoice_number}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MPESA_ACCESS_TOKEN || ""}`,
          },
        }
      );

      // Log audit
      await logPaymentAudit(userId, "mpesa_payment_initiated", transactionId, { invoice_id, amount }, req);

      res.status(201).json({
        success: true,
        message: "M-Pesa payment initiated",
        data: {
          transaction_id: transactionId,
          invoice_id,
          amount,
          currency: "KES",
          payment_method: "mpesa",
          status: "pending",
          checkout_request_id: mpesaResponse.data.CheckoutRequestID,
        },
      });
    } catch (mpesaError) {
      // Update transaction to failed
      await db.query(`UPDATE transactions SET status = ? WHERE transaction_id = ?`, ["failed", transactionId]);

      return res.status(500).json({
        success: false,
        error: "Failed to initiate M-Pesa payment",
        details: mpesaError.message,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * M-Pesa webhook handler
 */
async function handleMpesaWebhook(req, res, next) {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;

    if (!stkCallback) {
      return res.status(400).json({ success: false, error: "Invalid webhook data" });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Find transaction by reference
    const transactionResult = await db.query(
      `SELECT * FROM transactions WHERE reference_number = ? LIMIT 1`,
      [CheckoutRequestID]
    );

    if (transactionResult.length === 0) {
      console.warn("Transaction not found for M-Pesa webhook:", CheckoutRequestID);
      return res.json({ ResultCode: 0 }); // Acknowledge to M-Pesa
    }

    const transaction = transactionResult[0];

    if (ResultCode === 0) {
      // Payment successful
      const metadata = CallbackMetadata?.Item || [];
      const amountPaid = metadata.find((item) => item.Name === "Amount")?.Value || transaction.amount;
      const mpesaCode = metadata.find((item) => item.Name === "MpesaReceiptNumber")?.Value || "";

      // Update transaction
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
        [
          "completed",
          JSON.stringify({
            mpesa_receipt: mpesaCode,
            result_desc: ResultDesc,
            timestamp: new Date().toISOString(),
          }),
          transaction.id,
        ]
      );

      // Update invoice payment status
      const invoiceResult = await db.query(
        `SELECT SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as paid_total FROM transactions WHERE invoice_id = ?`,
        [transaction.invoice_id]
      );

      const totalPaid = invoiceResult[0].paid_total || 0;
      const invoice = await db.query(`SELECT * FROM invoices WHERE id = ?`, [transaction.invoice_id]);

      if (totalPaid >= invoice[0].total_amount) {
        await db.query(`UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ?`, [
          "paid",
          transaction.invoice_id,
        ]);
      }

      // Log audit
      await logPaymentAudit(null, "mpesa_payment_completed", transaction.transaction_id, { mpesa_code: mpesaCode }, req);

      console.log(`M-Pesa payment completed: ${mpesaCode}`);
    } else {
      // Payment failed
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
        [
          "failed",
          JSON.stringify({
            result_code: ResultCode,
            result_desc: ResultDesc,
            timestamp: new Date().toISOString(),
          }),
          transaction.id,
        ]
      );

      console.log(`M-Pesa payment failed: ${ResultDesc}`);
    }

    res.json({ ResultCode: 0 });
  } catch (error) {
    console.error("M-Pesa webhook error:", error);
    res.json({ ResultCode: 1 }); // M-Pesa will retry
  }
}

/**
 * Initiate payment with Paystack
 */
async function initiatePaystackPayment(req, res, next) {
  try {
    const { invoice_id, amount, email, metadata } = req.body;
    const userId = req.user.id;

    // Validate input
    const validationResult = initiatePaymentSchema.safeParse({
      invoice_id,
      amount,
      currency: "NGN",
      payment_method: "card",
      email,
      metadata,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationResult.error.errors,
      });
    }

    // Validate invoice exists
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL`,
      [invoice_id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Verify amount doesn't exceed invoice total
    if (amount > invoice.total_amount) {
      return res.status(400).json({
        success: false,
        error: "Payment amount exceeds invoice total",
      });
    }

    // Generate transaction ID
    const transactionId = generateTransactionId();

    // Create transaction record
    await db.query(
      `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, invoice_id, "card", amount, "NGN", "pending", userId]
    );

    // Initiate Paystack payment
    try {
      const paystackResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: Math.floor(amount * 100), // Paystack uses kobo
          metadata: {
            transaction_id: transactionId,
            invoice_id,
            ...metadata,
          },
          callback_url: `${process.env.API_URL || "http://localhost:4000"}/api/payments/paystack/verify`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}`,
          },
        }
      );

      // Log audit
      await logPaymentAudit(userId, "paystack_payment_initiated", transactionId, { invoice_id, amount, email }, req);

      res.status(201).json({
        success: true,
        message: "Paystack payment initialized",
        data: {
          transaction_id: transactionId,
          invoice_id,
          amount,
          currency: "NGN",
          payment_method: "card",
          status: "pending",
          authorization_url: paystackResponse.data.data.authorization_url,
          access_code: paystackResponse.data.data.access_code,
          reference: paystackResponse.data.data.reference,
        },
      });
    } catch (paystackError) {
      // Update transaction to failed
      await db.query(`UPDATE transactions SET status = ? WHERE transaction_id = ?`, ["failed", transactionId]);

      return res.status(500).json({
        success: false,
        error: "Failed to initialize Paystack payment",
        details: paystackError.message,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Paystack webhook handler
 */
async function handlePaystackWebhook(req, res, next) {
  try {
    const signature = req.headers["x-paystack-signature"];
    const body = req.rawBody; // Must be set by middleware

    // Verify signature
    if (!verifyPaystackSignature(body, signature)) {
      return res.status(401).json({ success: false, error: "Invalid signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { metadata, amount, reference, authorization, customer } = data;
      const transactionId = metadata?.transaction_id;

      // Find transaction
      const transactionResult = await db.query(
        `SELECT * FROM transactions WHERE transaction_id = ?`,
        [transactionId]
      );

      if (transactionResult.length === 0) {
        return res.status(404).json({ success: false, error: "Transaction not found" });
      }

      const transaction = transactionResult[0];

      // Update transaction
      await db.query(
        `UPDATE transactions SET status = ?, gateway_response = ?, reference_number = ?, updated_at = NOW() WHERE id = ?`,
        [
          "completed",
          JSON.stringify({
            paystack_reference: reference,
            auth_code: authorization?.authorization_code,
            customer_email: customer?.email,
            timestamp: new Date().toISOString(),
          }),
          reference,
          transaction.id,
        ]
      );

      // Update invoice payment status
      const invoiceResult = await db.query(
        `SELECT SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as paid_total FROM transactions WHERE invoice_id = ?`,
        [transaction.invoice_id]
      );

      const totalPaid = invoiceResult[0].paid_total || 0;
      const invoice = await db.query(`SELECT * FROM invoices WHERE id = ?`, [transaction.invoice_id]);

      if (totalPaid >= invoice[0].total_amount) {
        await db.query(`UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ?`, [
          "paid",
          transaction.invoice_id,
        ]);
      }

      // Log audit
      await logPaymentAudit(null, "paystack_payment_completed", transactionId, { reference }, req);

      console.log(`Paystack payment completed: ${reference}`);
    } else if (event === "charge.failed") {
      const { metadata, reference } = data;
      const transactionId = metadata?.transaction_id;

      // Update transaction
      await db.query(
        `UPDATE transactions SET status = ?, reference_number = ?, updated_at = NOW() WHERE transaction_id = ?`,
        ["failed", reference, transactionId]
      );

      console.log(`Paystack payment failed: ${reference}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    res.json({ success: false });
  }
}

/**
 * Verify Paystack payment
 */
async function verifyPaystackPayment(req, res, next) {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: "Payment reference required",
      });
    }

    // Verify with Paystack
    const verifyResponse = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}`,
      },
    });

    if (verifyResponse.data.data.status === "success") {
      const { metadata, amount, reference: ref } = verifyResponse.data.data;

      // Find and update transaction
      const transactionResult = await db.query(`SELECT * FROM transactions WHERE reference_number = ?`, [ref]);

      if (transactionResult.length > 0) {
        const transaction = transactionResult[0];

        await db.query(
          `UPDATE transactions SET status = ?, updated_at = NOW() WHERE id = ?`,
          ["completed", transaction.id]
        );

        // Update invoice
        const invoice = await db.query(`SELECT * FROM invoices WHERE id = ?`, [transaction.invoice_id]);
        const totalPaid =
          (await db.query(
            `SELECT SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as paid FROM transactions WHERE invoice_id = ?`,
            [transaction.invoice_id]
          ))[0].paid || 0;

        if (totalPaid >= invoice[0].total_amount) {
          await db.query(`UPDATE invoices SET payment_status = ? WHERE id = ?`, ["paid", transaction.invoice_id]);
        }
      }

      res.json({
        success: true,
        message: "Payment verified",
        data: {
          status: "completed",
          amount: amount / 100,
          reference: ref,
        },
      });
    } else {
      res.json({
        success: true,
        message: "Payment verification result",
        data: {
          status: verifyResponse.data.data.status,
        },
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Initiate payment with IntaSend
 */
async function initiateIntaSendPayment(req, res, next) {
  try {
    const { invoice_id, amount, phone_number, email, metadata } = req.body;
    const userId = req.user.id;

    // Validate invoice exists
    const invoiceResult = await db.query(
      `SELECT * FROM invoices WHERE id = ? AND deleted_at IS NULL`,
      [invoice_id]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Invoice not found",
      });
    }

    const invoice = invoiceResult[0];

    // Verify amount doesn't exceed invoice total
    if (amount > invoice.total_amount) {
      return res.status(400).json({
        success: false,
        error: "Payment amount exceeds invoice total",
      });
    }

    // Generate transaction ID
    const transactionId = generateTransactionId();

    // Create transaction record
    await db.query(
      `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transactionId, invoice_id, "mpesa", amount, "KES", "pending", userId]
    );

    // Initiate IntaSend payment
    try {
      const intaSendResponse = await axios.post(
        "https://api.intasend.com/api/v1/payment/",
        {
          public_key: process.env.INTASEND_PUBLIC_KEY || "",
          amount,
          currency: "KES",
          phone_number,
          email,
          first_name: email?.split("@")[0],
          last_name: "Customer",
          host: process.env.API_URL || "http://localhost:4000",
          redirect_url: `${process.env.API_URL || "http://localhost:4000"}/api/payments/intasend/verify`,
          webhook_url: `${process.env.API_URL || "http://localhost:4000"}/api/payments/intasend/webhook`,
          metadata: {
            transaction_id: transactionId,
            invoice_id,
            ...metadata,
          },
          comment: `Invoice ${invoice.invoice_number}`,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY || ""}`,
          },
        }
      );

      // Log audit
      await logPaymentAudit(userId, "intasend_payment_initiated", transactionId, { invoice_id, amount }, req);

      res.status(201).json({
        success: true,
        message: "IntaSend payment initiated",
        data: {
          transaction_id: transactionId,
          invoice_id,
          amount,
          currency: "KES",
          payment_method: "mpesa",
          status: "pending",
          payment_url: intaSendResponse.data.payload?.invoice_url,
          tracking_id: intaSendResponse.data.payload?.tracking_id,
        },
      });
    } catch (intaSendError) {
      // Update transaction to failed
      await db.query(`UPDATE transactions SET status = ? WHERE transaction_id = ?`, ["failed", transactionId]);

      return res.status(500).json({
        success: false,
        error: "Failed to initiate IntaSend payment",
        details: intaSendError.message,
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * IntaSend webhook handler
 */
async function handleIntaSendWebhook(req, res, next) {
  try {
    const { event, data } = req.body;

    if (event === "payment.success") {
      const { tracking_id, amount, phone, metadata } = data;
      const transactionId = metadata?.transaction_id;

      // Find transaction
      const transactionResult = await db.query(
        `SELECT * FROM transactions WHERE transaction_id = ?`,
        [transactionId]
      );

      if (transactionResult.length === 0) {
        return res.status(404).json({ success: false, error: "Transaction not found" });
      }

      const transaction = transactionResult[0];

      // Update transaction
      await db.query(
        `UPDATE transactions SET status = ?, reference_number = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?`,
        [
          "completed",
          tracking_id,
          JSON.stringify({
            tracking_id,
            phone,
            timestamp: new Date().toISOString(),
          }),
          transaction.id,
        ]
      );

      // Update invoice payment status
      const invoiceResult = await db.query(
        `SELECT SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as paid_total FROM transactions WHERE invoice_id = ?`,
        [transaction.invoice_id]
      );

      const totalPaid = invoiceResult[0].paid_total || 0;
      const invoice = await db.query(`SELECT * FROM invoices WHERE id = ?`, [transaction.invoice_id]);

      if (totalPaid >= invoice[0].total_amount) {
        await db.query(`UPDATE invoices SET payment_status = ?, updated_at = NOW() WHERE id = ?`, [
          "paid",
          transaction.invoice_id,
        ]);
      }

      // Log audit
      await logPaymentAudit(null, "intasend_payment_completed", transactionId, { tracking_id }, req);

      console.log(`IntaSend payment completed: ${tracking_id}`);
    } else if (event === "payment.failed") {
      const { tracking_id, metadata } = data;
      const transactionId = metadata?.transaction_id;

      // Update transaction
      await db.query(
        `UPDATE transactions SET status = ?, reference_number = ?, updated_at = NOW() WHERE transaction_id = ?`,
        ["failed", tracking_id, transactionId]
      );

      console.log(`IntaSend payment failed: ${tracking_id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("IntaSend webhook error:", error);
    res.json({ success: false });
  }
}

/**
 * Get transaction details
 */
async function getTransaction(req, res, next) {
  try {
    const { id } = req.params;

    const transactionResult = await db.query(
      `SELECT * FROM transactions WHERE transaction_id = ? OR id = ?`,
      [id, id]
    );

    if (transactionResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found",
      });
    }

    const transaction = transactionResult[0];

    // Log access
    await logPaymentAudit(req.user.id, "transaction_accessed", transaction.transaction_id, {}, req);

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List transactions for invoice
 */
async function listTransactions(req, res, next) {
  try {
    const { invoice_id, payment_method, status, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT * FROM transactions
      WHERE 1=1
    `;
    const params = [];

    if (invoice_id) {
      query += ` AND invoice_id = ?`;
      params.push(parseInt(invoice_id, 10));
    }

    if (payment_method) {
      query += ` AND payment_method = ?`;
      params.push(payment_method);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const transactions = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM transactions WHERE 1=1`;
    const countParams = [];

    if (invoice_id) {
      countQuery += ` AND invoice_id = ?`;
      countParams.push(parseInt(invoice_id, 10));
    }

    if (payment_method) {
      countQuery += ` AND payment_method = ?`;
      countParams.push(payment_method);
    }

    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult[0].count;

    res.json({
      success: true,
      data: transactions,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        count: transactions.length,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refund payment
 */
async function refundPayment(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Find transaction
    const transactionResult = await db.query(
      `SELECT * FROM transactions WHERE transaction_id = ? AND status = 'completed'`,
      [transaction_id]
    );

    if (transactionResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transaction not found or not eligible for refund",
      });
    }

    const transaction = transactionResult[0];

    // Check if already refunded
    const refundResult = await db.query(
      `SELECT * FROM transactions WHERE parent_transaction_id = ? AND status = 'refunded'`,
      [transaction.id]
    );

    if (refundResult.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Transaction already refunded",
      });
    }

    // Create refund transaction
    const refundId = generateTransactionId();

    await db.query(
      `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, parent_transaction_id, reference_number, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [refundId, transaction.invoice_id, transaction.payment_method, -transaction.amount, transaction.currency, "refunded", transaction.id, reason, userId]
    );

    // Update original transaction status to indicate it has a refund
    await db.query(
      `UPDATE transactions SET status = 'refunded' WHERE id = ?`,
      [transaction.id]
    );

    // Log audit
    await logPaymentAudit(userId, "payment_refunded", transaction_id, { reason, refund_id: refundId }, req);

    res.json({
      success: true,
      message: "Payment refunded successfully",
      data: {
        refund_id: refundId,
        original_transaction_id: transaction_id,
        amount: -transaction.amount,
        currency: transaction.currency,
        status: "refunded",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get payment reconciliation report
 */
async function getReconciliationReport(req, res, next) {
  try {
    const { start_date, end_date, payment_method, status } = req.query;

    let query = `
      SELECT 
        payment_method,
        status,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_completed,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
        SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as total_refunded
      FROM transactions
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(new Date(start_date));
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(new Date(end_date));
    }

    if (payment_method) {
      query += ` AND payment_method = ?`;
      params.push(payment_method);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` GROUP BY payment_method, status`;

    const report = await db.query(query, params);

    // Log audit
    await logPaymentAudit(req.user.id, "reconciliation_report_generated", null, { start_date, end_date }, req);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  initiateMpesaPayment,
  handleMpesaWebhook,
  initiatePaystackPayment,
  handlePaystackWebhook,
  verifyPaystackPayment,
  initiateIntaSendPayment,
  handleIntaSendWebhook,
  getTransaction,
  listTransactions,
  refundPayment,
  getReconciliationReport,
};
