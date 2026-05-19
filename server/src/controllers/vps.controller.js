const db = require("../config/db");
const { z } = require("zod");

// Validation schemas
const vpsSchema = z.object({
  client_id: z.coerce.number().positive("Client ID must be a positive number").optional().nullable(),
  server_name: z.string().min(1, "Server name is required").max(255),
  ip_address: z.string().ip({ version: "v4" }),
  provider: z.string().max(100),
  cpu_cores: z.coerce.number().positive("CPU cores must be positive").optional().nullable(),
  ram_gb: z.coerce.number().positive("RAM must be positive").optional().nullable(),
  storage_gb: z.coerce.number().positive("Storage must be positive").optional().nullable(),
  uptime_percent: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active')
});

const metricsSchema = z.object({
  cpu_usage_percent: z.coerce.number().min(0).max(100),
  ram_usage_percent: z.coerce.number().min(0).max(100),
  disk_usage_percent: z.coerce.number().min(0).max(100),
  uptime_percent: z.coerce.number().min(0).max(100).optional()
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  provider: z.string().max(100).optional(),
  client_id: z.coerce.number().optional(),
  search: z.string().max(255).optional(),
  high_cpu: z.boolean().optional(),
  high_ram: z.boolean().optional(),
  high_disk: z.boolean().optional()
});

// Helper function to generate unique VPS ID
function generateVpsId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `VPS-${year}-${timestamp}`;
}

// Helper function to check resource usage and trigger alerts
async function checkResourceUsageAlerts(vpsId) {
  const vpsQuery = `
    SELECT id, server_name, cpu_usage_percent, ram_usage_percent, disk_usage_percent
    FROM vps
    WHERE vps_id = ? AND deleted_at IS NULL
  `;
  
  const result = await db.query(vpsQuery, [vpsId]);
  if (!result.length) return null;
  
  const vps = result[0];
  const alerts = [];
  
  // Check CPU usage (85% threshold)
  if (vps.cpu_usage_percent >= 85) {
    alerts.push({
      type: 'cpu_usage_alert',
      severity: vps.cpu_usage_percent >= 95 ? 'critical' : 'warning',
      message: `CPU usage at ${vps.cpu_usage_percent}% for server ${vps.server_name}`,
      threshold: 85,
      current_value: vps.cpu_usage_percent
    });
  }
  
  // Check RAM usage (85% threshold)
  if (vps.ram_usage_percent >= 85) {
    alerts.push({
      type: 'ram_usage_alert',
      severity: vps.ram_usage_percent >= 95 ? 'critical' : 'warning',
      message: `RAM usage at ${vps.ram_usage_percent}% for server ${vps.server_name}`,
      threshold: 85,
      current_value: vps.ram_usage_percent
    });
  }
  
  // Check disk usage (85% threshold)
  if (vps.disk_usage_percent >= 85) {
    alerts.push({
      type: 'disk_usage_alert',
      severity: vps.disk_usage_percent >= 95 ? 'critical' : 'warning',
      message: `Disk usage at ${vps.disk_usage_percent}% for server ${vps.server_name}`,
      threshold: 85,
      current_value: vps.disk_usage_percent
    });
  }
  
  return alerts;
}

// List VPS servers with filtering and pagination
async function list(req, res, next) {
  try {
    const query = querySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "WHERE v.deleted_at IS NULL";
    const params = [];
    
    // Apply filters
    if (query.status) {
      whereClause += " AND v.status = ?";
      params.push(query.status);
    }
    
    if (query.provider) {
      whereClause += " AND v.provider = ?";
      params.push(query.provider);
    }
    
    if (query.client_id) {
      whereClause += " AND v.client_id = ?";
      params.push(query.client_id);
    }
    
    if (query.search) {
      whereClause += " AND (v.server_name LIKE ? OR v.vps_id LIKE ? OR v.ip_address LIKE ?)";
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Filter by high resource usage
    if (query.high_cpu) {
      whereClause += " AND v.cpu_usage_percent >= 85";
    }
    if (query.high_ram) {
      whereClause += " AND v.ram_usage_percent >= 85";
    }
    if (query.high_disk) {
      whereClause += " AND v.disk_usage_percent >= 85";
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM vps v
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get VPS servers
    const vpsQuery = `
      SELECT 
        v.id,
        v.vps_id,
        v.client_id,
        c.company_name as client_name,
        c.client_id as client_identifier,
        v.server_name,
        v.ip_address,
        v.provider,
        v.cpu_cores,
        v.ram_gb,
        v.storage_gb,
        v.cpu_usage_percent,
        v.ram_usage_percent,
        v.disk_usage_percent,
        v.uptime_percent,
        v.status,
        v.last_metrics_at,
        v.created_at,
        v.updated_at,
        CASE WHEN v.cpu_usage_percent >= 85 THEN 'critical' WHEN v.cpu_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as cpu_status,
        CASE WHEN v.ram_usage_percent >= 85 THEN 'critical' WHEN v.ram_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as ram_status,
        CASE WHEN v.disk_usage_percent >= 85 THEN 'critical' WHEN v.disk_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as disk_status
      FROM vps v
      LEFT JOIN clients c ON v.client_id = c.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const vpsServers = await db.query(vpsQuery, [...params, query.limit, offset]);
    
    res.json({
      success: true,
      message: "VPS servers retrieved successfully",
      data: {
        vps: vpsServers,
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

// Get VPS details
async function get(req, res, next) {
  try {
    const vpsId = req.params.id;
    
    // Get VPS details
    const vpsQuery = `
      SELECT 
        v.id,
        v.vps_id,
        v.client_id,
        c.company_name as client_name,
        c.client_id as client_identifier,
        v.server_name,
        v.ip_address,
        v.provider,
        v.cpu_cores,
        v.ram_gb,
        v.storage_gb,
        v.cpu_usage_percent,
        v.ram_usage_percent,
        v.disk_usage_percent,
        v.uptime_percent,
        v.status,
        v.last_metrics_at,
        v.created_at,
        v.updated_at,
        CASE WHEN v.cpu_usage_percent >= 85 THEN 'critical' WHEN v.cpu_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as cpu_status,
        CASE WHEN v.ram_usage_percent >= 85 THEN 'critical' WHEN v.ram_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as ram_status,
        CASE WHEN v.disk_usage_percent >= 85 THEN 'critical' WHEN v.disk_usage_percent >= 70 THEN 'warning' ELSE 'normal' END as disk_status
      FROM vps v
      LEFT JOIN clients c ON v.client_id = c.id
      WHERE v.id = ? AND v.deleted_at IS NULL
    `;
    
    const vpsResult = await db.query(vpsQuery, [vpsId]);
    if (!vpsResult.length) {
      return res.status(404).json({
        success: false,
        error: "VPS server not found"
      });
    }
    
    const vps = vpsResult[0];
    
    // Check for resource usage alerts
    const alerts = await checkResourceUsageAlerts(vps.vps_id);
    
    res.json({
      success: true,
      message: "VPS details retrieved successfully",
      data: {
        vps,
        alerts: alerts || []
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create VPS
async function create(req, res, next) {
  try {
    const data = vpsSchema.parse(req.body);
    const vpsId = generateVpsId();
    
    // Verify client exists if provided
    if (data.client_id) {
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
    }
    
    // Check if IP address already exists
    const ipCheck = await db.query(
      "SELECT id FROM vps WHERE ip_address = ? AND deleted_at IS NULL",
      [data.ip_address]
    );
    if (ipCheck.length) {
      return res.status(400).json({
        success: false,
        error: "VPS with this IP address already exists"
      });
    }
    
    const result = await db.query(
      `INSERT INTO vps (
        vps_id, client_id, server_name, ip_address, provider,
        cpu_cores, ram_gb, storage_gb, uptime_percent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vpsId,
        data.client_id || null,
        data.server_name,
        data.ip_address,
        data.provider,
        data.cpu_cores || null,
        data.ram_gb || null,
        data.storage_gb || null,
        data.uptime_percent || 100,
        data.status
      ]
    );
    
    // Get the created VPS
    const createdVps = await db.query(
      `SELECT 
        v.*,
        c.company_name as client_name
      FROM vps v
      LEFT JOIN clients c ON v.client_id = c.id
      WHERE v.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: "VPS server created successfully",
      data: {
        vps: createdVps[0]
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

// Update VPS
async function update(req, res, next) {
  try {
    const vpsId = req.params.id;
    const data = vpsSchema.partial().parse(req.body);
    
    // Check if VPS exists
    const existingVps = await db.query(
      "SELECT id, client_id FROM vps WHERE id = ? AND deleted_at IS NULL",
      [vpsId]
    );
    if (!existingVps.length) {
      return res.status(404).json({
        success: false,
        error: "VPS server not found"
      });
    }
    
    const vps = existingVps[0];
    
    // Verify client if provided and different
    if (data.client_id && data.client_id !== vps.client_id) {
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
    
    // Check IP uniqueness if IP is being changed
    if (data.ip_address) {
      const ipCheck = await db.query(
        "SELECT id FROM vps WHERE ip_address = ? AND id != ? AND deleted_at IS NULL",
        [data.ip_address, vpsId]
      );
      if (ipCheck.length) {
        return res.status(400).json({
          success: false,
          error: "IP address already in use"
        });
      }
    }
    
    // Build update query
    const updateFields = [];
    const updateParams = [];
    
    if (data.server_name !== undefined) {
      updateFields.push("server_name = ?");
      updateParams.push(data.server_name);
    }
    if (data.ip_address !== undefined) {
      updateFields.push("ip_address = ?");
      updateParams.push(data.ip_address);
    }
    if (data.provider !== undefined) {
      updateFields.push("provider = ?");
      updateParams.push(data.provider);
    }
    if (data.cpu_cores !== undefined) {
      updateFields.push("cpu_cores = ?");
      updateParams.push(data.cpu_cores);
    }
    if (data.ram_gb !== undefined) {
      updateFields.push("ram_gb = ?");
      updateParams.push(data.ram_gb);
    }
    if (data.storage_gb !== undefined) {
      updateFields.push("storage_gb = ?");
      updateParams.push(data.storage_gb);
    }
    if (data.uptime_percent !== undefined) {
      updateFields.push("uptime_percent = ?");
      updateParams.push(data.uptime_percent);
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
    
    updateParams.push(vpsId);
    
    await db.query(
      `UPDATE vps SET ${updateFields.join(", ")} WHERE id = ?`,
      updateParams
    );
    
    // Get the updated VPS
    const updatedVps = await db.query(
      `SELECT 
        v.*,
        c.company_name as client_name
      FROM vps v
      LEFT JOIN clients c ON v.client_id = c.id
      WHERE v.id = ?`,
      [vpsId]
    );
    
    res.json({
      success: true,
      message: "VPS server updated successfully",
      data: {
        vps: updatedVps[0]
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

// Soft-delete VPS
async function remove(req, res, next) {
  try {
    const vpsId = req.params.id;
    
    // Check if VPS exists
    const existingVps = await db.query(
      "SELECT id FROM vps WHERE id = ? AND deleted_at IS NULL",
      [vpsId]
    );
    if (!existingVps.length) {
      return res.status(404).json({
        success: false,
        error: "VPS server not found"
      });
    }
    
    // Soft-delete
    await db.query(
      "UPDATE vps SET deleted_at = NOW() WHERE id = ?",
      [vpsId]
    );
    
    res.json({
      success: true,
      message: "VPS server deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Record VPS metrics
async function recordMetrics(req, res, next) {
  try {
    const vpsId = req.params.id;
    const data = metricsSchema.parse(req.body);
    
    // Check if VPS exists
    const existingVps = await db.query(
      "SELECT id FROM vps WHERE id = ? AND deleted_at IS NULL",
      [vpsId]
    );
    if (!existingVps.length) {
      return res.status(404).json({
        success: false,
        error: "VPS server not found"
      });
    }
    
    // Update metrics
    await db.query(
      `UPDATE vps SET 
        cpu_usage_percent = ?, 
        ram_usage_percent = ?, 
        disk_usage_percent = ?,
        uptime_percent = ?,
        last_metrics_at = NOW()
      WHERE id = ?`,
      [
        data.cpu_usage_percent,
        data.ram_usage_percent,
        data.disk_usage_percent,
        data.uptime_percent || 100,
        vpsId
      ]
    );
    
    // Get updated VPS
    const updatedVps = await db.query(
      "SELECT * FROM vps WHERE id = ?",
      [vpsId]
    );
    
    const vps = updatedVps[0];
    
    // Check for alerts
    const alerts = await checkResourceUsageAlerts(vps.vps_id);
    
    res.json({
      success: true,
      message: "VPS metrics recorded successfully",
      data: {
        vps,
        alerts: alerts || []
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

// Get VPS metrics history
async function getMetrics(req, res, next) {
  try {
    const vpsId = req.params.id;
    
    // Get VPS details
    const vpsQuery = `
      SELECT 
        id,
        vps_id,
        server_name,
        cpu_cores,
        ram_gb,
        storage_gb,
        cpu_usage_percent,
        ram_usage_percent,
        disk_usage_percent,
        uptime_percent,
        last_metrics_at,
        created_at,
        updated_at
      FROM vps
      WHERE id = ? AND deleted_at IS NULL
    `;
    
    const vpsResult = await db.query(vpsQuery, [vpsId]);
    if (!vpsResult.length) {
      return res.status(404).json({
        success: false,
        error: "VPS server not found"
      });
    }
    
    const vps = vpsResult[0];
    
    // Check for alerts
    const alerts = await checkResourceUsageAlerts(vps.vps_id);
    
    res.json({
      success: true,
      message: "VPS metrics retrieved successfully",
      data: {
        metrics: {
          server_name: vps.server_name,
          cpu: {
            cores: vps.cpu_cores,
            usage_percent: vps.cpu_usage_percent,
            status: vps.cpu_usage_percent >= 85 ? 'critical' : (vps.cpu_usage_percent >= 70 ? 'warning' : 'normal')
          },
          ram: {
            total_gb: vps.ram_gb,
            usage_percent: vps.ram_usage_percent,
            status: vps.ram_usage_percent >= 85 ? 'critical' : (vps.ram_usage_percent >= 70 ? 'warning' : 'normal')
          },
          disk: {
            total_gb: vps.storage_gb,
            usage_percent: vps.disk_usage_percent,
            status: vps.disk_usage_percent >= 85 ? 'critical' : (vps.disk_usage_percent >= 70 ? 'warning' : 'normal')
          },
          uptime_percent: vps.uptime_percent,
          last_updated: vps.last_metrics_at
        },
        alerts: alerts || []
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
  recordMetrics,
  getMetrics
};
