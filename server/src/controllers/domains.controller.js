const db = require("../config/db");
const { z } = require("zod");

// Validation schemas
const domainSchema = z.object({
  domain_name: z.string().min(3, "Domain name is required").max(255),
  registrar: z.string().max(100).optional().nullable(),
  registration_date: z.string().datetime().optional().nullable(),
  expiration_date: z.string().datetime().optional().nullable(),
  auto_renewal: z.boolean().default(false),
  status: z.enum(['active', 'expired', 'pending']).default('active')
});

const sslSchema = z.object({
  ssl_issuer: z.string().max(100).optional().nullable(),
  ssl_expiration_date: z.string().datetime().optional().nullable(),
  ssl_renewal_status: z.enum(['active', 'expiring_soon', 'expired']).default('active')
});

const renewalSchema = z.object({
  auto_renewal: z.boolean()
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'expired', 'pending']).optional(),
  ssl_status: z.enum(['active', 'expiring_soon', 'expired']).optional(),
  registrar: z.string().max(100).optional(),
  search: z.string().max(255).optional(),
  expiring_soon: z.boolean().optional(),
  ssl_expiring_soon: z.boolean().optional()
});

// Helper function to generate unique domain ID
function generateDomainId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `DOM-${year}-${timestamp}`;
}

// Helper function to check domain expiration
function getExpirationDaysRemaining(expirationDate) {
  if (!expirationDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
  return daysRemaining;
}

// Helper function to determine domain status based on expiration
function getExpirationStatus(expirationDate) {
  if (!expirationDate) return null;
  const daysRemaining = getExpirationDaysRemaining(expirationDate);
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 30) return 'expiring_soon';
  return 'active';
}

// Helper function to check for domain expiration alerts
async function checkDomainExpirationAlerts(domainId) {
  const domainQuery = `
    SELECT id, domain_name, expiration_date, ssl_expiration_date
    FROM domains
    WHERE domain_id = ? AND deleted_at IS NULL
  `;
  
  const result = await db.query(domainQuery, [domainId]);
  if (!result.length) return null;
  
  const domain = result[0];
  const alerts = [];
  
  // Check domain expiration
  if (domain.expiration_date) {
    const daysRemaining = getExpirationDaysRemaining(domain.expiration_date);
    if (daysRemaining !== null) {
      if (daysRemaining < 0) {
        alerts.push({
          type: 'domain_expired',
          severity: 'critical',
          message: `Domain ${domain.domain_name} has expired`,
          days_remaining: daysRemaining
        });
      } else if (daysRemaining <= 30) {
        alerts.push({
          type: 'domain_expiring_soon',
          severity: 'warning',
          message: `Domain ${domain.domain_name} expires in ${daysRemaining} days`,
          days_remaining: daysRemaining
        });
      }
    }
  }
  
  // Check SSL expiration
  if (domain.ssl_expiration_date) {
    const sslDaysRemaining = getExpirationDaysRemaining(domain.ssl_expiration_date);
    if (sslDaysRemaining !== null) {
      if (sslDaysRemaining < 0) {
        alerts.push({
          type: 'ssl_expired',
          severity: 'critical',
          message: `SSL certificate for ${domain.domain_name} has expired`,
          days_remaining: sslDaysRemaining
        });
      } else if (sslDaysRemaining <= 30) {
        alerts.push({
          type: 'ssl_expiring_soon',
          severity: 'warning',
          message: `SSL certificate for ${domain.domain_name} expires in ${sslDaysRemaining} days`,
          days_remaining: sslDaysRemaining
        });
      }
    }
  }
  
  return alerts;
}

// List domains with filtering and pagination
async function list(req, res, next) {
  try {
    const query = querySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "WHERE d.deleted_at IS NULL";
    const params = [];
    
    // Apply filters
    if (query.status) {
      whereClause += " AND d.status = ?";
      params.push(query.status);
    }
    
    if (query.ssl_status) {
      whereClause += " AND d.ssl_renewal_status = ?";
      params.push(query.ssl_status);
    }
    
    if (query.registrar) {
      whereClause += " AND d.registrar = ?";
      params.push(query.registrar);
    }
    
    if (query.search) {
      whereClause += " AND (d.domain_name LIKE ? OR d.domain_id LIKE ?)";
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    // Filter by expiration date approaching (30 days)
    if (query.expiring_soon) {
      whereClause += " AND d.expiration_date IS NOT NULL AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) >= d.expiration_date AND d.expiration_date >= CURDATE()";
    }
    
    // Filter by SSL expiration approaching (30 days)
    if (query.ssl_expiring_soon) {
      whereClause += " AND d.ssl_expiration_date IS NOT NULL AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) >= d.ssl_expiration_date AND d.ssl_expiration_date >= CURDATE()";
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM domains d
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get domains
    const domainsQuery = `
      SELECT 
        d.id,
        d.domain_id,
        d.domain_name,
        d.registrar,
        d.registration_date,
        d.expiration_date,
        DATEDIFF(d.expiration_date, CURDATE()) as domain_days_remaining,
        d.auto_renewal,
        d.ssl_issuer,
        d.ssl_expiration_date,
        DATEDIFF(d.ssl_expiration_date, CURDATE()) as ssl_days_remaining,
        d.ssl_renewal_status,
        d.status,
        d.created_at,
        d.updated_at
      FROM domains d
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const domains = await db.query(domainsQuery, [...params, query.limit, offset]);
    
    res.json({
      success: true,
      message: "Domains retrieved successfully",
      data: {
        domains,
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

// Get domain details
async function get(req, res, next) {
  try {
    const domainId = req.params.id;
    
    // Get domain details
    const domainQuery = `
      SELECT 
        d.id,
        d.domain_id,
        d.domain_name,
        d.registrar,
        d.registration_date,
        d.expiration_date,
        DATEDIFF(d.expiration_date, CURDATE()) as domain_days_remaining,
        d.auto_renewal,
        d.ssl_issuer,
        d.ssl_expiration_date,
        DATEDIFF(d.ssl_expiration_date, CURDATE()) as ssl_days_remaining,
        d.ssl_renewal_status,
        d.status,
        d.created_at,
        d.updated_at
      FROM domains d
      WHERE d.id = ? AND d.deleted_at IS NULL
    `;
    
    const domainResult = await db.query(domainQuery, [domainId]);
    if (!domainResult.length) {
      return res.status(404).json({
        success: false,
        error: "Domain not found"
      });
    }
    
    const domain = domainResult[0];
    
    // Check for expiration alerts
    const alerts = await checkDomainExpirationAlerts(domain.domain_id);
    
    res.json({
      success: true,
      message: "Domain details retrieved successfully",
      data: {
        domain,
        alerts: alerts || []
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create domain
async function create(req, res, next) {
  try {
    const data = domainSchema.parse(req.body);
    const domainId = generateDomainId();
    
    // Validate domain name format (basic TLD validation)
    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(data.domain_name)) {
      return res.status(400).json({
        success: false,
        error: "Invalid domain name format"
      });
    }
    
    // Check if domain already exists
    const domainCheck = await db.query(
      "SELECT id FROM domains WHERE domain_name = ? AND deleted_at IS NULL",
      [data.domain_name.toLowerCase()]
    );
    if (domainCheck.length) {
      return res.status(400).json({
        success: false,
        error: "Domain already exists"
      });
    }
    
    // Determine expiration status
    const expirationStatus = getExpirationStatus(data.expiration_date);
    
    const result = await db.query(
      `INSERT INTO domains (
        domain_id, domain_name, registrar, registration_date, expiration_date,
        auto_renewal, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        domainId,
        data.domain_name.toLowerCase(),
        data.registrar || null,
        data.registration_date || null,
        data.expiration_date || null,
        data.auto_renewal ? 1 : 0,
        expirationStatus || data.status
      ]
    );
    
    // Get the created domain
    const createdDomain = await db.query(
      "SELECT * FROM domains WHERE id = ?",
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Domain created successfully",
      data: {
        domain: createdDomain[0]
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

// Update domain
async function update(req, res, next) {
  try {
    const domainId = req.params.id;
    const data = domainSchema.partial().parse(req.body);
    
    // Check if domain exists
    const existingDomain = await db.query(
      "SELECT id, domain_name FROM domains WHERE id = ? AND deleted_at IS NULL",
      [domainId]
    );
    if (!existingDomain.length) {
      return res.status(404).json({
        success: false,
        error: "Domain not found"
      });
    }
    
    // Validate domain name format if provided
    if (data.domain_name) {
      const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(data.domain_name)) {
        return res.status(400).json({
          success: false,
          error: "Invalid domain name format"
        });
      }
      
      // Check domain uniqueness if changed
      const domainCheck = await db.query(
        "SELECT id FROM domains WHERE domain_name = ? AND id != ? AND deleted_at IS NULL",
        [data.domain_name.toLowerCase(), domainId]
      );
      if (domainCheck.length) {
        return res.status(400).json({
          success: false,
          error: "Domain name already exists"
        });
      }
    }
    
    // Build update query
    const updateFields = [];
    const updateParams = [];
    
    if (data.domain_name !== undefined) {
      updateFields.push("domain_name = ?");
      updateParams.push(data.domain_name.toLowerCase());
    }
    if (data.registrar !== undefined) {
      updateFields.push("registrar = ?");
      updateParams.push(data.registrar);
    }
    if (data.registration_date !== undefined) {
      updateFields.push("registration_date = ?");
      updateParams.push(data.registration_date);
    }
    if (data.expiration_date !== undefined) {
      updateFields.push("expiration_date = ?");
      updateParams.push(data.expiration_date);
      // Update status based on expiration date
      const newStatus = getExpirationStatus(data.expiration_date);
      if (newStatus) {
        updateFields.push("status = ?");
        updateParams.push(newStatus);
      }
    }
    if (data.auto_renewal !== undefined) {
      updateFields.push("auto_renewal = ?");
      updateParams.push(data.auto_renewal ? 1 : 0);
    }
    if (data.status !== undefined) {
      updateFields.push("status = ?");
      updateParams.push(data.status);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }
    
    updateParams.push(domainId);
    
    await db.query(
      `UPDATE domains SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );
    
    // Get the updated domain
    const updatedDomain = await db.query(
      "SELECT * FROM domains WHERE id = ?",
      [domainId]
    );
    
    res.json({
      success: true,
      message: "Domain updated successfully",
      data: {
        domain: updatedDomain[0]
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

// Update SSL information
async function updateSSL(req, res, next) {
  try {
    const domainId = req.params.id;
    const data = sslSchema.parse(req.body);
    
    // Check if domain exists
    const existingDomain = await db.query(
      "SELECT id FROM domains WHERE id = ? AND deleted_at IS NULL",
      [domainId]
    );
    if (!existingDomain.length) {
      return res.status(404).json({
        success: false,
        error: "Domain not found"
      });
    }
    
    // Determine SSL renewal status
    const sslStatus = getExpirationStatus(data.ssl_expiration_date);
    
    // Build update query
    const updateFields = [];
    const updateParams = [];
    
    if (data.ssl_issuer !== undefined) {
      updateFields.push("ssl_issuer = ?");
      updateParams.push(data.ssl_issuer);
    }
    if (data.ssl_expiration_date !== undefined) {
      updateFields.push("ssl_expiration_date = ?");
      updateParams.push(data.ssl_expiration_date);
    }
    if (data.ssl_renewal_status !== undefined) {
      updateFields.push("ssl_renewal_status = ?");
      updateParams.push(data.ssl_renewal_status);
    } else if (sslStatus) {
      // Auto-update SSL status based on expiration date
      updateFields.push("ssl_renewal_status = ?");
      updateParams.push(sslStatus);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No SSL fields to update"
      });
    }
    
    updateParams.push(domainId);
    
    await db.query(
      `UPDATE domains SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );
    
    // Get the updated domain
    const updatedDomain = await db.query(
      "SELECT * FROM domains WHERE id = ?",
      [domainId]
    );
    
    res.json({
      success: true,
      message: "SSL information updated successfully",
      data: {
        domain: updatedDomain[0]
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

// Update auto-renewal status
async function updateRenewal(req, res, next) {
  try {
    const domainId = req.params.id;
    const data = renewalSchema.parse(req.body);
    
    // Check if domain exists
    const existingDomain = await db.query(
      "SELECT id FROM domains WHERE id = ? AND deleted_at IS NULL",
      [domainId]
    );
    if (!existingDomain.length) {
      return res.status(404).json({
        success: false,
        error: "Domain not found"
      });
    }
    
    await db.query(
      "UPDATE domains SET auto_renewal = ? WHERE id = ?",
      [data.auto_renewal ? 1 : 0, domainId]
    );
    
    // Get the updated domain
    const updatedDomain = await db.query(
      "SELECT * FROM domains WHERE id = ?",
      [domainId]
    );
    
    res.json({
      success: true,
      message: `Auto-renewal ${data.auto_renewal ? 'enabled' : 'disabled'} successfully`,
      data: {
        domain: updatedDomain[0]
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

// Soft-delete domain
async function remove(req, res, next) {
  try {
    const domainId = req.params.id;
    
    // Check if domain exists
    const existingDomain = await db.query(
      "SELECT id FROM domains WHERE id = ? AND deleted_at IS NULL",
      [domainId]
    );
    if (!existingDomain.length) {
      return res.status(404).json({
        success: false,
        error: "Domain not found"
      });
    }
    
    // Soft-delete
    await db.query(
      "UPDATE domains SET deleted_at = NOW() WHERE id = ?",
      [domainId]
    );
    
    res.json({
      success: true,
      message: "Domain deleted successfully"
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
  updateSSL,
  updateRenewal,
  remove
};
