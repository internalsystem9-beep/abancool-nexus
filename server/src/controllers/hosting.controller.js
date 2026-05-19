const db = require("../config/db");
const { z } = require("zod");

// Validation schemas
const hostingSchema = z.object({
  client_id: z.coerce.number().positive("Client ID must be a positive number"),
  domain_name: z.string().min(3, "Domain name is required").max(255),
  cpanel_account: z.string().max(100).optional().nullable(),
  package_type: z.string().max(100),
  disk_quota_gb: z.coerce.number().positive("Disk quota must be positive").optional().nullable(),
  bandwidth_limit_gb: z.coerce.number().positive("Bandwidth limit must be positive").optional().nullable(),
  renewal_date: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'suspended', 'expired']).default('active')
});

const hostingPackageSchema = z.object({
  package_name: z.string().min(1, "Package name is required").max(100),
  price: z.coerce.number().positive("Price must be positive"),
  disk_space_gb: z.coerce.number().positive("Disk space must be positive"),
  bandwidth_gb: z.coerce.number().positive("Bandwidth must be positive"),
  features: z.string().max(1000).optional().nullable()
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'suspended', 'expired']).optional(),
  client_id: z.coerce.number().optional(),
  search: z.string().max(255).optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional()
});

// Helper function to generate unique hosting ID
function generateHostingId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `HT-${year}-${timestamp}`;
}

// Helper function to check resource usage and trigger alerts
async function checkResourceUsageAlerts(hostingId) {
  const hostingQuery = `
    SELECT id, disk_used_gb, disk_quota_gb, bandwidth_used_gb, bandwidth_limit_gb
    FROM hosting
    WHERE hosting_id = ? AND deleted_at IS NULL
  `;
  
  const result = await db.query(hostingQuery, [hostingId]);
  if (!result.length) return null;
  
  const hosting = result[0];
  const alerts = [];
  
  // Check disk usage
  if (hosting.disk_quota_gb && hosting.disk_used_gb) {
    const diskUsagePercent = (hosting.disk_used_gb / hosting.disk_quota_gb) * 100;
    if (diskUsagePercent >= 80) {
      alerts.push({
        type: 'disk_usage_alert',
        severity: 'warning',
        message: `Disk usage at ${diskUsagePercent.toFixed(2)}% for hosting ${hostingId}`,
        threshold: 80,
        current_value: diskUsagePercent
      });
    }
  }
  
  // Check bandwidth usage
  if (hosting.bandwidth_limit_gb && hosting.bandwidth_used_gb) {
    const bandwidthUsagePercent = (hosting.bandwidth_used_gb / hosting.bandwidth_limit_gb) * 100;
    if (bandwidthUsagePercent >= 80) {
      alerts.push({
        type: 'bandwidth_usage_alert',
        severity: 'warning',
        message: `Bandwidth usage at ${bandwidthUsagePercent.toFixed(2)}% for hosting ${hostingId}`,
        threshold: 80,
        current_value: bandwidthUsagePercent
      });
    }
  }
  
  return alerts;
}

// List hosting accounts with filtering and pagination
async function list(req, res, next) {
  try {
    const query = querySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "WHERE h.deleted_at IS NULL";
    const params = [];
    
    // Apply filters
    if (query.status) {
      whereClause += " AND h.status = ?";
      params.push(query.status);
    }
    
    if (query.client_id) {
      whereClause += " AND h.client_id = ?";
      params.push(query.client_id);
    }
    
    if (query.search) {
      whereClause += " AND (h.domain_name LIKE ? OR h.hosting_id LIKE ? OR c.company_name LIKE ?)";
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (query.created_from) {
      whereClause += " AND h.created_at >= ?";
      params.push(query.created_from);
    }
    
    if (query.created_to) {
      whereClause += " AND h.created_at <= ?";
      params.push(query.created_to);
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM hosting h
      LEFT JOIN clients c ON h.client_id = c.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get hosting accounts with client info
    const hostingQuery = `
      SELECT 
        h.id,
        h.hosting_id,
        h.client_id,
        c.company_name as client_name,
        c.client_id as client_identifier,
        h.domain_name,
        h.cpanel_account,
        h.package_type,
        h.disk_quota_gb,
        h.bandwidth_limit_gb,
        h.disk_used_gb,
        h.bandwidth_used_gb,
        ROUND((h.disk_used_gb / h.disk_quota_gb) * 100, 2) as disk_usage_percent,
        ROUND((h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100, 2) as bandwidth_usage_percent,
        h.renewal_date,
        h.status,
        h.created_at,
        h.updated_at
      FROM hosting h
      LEFT JOIN clients c ON h.client_id = c.id
      ${whereClause}
      ORDER BY h.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const hosting = await db.query(hostingQuery, [...params, query.limit, offset]);
    
    res.json({
      success: true,
      message: "Hosting accounts retrieved successfully",
      data: {
        hosting,
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

// Get hosting details
async function get(req, res, next) {
  try {
    const hostingId = req.params.id;
    
    // Get hosting details
    const hostingQuery = `
      SELECT 
        h.id,
        h.hosting_id,
        h.client_id,
        c.company_name as client_name,
        c.client_id as client_identifier,
        h.domain_name,
        h.cpanel_account,
        h.package_type,
        h.disk_quota_gb,
        h.bandwidth_limit_gb,
        h.disk_used_gb,
        h.bandwidth_used_gb,
        ROUND((h.disk_used_gb / h.disk_quota_gb) * 100, 2) as disk_usage_percent,
        ROUND((h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100, 2) as bandwidth_usage_percent,
        h.renewal_date,
        h.status,
        h.created_at,
        h.updated_at
      FROM hosting h
      LEFT JOIN clients c ON h.client_id = c.id
      WHERE h.id = ? AND h.deleted_at IS NULL
    `;
    
    const hostingResult = await db.query(hostingQuery, [hostingId]);
    if (!hostingResult.length) {
      return res.status(404).json({
        success: false,
        error: "Hosting account not found"
      });
    }
    
    const hosting = hostingResult[0];
    
    // Check for resource usage alerts
    const alerts = await checkResourceUsageAlerts(hosting.hosting_id);
    
    res.json({
      success: true,
      message: "Hosting details retrieved successfully",
      data: {
        hosting,
        alerts: alerts || []
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create hosting account
async function create(req, res, next) {
  try {
    const data = hostingSchema.parse(req.body);
    const hostingId = generateHostingId();
    
    // Verify client exists
    const clientCheck = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [data.client_id]
    );
    if (!clientCheck.length) {
      return res.status(404).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // Check if domain already exists for this client
    const domainCheck = await db.query(
      "SELECT id FROM hosting WHERE domain_name = ? AND client_id = ? AND deleted_at IS NULL",
      [data.domain_name, data.client_id]
    );
    if (domainCheck.length) {
      return res.status(400).json({
        success: false,
        error: "Domain already exists for this client"
      });
    }
    
    const result = await db.query(
      `INSERT INTO hosting (
        hosting_id, client_id, domain_name, cpanel_account, package_type,
        disk_quota_gb, bandwidth_limit_gb, renewal_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hostingId,
        data.client_id,
        data.domain_name,
        data.cpanel_account || null,
        data.package_type,
        data.disk_quota_gb || null,
        data.bandwidth_limit_gb || null,
        data.renewal_date || null,
        data.status
      ]
    );
    
    // Get the created hosting account
    const createdHosting = await db.query(
      `SELECT 
        h.*,
        c.company_name as client_name
      FROM hosting h
      LEFT JOIN clients c ON h.client_id = c.id
      WHERE h.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Hosting account created successfully",
      data: {
        hosting: createdHosting[0]
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

// Update hosting account
async function update(req, res, next) {
  try {
    const hostingId = req.params.id;
    const data = hostingSchema.partial().parse(req.body);
    
    // Check if hosting exists
    const existingHosting = await db.query(
      "SELECT id, client_id FROM hosting WHERE id = ? AND deleted_at IS NULL",
      [hostingId]
    );
    if (!existingHosting.length) {
      return res.status(404).json({
        success: false,
        error: "Hosting account not found"
      });
    }
    
    const hosting = existingHosting[0];
    
    // Verify client if provided and different
    if (data.client_id && data.client_id !== hosting.client_id) {
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
        [data.client_id]
      );
      if (!clientCheck.length) {
        return res.status(404).json({
          success: false,
          error: "New client not found"
        });
      }
    }
    
    // Check domain uniqueness if domain is being changed
    if (data.domain_name) {
      const domainCheck = await db.query(
        "SELECT id FROM hosting WHERE domain_name = ? AND client_id = ? AND id != ? AND deleted_at IS NULL",
        [data.domain_name, data.client_id || hosting.client_id, hostingId]
      );
      if (domainCheck.length) {
        return res.status(400).json({
          success: false,
          error: "Domain already exists for this client"
        });
      }
    }
    
    // Build update query
    const updateFields = [];
    const updateParams = [];
    
    if (data.domain_name !== undefined) {
      updateFields.push("domain_name = ?");
      updateParams.push(data.domain_name);
    }
    if (data.cpanel_account !== undefined) {
      updateFields.push("cpanel_account = ?");
      updateParams.push(data.cpanel_account);
    }
    if (data.package_type !== undefined) {
      updateFields.push("package_type = ?");
      updateParams.push(data.package_type);
    }
    if (data.disk_quota_gb !== undefined) {
      updateFields.push("disk_quota_gb = ?");
      updateParams.push(data.disk_quota_gb);
    }
    if (data.bandwidth_limit_gb !== undefined) {
      updateFields.push("bandwidth_limit_gb = ?");
      updateParams.push(data.bandwidth_limit_gb);
    }
    if (data.renewal_date !== undefined) {
      updateFields.push("renewal_date = ?");
      updateParams.push(data.renewal_date);
    }
    if (data.status !== undefined) {
      updateFields.push("status = ?");
      updateParams.push(data.status);
    }
    if (data.client_id !== undefined) {
      updateFields.push("client_id = ?");
      updateParams.push(data.client_id);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }
    
    updateParams.push(hostingId);
    
    await db.query(
      `UPDATE hosting SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );
    
    // Get the updated hosting account
    const updatedHosting = await db.query(
      `SELECT 
        h.*,
        c.company_name as client_name
      FROM hosting h
      LEFT JOIN clients c ON h.client_id = c.id
      WHERE h.id = ?`,
      [hostingId]
    );
    
    res.json({
      success: true,
      message: "Hosting account updated successfully",
      data: {
        hosting: updatedHosting[0]
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

// Soft-delete hosting account
async function remove(req, res, next) {
  try {
    const hostingId = req.params.id;
    
    // Check if hosting exists
    const existingHosting = await db.query(
      "SELECT id FROM hosting WHERE id = ? AND deleted_at IS NULL",
      [hostingId]
    );
    if (!existingHosting.length) {
      return res.status(404).json({
        success: false,
        error: "Hosting account not found"
      });
    }
    
    // Soft-delete
    await db.query(
      "UPDATE hosting SET deleted_at = NOW() WHERE id = ?",
      [hostingId]
    );
    
    res.json({
      success: true,
      message: "Hosting account deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get resource usage metrics
async function getUsage(req, res, next) {
  try {
    const hostingId = req.params.id;
    
    // Get hosting details
    const hostingQuery = `
      SELECT 
        h.id,
        h.hosting_id,
        h.domain_name,
        h.disk_quota_gb,
        h.bandwidth_limit_gb,
        h.disk_used_gb,
        h.bandwidth_used_gb,
        ROUND((h.disk_used_gb / h.disk_quota_gb) * 100, 2) as disk_usage_percent,
        ROUND((h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100, 2) as bandwidth_usage_percent,
        CASE 
          WHEN (h.disk_used_gb / h.disk_quota_gb) * 100 >= 80 THEN 'critical'
          WHEN (h.disk_used_gb / h.disk_quota_gb) * 100 >= 60 THEN 'warning'
          ELSE 'normal'
        END as disk_status,
        CASE 
          WHEN (h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100 >= 80 THEN 'critical'
          WHEN (h.bandwidth_used_gb / h.bandwidth_limit_gb) * 100 >= 60 THEN 'warning'
          ELSE 'normal'
        END as bandwidth_status
      FROM hosting h
      WHERE h.id = ? AND h.deleted_at IS NULL
    `;
    
    const hostingResult = await db.query(hostingQuery, [hostingId]);
    if (!hostingResult.length) {
      return res.status(404).json({
        success: false,
        error: "Hosting account not found"
      });
    }
    
    const hosting = hostingResult[0];
    
    // Check for alerts
    const alerts = await checkResourceUsageAlerts(hosting.hosting_id);
    
    res.json({
      success: true,
      message: "Resource usage retrieved successfully",
      data: {
        usage: {
          hosting_id: hosting.hosting_id,
          domain_name: hosting.domain_name,
          disk: {
            quota_gb: hosting.disk_quota_gb,
            used_gb: hosting.disk_used_gb,
            usage_percent: hosting.disk_usage_percent,
            status: hosting.disk_status
          },
          bandwidth: {
            limit_gb: hosting.bandwidth_limit_gb,
            used_gb: hosting.bandwidth_used_gb,
            usage_percent: hosting.bandwidth_usage_percent,
            status: hosting.bandwidth_status
          }
        },
        alerts: alerts || []
      }
    });
  } catch (err) {
    next(err);
  }
}

// List hosting packages
async function listPackages(req, res, next) {
  try {
    const packagesQuery = `
      SELECT 
        id,
        package_id,
        package_name,
        price,
        disk_space_gb,
        bandwidth_gb,
        features,
        created_at,
        updated_at
      FROM hosting_packages
      WHERE deleted_at IS NULL
      ORDER BY price ASC
    `;
    
    const packages = await db.query(packagesQuery);
    
    res.json({
      success: true,
      message: "Hosting packages retrieved successfully",
      data: {
        packages
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create hosting package
async function createPackage(req, res, next) {
  try {
    const data = hostingPackageSchema.parse(req.body);
    const packageId = `PKG-${Date.now()}`;
    
    // Check if package name already exists
    const existingPackage = await db.query(
      "SELECT id FROM hosting_packages WHERE package_name = ? AND deleted_at IS NULL",
      [data.package_name]
    );
    if (existingPackage.length) {
      return res.status(400).json({
        success: false,
        error: "Package with this name already exists"
      });
    }
    
    const result = await db.query(
      `INSERT INTO hosting_packages (
        package_id, package_name, price, disk_space_gb, bandwidth_gb, features
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        packageId,
        data.package_name,
        data.price,
        data.disk_space_gb,
        data.bandwidth_gb,
        data.features || null
      ]
    );
    
    // Get the created package
    const createdPackage = await db.query(
      "SELECT * FROM hosting_packages WHERE id = ?",
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "Hosting package created successfully",
      data: {
        package: createdPackage[0]
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

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  getUsage,
  listPackages,
  createPackage
};
