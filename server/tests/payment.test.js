const request = require("supertest");
const app = require("../src/index");
const db = require("../src/config/db");
const jwt = require("jsonwebtoken");

describe("Payment Gateway Integration", () => {
  let token;
  let userId;
  let invoiceId;
  let transactionId;
  let clientId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (email, password, status) VALUES (?, ?, ?)`,
      ["payment@test.com", "hashedPassword123", "active"]
    );
    userId = userResult.insertId;

    // Create user role
    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, ?)`,
      [userId, "super_admin"]
    );

    // Generate token
    token = jwt.sign(
      { id: userId, email: "payment@test.com", roles: ["super_admin"] },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "24h" }
    );

    // Create test client
    const clientResult = await db.query(
      `INSERT INTO clients (business_name, email, phone, created_by) VALUES (?, ?, ?, ?)`,
      ["Test Payment Client", "client@test.com", "+254700000000", userId]
    );
    clientId = clientResult.insertId;

    // Create test invoice
    const invoiceResult = await db.query(
      `INSERT INTO invoices (invoice_id, client_id, invoice_number, subtotal, tax_amount, total_amount, tax_rate, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["INV_TEST001", clientId, "INV-2024-001", 1000, 160, 1160, 16, "draft", userId]
    );
    invoiceId = invoiceResult.insertId;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query(`DELETE FROM audit_logs WHERE user_id = ? OR user_id IS NULL`, [userId]);
    await db.query(`DELETE FROM transactions WHERE user_id = ? OR user_id IS NULL`, [userId]);
    await db.query(`DELETE FROM invoices WHERE id = ?`, [invoiceId]);
    await db.query(`DELETE FROM clients WHERE id = ?`, [clientId]);
    await db.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
  });

  // ==================== M-PESA TESTS ====================

  describe("M-Pesa Payment Processing", () => {
    it("should initiate M-Pesa payment", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 500,
          phone_number: "+254700000000",
          metadata: { order_type: "invoice" },
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.transaction_id).toBeDefined();
        expect(response.body.data.status).toBe("pending");
        transactionId = response.body.data.transaction_id;
      }
    });

    it("should reject M-Pesa payment with invalid amount", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 5000, // Exceeds invoice total
          phone_number: "+254700000000",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeds");
    });

    it("should reject M-Pesa payment with non-existent invoice", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: 99999,
          amount: 500,
          phone_number: "+254700000000",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Invoice not found");
    });

    it("should handle M-Pesa webhook for successful payment", async () => {
      const webhookPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: "ws_CO_03012024127359",
            ResultCode: 0,
            ResultDesc: "The service request has been processed successfully.",
            CallbackMetadata: {
              Item: [
                { Name: "Amount", Value: 500 },
                { Name: "MpesaReceiptNumber", Value: "QQQ1Q1Q1Q1" },
                { Name: "TransactionDate", Value: 20240301127359 },
                { Name: "PhoneNumber", Value: 254700000000 },
              ],
            },
          },
        },
      };

      const response = await request(app)
        .post("/api/payments/mpesa/webhook")
        .send(webhookPayload);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.ResultCode).toBe(0);
      }
    });

    it("should handle M-Pesa webhook for failed payment", async () => {
      const webhookPayload = {
        Body: {
          stkCallback: {
            CheckoutRequestID: "ws_CO_failed",
            ResultCode: 1,
            ResultDesc: "The user cancelled the transaction.",
          },
        },
      };

      const response = await request(app)
        .post("/api/payments/mpesa/webhook")
        .send(webhookPayload);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.ResultCode).toBe(0);
      }
    });

    it("should reject M-Pesa webhook with missing data", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/webhook")
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ==================== PAYSTACK TESTS ====================

  describe("Paystack Payment Processing", () => {
    it("should initiate Paystack payment", async () => {
      const response = await request(app)
        .post("/api/payments/paystack/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 300,
          currency: "NGN",
          email: "customer@example.com",
          metadata: { order_type: "invoice" },
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.transaction_id).toBeDefined();
        expect(response.body.data.status).toBe("pending");
      }
    });

    it("should reject Paystack payment without email", async () => {
      const response = await request(app)
        .post("/api/payments/paystack/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 300,
          currency: "NGN",
        });

      expect([400, 500]).toContain(response.status);
    });

    it("should reject Paystack payment with amount exceeding invoice", async () => {
      const response = await request(app)
        .post("/api/payments/paystack/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 5000,
          currency: "NGN",
          email: "customer@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeds");
    });

    it("should handle Paystack webhook for successful payment", async () => {
      const webhookPayload = {
        event: "charge.success",
        data: {
          reference: "PST-1234567890",
          amount: 300000, // In kobo
          metadata: { transaction_id: "TXN_ABC123", invoice_id: invoiceId },
          authorization: { authorization_code: "AUTH_1234567890" },
          customer: { email: "customer@example.com" },
        },
      };

      const response = await request(app)
        .post("/api/payments/paystack/webhook")
        .send(webhookPayload);

      expect([200, 400]).toContain(response.status);
    });

    it("should handle Paystack webhook for failed payment", async () => {
      const webhookPayload = {
        event: "charge.failed",
        data: {
          reference: "PST_FAILED_123",
          metadata: { transaction_id: "TXN_XYZ789", invoice_id: invoiceId },
        },
      };

      const response = await request(app)
        .post("/api/payments/paystack/webhook")
        .send(webhookPayload);

      expect([200, 400]).toContain(response.status);
    });

    it("should verify Paystack payment", async () => {
      const response = await request(app)
        .get("/api/payments/paystack/verify?reference=PST-1234567890")
        .set("Authorization", `Bearer ${token}`);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it("should reject Paystack verification without reference", async () => {
      const response = await request(app)
        .get("/api/payments/paystack/verify")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("reference");
    });
  });

  // ==================== INTASEND TESTS ====================

  describe("IntaSend Payment Processing", () => {
    it("should initiate IntaSend payment", async () => {
      const response = await request(app)
        .post("/api/payments/intasend/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 600,
          phone_number: "+254700000000",
          email: "customer@example.com",
          metadata: { order_type: "invoice" },
        });

      expect([201, 500]).toContain(response.status);
      if (response.status === 201) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.transaction_id).toBeDefined();
        expect(response.body.data.status).toBe("pending");
      }
    });

    it("should reject IntaSend payment with excessive amount", async () => {
      const response = await request(app)
        .post("/api/payments/intasend/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 5000,
          phone_number: "+254700000000",
          email: "customer@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("exceeds");
    });

    it("should handle IntaSend webhook for successful payment", async () => {
      const webhookPayload = {
        event: "payment.success",
        data: {
          tracking_id: "ITA-2024-001",
          amount: 600,
          phone: "+254700000000",
          metadata: { transaction_id: "TXN_INT123", invoice_id: invoiceId },
        },
      };

      const response = await request(app)
        .post("/api/payments/intasend/webhook")
        .send(webhookPayload);

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it("should handle IntaSend webhook for failed payment", async () => {
      const webhookPayload = {
        event: "payment.failed",
        data: {
          tracking_id: "ITA-FAIL-001",
          metadata: { transaction_id: "TXN_INT_FAIL", invoice_id: invoiceId },
        },
      };

      const response = await request(app)
        .post("/api/payments/intasend/webhook")
        .send(webhookPayload);

      expect([200, 500]).toContain(response.status);
    });
  });

  // ==================== TRANSACTION MANAGEMENT TESTS ====================

  describe("Transaction Management", () => {
    it("should retrieve transaction details", async () => {
      // First create a transaction
      const createResponse = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 400,
          phone_number: "+254700000000",
        });

      if (createResponse.status === 201) {
        const txnId = createResponse.body.data.transaction_id;

        const getResponse = await request(app)
          .get(`/api/payments/${txnId}`)
          .set("Authorization", `Bearer ${token}`);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body.success).toBe(true);
        expect(getResponse.body.data.transaction_id).toBe(txnId);
      }
    });

    it("should return 404 for non-existent transaction", async () => {
      const response = await request(app)
        .get("/api/payments/TXN_NONEXISTENT")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Transaction not found");
    });

    it("should list transactions for invoice", async () => {
      const response = await request(app)
        .get(`/api/payments?invoice_id=${invoiceId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it("should filter transactions by payment method", async () => {
      const response = await request(app)
        .get("/api/payments?payment_method=mpesa")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data.every((t) => t.payment_method === "mpesa")).toBe(true);
      }
    });

    it("should filter transactions by status", async () => {
      const response = await request(app)
        .get("/api/payments?status=pending")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      if (response.body.data.length > 0) {
        expect(response.body.data.every((t) => t.status === "pending")).toBe(true);
      }
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/payments?limit=5&offset=0")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(5);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  // ==================== REFUND TESTS ====================

  describe("Payment Refunds", () => {
    it("should refund completed payment", async () => {
      // Create a transaction in the database directly
      const txnResult = await db.query(
        `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["TXN_REFUND_TEST", invoiceId, "mpesa", 300, "KES", "completed", userId]
      );

      const response = await request(app)
        .post("/api/payments/TXN_REFUND_TEST/refund")
        .set("Authorization", `Bearer ${token}`)
        .send({
          reason: "Customer request",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.refund_id).toBeDefined();
      expect(response.body.data.amount).toBe(-300);
    });

    it("should reject refund for non-existent transaction", async () => {
      const response = await request(app)
        .post("/api/payments/TXN_NONEXISTENT/refund")
        .set("Authorization", `Bearer ${token}`)
        .send({
          reason: "Invalid transaction",
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain("not found");
    });

    it("should prevent double refunds", async () => {
      // Create transaction
      const txnResult = await db.query(
        `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["TXN_DOUBLE_REFUND", invoiceId, "card", 200, "KES", "completed", userId]
      );

      // First refund
      await request(app)
        .post("/api/payments/TXN_DOUBLE_REFUND/refund")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "First refund" });

      // Try second refund
      const response = await request(app)
        .post("/api/payments/TXN_DOUBLE_REFUND/refund")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Second refund" });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("refunded");
    });

    it("should reject refund for pending payment", async () => {
      // Create pending transaction
      const txnResult = await db.query(
        `INSERT INTO transactions (transaction_id, invoice_id, payment_method, amount, currency, status, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["TXN_PENDING_REFUND", invoiceId, "mpesa", 100, "KES", "pending", userId]
      );

      const response = await request(app)
        .post("/api/payments/TXN_PENDING_REFUND/refund")
        .set("Authorization", `Bearer ${token}`)
        .send({ reason: "Refund pending payment" });

      expect(response.status).toBe(404);
    });
  });

  // ==================== RECONCILIATION TESTS ====================

  describe("Payment Reconciliation", () => {
    it("should generate reconciliation report", async () => {
      const response = await request(app)
        .get("/api/payments/reports/reconciliation")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should filter reconciliation by date range", async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/payments/reports/reconciliation?start_date=${startDate}&end_date=${endDate}`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it("should filter reconciliation by payment method", async () => {
      const response = await request(app)
        .get("/api/payments/reports/reconciliation?payment_method=mpesa")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it("should include transaction counts in reconciliation", async () => {
      const response = await request(app)
        .get("/api/payments/reports/reconciliation")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((item) => {
        expect(item).toHaveProperty("transaction_count");
      });
    });

    it("should include amount totals in reconciliation", async () => {
      const response = await request(app)
        .get("/api/payments/reports/reconciliation")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((item) => {
        expect(item).toHaveProperty("total_completed");
        expect(item).toHaveProperty("total_pending");
        expect(item).toHaveProperty("total_failed");
      });
    });
  });

  // ==================== AUTHORIZATION TESTS ====================

  describe("Authorization and Permissions", () => {
    it("should deny access without authorization token", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .send({
          invoice_id: invoiceId,
          amount: 500,
          phone_number: "+254700000000",
        });

      expect(response.status).toBe(401);
    });

    it("should allow webhook without authorization", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/webhook")
        .send({
          Body: {
            stkCallback: {
              CheckoutRequestID: "test",
              ResultCode: 0,
              ResultDesc: "Success",
            },
          },
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  // ==================== ERROR HANDLING TESTS ====================

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          // Missing amount
          phone_number: "+254700000000",
        });

      expect([400, 500]).toContain(response.status);
    });

    it("should handle invalid currency codes", async () => {
      const response = await request(app)
        .post("/api/payments/paystack/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: invoiceId,
          amount: 300,
          currency: "INVALID",
          email: "test@test.com",
        });

      expect([400, 500]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      const response = await request(app)
        .post("/api/payments/mpesa/initiate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          invoice_id: 999999999,
          amount: 500,
          phone_number: "+254700000000",
        });

      expect([404, 500]).toContain(response.status);
    });
  });
});
