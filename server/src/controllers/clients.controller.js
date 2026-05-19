const db = require("../config/db");
const { z } = require("zod");

// Validation schemas
const clientSchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(255),
  email: z.string().email("Invalid email format").max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  kra_pin: z.string().max(50).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active')
});

const contactSchema = z.object({
  contact_name: z.string().min(1, "Contact name is required").max(255),
  email: z.string().email("Invalid email format").max(255).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  is_primary: z.boolean().default(false)
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  search: z.string().max(255).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  assigned_staff: z.coerce.number().optional()
});

// Helper function to generate unique client ID
function generateClientId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `CL-${year}-${timestamp}`;
}

// List clients with filtering and pagination
async function list(req, res, next) {
  try {
    const query = querySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "WHERE c.deleted_at IS NULL";
    const params = [];
    
    // Apply filters
    if (query.status) {
      whereClause += " AND c.status = ?";
      params.push(query.status);
    }
    
    if (query.search) {
      whereClause += " AND (c.company_name LIKE ? OR c.email LIKE ? OR c.client_id LIKE ?)";
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (query.created_from) {
      whereClause += " AND c.created_at >= ?";
      params.push(query.created_from);
    }
    
    if (query.created_to) {
      whereClause += " AND c.created_at <= ?";
      params.push(query.created_to);
    }
    
    if (query.assigned_staff) {
      whereClause += " AND EXISTS (SELECT 1 FROM user_clients uc WHERE uc.client_id = c.id AND uc.user_id = ?)";
      params.push(query.assigned_staff);
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM clients c 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get clients with creator info
    const clientsQuery = `
      SELECT 
        c.id,
        c.client_id,
        c.company_name,
        c.email,
        c.phone,
        c.address,
        c.city,
        c.country,
        c.kra_pin,
        c.status,
        c.created_at,
        c.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        (SELECT COUNT(*) FROM contacts ct WHERE ct.client_id = c.id AND ct.deleted_at IS NULL) as contact_count,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id AND p.deleted_at IS NULL) as project_count
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const clients = await db.query(clientsQuery, [...params, query.limit, offset]);
    
    res.json({
      success: true,
      message: "Clients retrieved successfully",
      data: {
        clients,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit)
        }
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: err.errors
      });
    }
    next(err);
  }
}

// Get client details with contacts and projects
async function get(req, res, next) {
  try {
    const clientId = req.params.id;
    
    // Get client details
    const clientQuery = `
      SELECT 
        c.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `;
    
    const clientResult = await db.query(clientQuery, [clientId]);
    if (!clientResult.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    const client = clientResult[0];
    
    // Get contacts
    const contactsQuery = `
      SELECT id, contact_name, email, phone, role, is_primary, created_at
      FROM contacts 
      WHERE client_id = ? AND deleted_at IS NULL
      ORDER BY is_primary DESC, contact_name ASC
    `;
    const contacts = await db.query(contactsQuery, [clientId]);
    
    // Get projects summary
    const projectsQuery = `
      SELECT 
        id, project_id, project_name, status, budget, deadline, created_at
      FROM projects 
      WHERE client_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const projects = await db.query(projectsQuery, [clientId]);
    
    // Get billing summary
    const billingQuery = `
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as total_outstanding
      FROM invoices 
      WHERE client_id = ? AND deleted_at IS NULL
    `;
    const billingResult = await db.query(billingQuery, [clientId]);
    const billing = billingResult[0] || { total_invoices: 0, total_paid: 0, total_outstanding: 0 };
    
    res.json({
      success: true,
      message: "Client details retrieved successfully",
      data: {
        client,
        contacts,
        projects,
        billing
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create new client
async function create(req, res, next) {
  try {
    const data = clientSchema.parse(req.body);
    const clientId = generateClientId();
    
    // Validate email uniqueness if provided
    if (data.email) {
      const existingClient = await db.query(
        "SELECT id FROM clients WHERE email = ? AND deleted_at IS NULL",
        [data.email]
      );
      if (existingClient.length > 0) {
        return res.status(400).json({
          success: false,
          error: "A client with this email already exists"
        });
      }
    }
    
    // Validate phone format if provided
    if (data.phone && !/^[\+]?[0-9\-\(\)\s]+$/.test(data.phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format"
      });
    }
    
    const result = await db.query(
      `INSERT INTO clients (
        client_id, company_name, email, phone, address, city, country, kra_pin, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        data.company_name,
        data.email || null,
        data.phone || null,
        data.address || null,
        data.city || null,
        data.country || null,
        data.kra_pin || null,
        data.status,
        req.user.id
      ]
    );
    
    // Get the created client
    const createdClient = await db.query(
      "SELECT * FROM clients WHERE id = ?",
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: {
        client: createdClient[0]
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: err.errors
      });
    }
    next(err);
  }
}

// Update client information
async function update(req, res, next) {
  try {
    const clientId = req.params.id;
    const data = clientSchema.partial().parse(req.body);
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // Validate email uniqueness if provided and changed
    if (data.email) {
      const emailCheck = await db.query(
        "SELECT id FROM clients WHERE email = ? AND id != ? AND deleted_at IS NULL",
        [data.email, clientId]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          error: "A client with this email already exists"
        });
      }
    }
    
    // Validate phone format if provided
    if (data.phone && !/^[\+]?[0-9\-\(\)\s]+$/.test(data.phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format"
      });
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(data).forEach(key => {
      updateFields.push(`${key} = ?`);
      updateValues.push(data[key]);
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }
    
    updateValues.push(clientId);
    
    await db.query(
      `UPDATE clients SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Get updated client
    const updatedClient = await db.query(
      "SELECT * FROM clients WHERE id = ?",
      [clientId]
    );
    
    res.json({
      success: true,
      message: "Client updated successfully",
      data: {
        client: updatedClient[0]
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: err.errors
      });
    }
    next(err);
  }
}

// Soft delete client
async function remove(req, res, next) {
  try {
    const clientId = req.params.id;
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // Soft delete client
    await db.query(
      "UPDATE clients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [clientId]
    );
    
    res.json({
      success: true,
      message: "Client deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Add contact to client
async function addContact(req, res, next) {
  try {
    const clientId = req.params.id;
    const data = contactSchema.parse(req.body);
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // If this is set as primary, unset other primary contacts
    if (data.is_primary) {
      await db.query(
        "UPDATE contacts SET is_primary = FALSE WHERE client_id = ?",
        [clientId]
      );
    }
    
    const result = await db.query(
      `INSERT INTO contacts (client_id, contact_name, email, phone, role, is_primary) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, data.contact_name, data.email || null, data.phone || null, data.role || null, data.is_primary]
    );
    
    // Get the created contact
    const createdContact = await db.query(
      "SELECT * FROM contacts WHERE id = ?",
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Contact added successfully",
      data: {
        contact: createdContact[0]
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: err.errors
      });
    }
    next(err);
  }
}

// Get client contacts
async function getContacts(req, res, next) {
  try {
    const clientId = req.params.id;
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    const contacts = await db.query(
      `SELECT id, contact_name, email, phone, role, is_primary, created_at, updated_at
       FROM contacts 
       WHERE client_id = ? AND deleted_at IS NULL
       ORDER BY is_primary DESC, contact_name ASC`,
      [clientId]
    );
    
    res.json({
      success: true,
      message: "Contacts retrieved successfully",
      data: {
        contacts
      }
    });
  } catch (err) {
    next(err);
  }
}

// Update contact
async function updateContact(req, res, next) {
  try {
    const clientId = req.params.id;
    const contactId = req.params.contactId;
    const data = contactSchema.partial().parse(req.body);
    
    // Check if contact exists for this client
    const existingContact = await db.query(
      "SELECT id FROM contacts WHERE id = ? AND client_id = ? AND deleted_at IS NULL",
      [contactId, clientId]
    );
    if (!existingContact.length) {
      return res.status(404).json({
        success: false,
        error: "Contact not found"
      });
    }
    
    // If this is set as primary, unset other primary contacts
    if (data.is_primary) {
      await db.query(
        "UPDATE contacts SET is_primary = FALSE WHERE client_id = ? AND id != ?",
        [clientId, contactId]
      );
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(data).forEach(key => {
      updateFields.push(`${key} = ?`);
      updateValues.push(data[key]);
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }
    
    updateValues.push(contactId);
    
    await db.query(
      `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Get updated contact
    const updatedContact = await db.query(
      "SELECT * FROM contacts WHERE id = ?",
      [contactId]
    );
    
    res.json({
      success: true,
      message: "Contact updated successfully",
      data: {
        contact: updatedContact[0]
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: err.errors
      });
    }
    next(err);
  }
}

// Delete contact
async function deleteContact(req, res, next) {
  try {
    const clientId = req.params.id;
    const contactId = req.params.contactId;
    
    // Check if contact exists for this client
    const existingContact = await db.query(
      "SELECT id FROM contacts WHERE id = ? AND client_id = ? AND deleted_at IS NULL",
      [contactId, clientId]
    );
    if (!existingContact.length) {
      return res.status(404).json({
        success: false,
        error: "Contact not found"
      });
    }
    
    // Soft delete contact
    await db.query(
      "UPDATE contacts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [contactId]
    );
    
    res.json({
      success: true,
      message: "Contact deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get client projects
async function getProjects(req, res, next) {
  try {
    const clientId = req.params.id;
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    const projects = await db.query(
      `SELECT 
        p.id, p.project_id, p.project_name, p.description, p.status, 
        p.budget, p.spent, p.deadline, p.deployment_url, p.deployed_at, p.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.client_id = ? AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC`,
      [clientId]
    );
    
    res.json({
      success: true,
      message: "Client projects retrieved successfully",
      data: {
        projects
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get client billing summary
async function getBilling(req, res, next) {
  try {
    const clientId = req.params.id;
    
    // Check if client exists
    const existingClient = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [clientId]
    );
    if (!existingClient.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // Get invoices summary
    const invoicesQuery = `
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN payment_status = 'partial' THEN total_amount ELSE 0 END), 0) as total_partial
      FROM invoices 
      WHERE client_id = ? AND deleted_at IS NULL
    `;
    const invoicesResult = await db.query(invoicesQuery, [clientId]);
    
    // Get quotes summary
    const quotesQuery = `
      SELECT 
        COUNT(*) as total_quotes,
        COALESCE(SUM(total_amount), 0) as total_quote_amount,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotes,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_quotes
      FROM quotes 
      WHERE client_id = ? AND deleted_at IS NULL
    `;
    const quotesResult = await db.query(quotesQuery, [clientId]);
    
    // Get recent transactions
    const transactionsQuery = `
      SELECT 
        t.transaction_id, t.amount, t.payment_method, t.status, t.created_at,
        i.invoice_number
      FROM transactions t
      LEFT JOIN invoices i ON t.invoice_id = i.id
      WHERE i.client_id = ?
      ORDER BY t.created_at DESC
      LIMIT 10
    `;
    const transactions = await db.query(transactionsQuery, [clientId]);
    
    res.json({
      success: true,
      message: "Client billing summary retrieved successfully",
      data: {
        invoices: invoicesResult[0] || {},
        quotes: quotesResult[0] || {},
        recent_transactions: transactions
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  addContact,
  getContacts,
  updateContact,
  deleteContact,
  getProjects,
  getBilling
};
