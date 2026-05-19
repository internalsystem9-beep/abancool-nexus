const db = require("../config/db");
const { z } = require("zod");
const notificationService = require("../services/notification.service");
const auditService = require("../services/audit.service");

// Validation schemas
const projectSchema = z.object({
  client_id: z.coerce.number().positive("Client ID is required"),
  project_name: z.string().min(1, "Project name is required").max(255),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['planning', 'in_progress', 'testing', 'deployed', 'completed']).default('planning'),
  budget: z.coerce.number().positive().optional().nullable(),
  deadline: z.string().optional().nullable(), // Will be converted to DATE
  deployment_url: z.string().url("Invalid URL format").max(500).optional().nullable()
});

const projectUpdateSchema = z.object({
  project_name: z.string().min(1, "Project name is required").max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['planning', 'in_progress', 'testing', 'deployed', 'completed']).optional(),
  budget: z.coerce.number().positive().optional().nullable(),
  spent: z.coerce.number().min(0).optional().nullable(),
  deadline: z.string().optional().nullable(),
  deployment_url: z.string().url("Invalid URL format").max(500).optional().nullable()
});

const statusUpdateSchema = z.object({
  status: z.enum(['planning', 'in_progress', 'testing', 'deployed', 'completed']),
  deployment_url: z.string().url("Invalid URL format").max(500).optional().nullable()
});

const teamMemberSchema = z.object({
  user_id: z.coerce.number().positive("User ID is required"),
  role: z.string().max(100).optional().nullable()
});

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  client_id: z.coerce.number().optional(),
  status: z.enum(['planning', 'in_progress', 'testing', 'deployed', 'completed']).optional(),
  search: z.string().max(255).optional(),
  deadline_from: z.string().optional(),
  deadline_to: z.string().optional(),
  assigned_developer: z.coerce.number().optional(),
  budget_min: z.coerce.number().optional(),
  budget_max: z.coerce.number().optional()
});

// Helper function to generate unique project ID
function generateProjectId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `PRJ-${year}-${timestamp}`;
}

// Helper function to validate status transitions
function isValidStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    'planning': ['in_progress'],
    'in_progress': ['testing', 'planning'],
    'testing': ['deployed', 'in_progress'],
    'deployed': ['completed', 'testing'],
    'completed': [] // No transitions from completed
  };
  
  return validTransitions[currentStatus]?.includes(newStatus) || currentStatus === newStatus;
}

// Helper function to calculate budget utilization percentage
function calculateBudgetUtilization(budget, spent) {
  if (!budget || budget === 0) return 0;
  return Math.round((spent / budget) * 100);
}

// List projects with filtering and pagination
async function list(req, res, next) {
  try {
    const query = querySchema.parse(req.query);
    const offset = (query.page - 1) * query.limit;
    
    let whereClause = "WHERE p.deleted_at IS NULL";
    const params = [];
    
    // Apply filters
    if (query.client_id) {
      whereClause += " AND p.client_id = ?";
      params.push(query.client_id);
    }
    
    if (query.status) {
      whereClause += " AND p.status = ?";
      params.push(query.status);
    }
    
    if (query.search) {
      whereClause += " AND (p.project_name LIKE ? OR p.description LIKE ? OR p.project_id LIKE ?)";
      const searchTerm = `%${query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (query.deadline_from) {
      whereClause += " AND p.deadline >= ?";
      params.push(query.deadline_from);
    }
    
    if (query.deadline_to) {
      whereClause += " AND p.deadline <= ?";
      params.push(query.deadline_to);
    }
    
    if (query.assigned_developer) {
      whereClause += " AND EXISTS (SELECT 1 FROM project_team pt WHERE pt.project_id = p.id AND pt.user_id = ?)";
      params.push(query.assigned_developer);
    }
    
    if (query.budget_min) {
      whereClause += " AND p.budget >= ?";
      params.push(query.budget_min);
    }
    
    if (query.budget_max) {
      whereClause += " AND p.budget <= ?";
      params.push(query.budget_max);
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM projects p 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = countResult[0].total;
    
    // Get projects with client and creator info
    const projectsQuery = `
      SELECT 
        p.id,
        p.project_id,
        p.project_name,
        p.description,
        p.status,
        p.budget,
        p.spent,
        p.deadline,
        p.deployment_url,
        p.deployed_at,
        p.created_at,
        p.updated_at,
        c.company_name as client_name,
        c.client_id as client_code,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        (SELECT COUNT(*) FROM project_team pt WHERE pt.project_id = p.id) as team_count,
        CASE 
          WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 2)
          ELSE 0 
        END as budget_utilization_percent,
        CASE 
          WHEN p.deadline < CURDATE() AND p.status NOT IN ('completed', 'deployed') THEN 'overdue'
          WHEN p.deadline <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND p.status NOT IN ('completed', 'deployed') THEN 'due_soon'
          ELSE 'on_track'
        END as deadline_status
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const projects = await db.query(projectsQuery, [...params, query.limit, offset]);
    
    res.json({
      success: true,
      message: "Projects retrieved successfully",
      data: {
        projects,
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

// Get project details with team members and client info
async function get(req, res, next) {
  try {
    const projectId = req.params.id;
    
    // Get project details
    const projectQuery = `
      SELECT 
        p.*,
        c.company_name as client_name,
        c.client_id as client_code,
        c.email as client_email,
        c.phone as client_phone,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        CASE 
          WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 2)
          ELSE 0 
        END as budget_utilization_percent,
        CASE 
          WHEN p.deadline < CURDATE() AND p.status NOT IN ('completed', 'deployed') THEN 'overdue'
          WHEN p.deadline <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND p.status NOT IN ('completed', 'deployed') THEN 'due_soon'
          ELSE 'on_track'
        END as deadline_status
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `;
    
    const projectResult = await db.query(projectQuery, [projectId]);
    if (!projectResult.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const project = projectResult[0];
    
    // Get team members
    const teamQuery = `
      SELECT 
        pt.id,
        pt.user_id,
        pt.role,
        pt.assigned_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email,
        GROUP_CONCAT(ur.role) as user_roles
      FROM project_team pt
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE pt.project_id = ?
      GROUP BY pt.id, pt.user_id, pt.role, pt.assigned_at, u.first_name, u.last_name, u.email
      ORDER BY pt.assigned_at ASC
    `;
    const team = await db.query(teamQuery, [projectId]);
    
    // Get recent files (if files table exists)
    const filesQuery = `
      SELECT 
        f.id, f.file_id, f.original_filename, f.file_size_bytes, f.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.project_id = ? AND f.deleted_at IS NULL
      ORDER BY f.created_at DESC
      LIMIT 10
    `;
    let files = [];
    try {
      files = await db.query(filesQuery, [projectId]);
    } catch (err) {
      // Files table might not exist yet, ignore error
      console.log("Files table not available yet");
    }
    
    res.json({
      success: true,
      message: "Project details retrieved successfully",
      data: {
        project,
        team,
        files
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create new project
async function create(req, res, next) {
  try {
    const data = projectSchema.parse(req.body);
    const projectId = generateProjectId();
    
    // Validate client exists
    const clientExists = await db.query(
      "SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL",
      [data.client_id]
    );
    if (!clientExists.length) {
      return res.status(400).json({
        success: false,
        error: "Client not found"
      });
    }
    
    // Validate deadline format if provided
    let deadline = null;
    if (data.deadline) {
      deadline = new Date(data.deadline);
      if (isNaN(deadline.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid deadline format. Use YYYY-MM-DD"
        });
      }
      // Convert to MySQL DATE format
      deadline = deadline.toISOString().split('T')[0];
    }
    
    const result = await db.query(
      `INSERT INTO projects (
        project_id, client_id, project_name, description, status, budget, deadline, deployment_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        data.client_id,
        data.project_name,
        data.description || null,
        data.status,
        data.budget || null,
        deadline,
        data.deployment_url || null,
        req.user.id
      ]
    );
    
    // Get the created project with client info
    const createdProject = await db.query(
      `SELECT 
        p.*,
        c.company_name as client_name,
        c.client_id as client_code
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [result.insertId]
    );
    
    // Log project creation
    await auditService.logProjectCreation(req.user.id, result.insertId, data, req.ip);
    
    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        project: createdProject[0]
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

// Update project information
async function update(req, res, next) {
  try {
    const projectId = req.params.id;
    const data = projectUpdateSchema.parse(req.body);
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id, status, budget, spent FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const currentProject = existingProject[0];
    
    // Validate status transition if status is being updated
    if (data.status && !isValidStatusTransition(currentProject.status, data.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from '${currentProject.status}' to '${data.status}'`
      });
    }
    
    // Validate deadline format if provided
    let deadline = undefined;
    if (data.deadline !== undefined) {
      if (data.deadline === null) {
        deadline = null;
      } else {
        deadline = new Date(data.deadline);
        if (isNaN(deadline.getTime())) {
          return res.status(400).json({
            success: false,
            error: "Invalid deadline format. Use YYYY-MM-DD"
          });
        }
        deadline = deadline.toISOString().split('T')[0];
      }
    }
    
    // Check budget vs spent validation
    if (data.budget !== undefined && currentProject.spent > 0) {
      const newBudget = data.budget || 0;
      if (newBudget < currentProject.spent) {
        return res.status(400).json({
          success: false,
          error: "Budget cannot be less than amount already spent"
        });
      }
    }
    
    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(data).forEach(key => {
      if (key === 'deadline') {
        if (deadline !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(deadline);
        }
      } else {
        updateFields.push(`${key} = ?`);
        updateValues.push(data[key]);
      }
    });
    
    // Set deployed_at timestamp if status is being changed to 'deployed'
    if (data.status === 'deployed' && currentProject.status !== 'deployed') {
      updateFields.push('deployed_at = CURRENT_TIMESTAMP');
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No fields to update"
      });
    }
    
    updateValues.push(projectId);
    
    await db.query(
      `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    // Get updated project with client info
    const updatedProject = await db.query(
      `SELECT 
        p.*,
        c.company_name as client_name,
        c.client_id as client_code,
        CASE 
          WHEN p.budget > 0 THEN ROUND((p.spent / p.budget) * 100, 2)
          ELSE 0 
        END as budget_utilization_percent
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    
    const updatedProj = updatedProject[0];
    
    // Log project update
    await auditService.logProjectUpdate(req.user.id, projectId, data, req.ip);
    
    // Check if budget was exceeded and send notification
    if (data.spent !== undefined && updatedProj.budget > 0 && updatedProj.spent > updatedProj.budget) {
      // Only notify if previously under budget (prevent duplicate notifications)
      if (currentProject.spent <= currentProject.budget) {
        await notificationService.sendBudgetExceededNotification(projectId);
      }
    }
    
    res.json({
      success: true,
      message: "Project updated successfully",
      data: {
        project: updatedProj
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

// Update project status (separate endpoint for status transitions)
async function updateStatus(req, res, next) {
  try {
    const projectId = req.params.id;
    const data = statusUpdateSchema.parse(req.body);
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id, status FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    const currentProject = existingProject[0];
    
    // Validate status transition
    if (!isValidStatusTransition(currentProject.status, data.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from '${currentProject.status}' to '${data.status}'`
      });
    }
    
    // Build update query
    let updateQuery = "UPDATE projects SET status = ?";
    let updateValues = [data.status];
    
    // Set deployed_at timestamp if status is 'deployed'
    if (data.status === 'deployed' && currentProject.status !== 'deployed') {
      updateQuery += ", deployed_at = CURRENT_TIMESTAMP";
    }
    
    // Update deployment URL if provided
    if (data.deployment_url !== undefined) {
      updateQuery += ", deployment_url = ?";
      updateValues.push(data.deployment_url);
    }
    
    updateQuery += " WHERE id = ?";
    updateValues.push(projectId);
    
    await db.query(updateQuery, updateValues);
    
    // Get updated project
    const updatedProject = await db.query(
      `SELECT 
        p.*,
        c.company_name as client_name,
        c.client_id as client_code
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    
    const updatedProj = updatedProject[0];
    
    // Log project status change
    await auditService.logProjectStatusChange(req.user.id, projectId, currentProject.status, data.status, req.ip);
    
    // Send deadline notification if transitioning to later stages
    if (data.status === 'testing' || data.status === 'deployed') {
      const daysUntilDeadline = updatedProj.deadline ? 
        Math.floor((new Date(updatedProj.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
      
      if (daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
        await notificationService.sendDeadlineApproachingNotification(projectId);
      }
    }
    
    res.json({
      success: true,
      message: "Project status updated successfully",
      data: {
        project: updatedProj
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

// Add deployment URL to project
async function addDeployment(req, res, next) {
  try {
    const projectId = req.params.id;
    const { deployment_url } = req.body;
    
    // Validate URL
    if (!deployment_url || typeof deployment_url !== 'string') {
      return res.status(400).json({
        success: false,
        error: "Deployment URL is required"
      });
    }
    
    try {
      new URL(deployment_url);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Invalid URL format"
      });
    }
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id, status FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Update deployment URL and set deployed_at timestamp
    await db.query(
      "UPDATE projects SET deployment_url = ?, deployed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [deployment_url, projectId]
    );
    
    // Get updated project
    const updatedProject = await db.query(
      `SELECT 
        p.*,
        c.company_name as client_name,
        c.client_id as client_code
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [projectId]
    );
    
    res.json({
      success: true,
      message: "Deployment URL added successfully",
      data: {
        project: updatedProject[0]
      }
    });
  } catch (err) {
    next(err);
  }
}

// Soft delete project
async function remove(req, res, next) {
  try {
    const projectId = req.params.id;
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Soft delete project
    await db.query(
      "UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
      [projectId]
    );
    
    // Log project deletion
    await auditService.logProjectDeletion(req.user.id, projectId, req.ip);
    
    res.json({
      success: true,
      message: "Project deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Assign team member to project
async function assignTeamMember(req, res, next) {
  try {
    const projectId = req.params.id;
    const data = teamMemberSchema.parse(req.body);
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Check if user exists
    const existingUser = await db.query(
      "SELECT id FROM users WHERE id = ? AND deleted_at IS NULL",
      [data.user_id]
    );
    if (!existingUser.length) {
      return res.status(400).json({
        success: false,
        error: "User not found"
      });
    }
    
    // Check if user is already assigned to this project
    const existingAssignment = await db.query(
      "SELECT id FROM project_team WHERE project_id = ? AND user_id = ?",
      [projectId, data.user_id]
    );
    if (existingAssignment.length) {
      return res.status(400).json({
        success: false,
        error: "User is already assigned to this project"
      });
    }
    
    // Add team member
    const result = await db.query(
      "INSERT INTO project_team (project_id, user_id, role) VALUES (?, ?, ?)",
      [projectId, data.user_id, data.role || null]
    );
    
    // Get the created assignment with user info
    const createdAssignment = await db.query(
      `SELECT 
        pt.id,
        pt.user_id,
        pt.role,
        pt.assigned_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email
       FROM project_team pt
       LEFT JOIN users u ON pt.user_id = u.id
       WHERE pt.id = ?`,
      [result.insertId]
    );
    
    // Log team assignment
    await auditService.logTeamAssignment(req.user.id, projectId, data.user_id, data.role, req.ip);
    
    res.status(201).json({
      success: true,
      message: "Team member assigned successfully",
      data: {
        assignment: createdAssignment[0]
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

// Remove team member from project
async function removeTeamMember(req, res, next) {
  try {
    const projectId = req.params.id;
    const userId = req.params.userId;
    
    // Check if assignment exists
    const existingAssignment = await db.query(
      "SELECT id FROM project_team WHERE project_id = ? AND user_id = ?",
      [projectId, userId]
    );
    if (!existingAssignment.length) {
      return res.status(404).json({
        success: false,
        error: "Team member assignment not found"
      });
    }
    
    // Remove team member
    await db.query(
      "DELETE FROM project_team WHERE project_id = ? AND user_id = ?",
      [projectId, userId]
    );
    
    // Log team removal
    await auditService.logTeamRemoval(req.user.id, projectId, userId, req.ip);
    
    
    res.json({
      success: true,
      message: "Team member removed successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get project team members
async function getTeam(req, res, next) {
  try {
    const projectId = req.params.id;
    
    // Check if project exists
    const existingProject = await db.query(
      "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }
    
    // Get team members
    const team = await db.query(
      `SELECT 
        pt.id,
        pt.user_id,
        pt.role,
        pt.assigned_at,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email,
        GROUP_CONCAT(ur.role) as user_roles
       FROM project_team pt
       LEFT JOIN users u ON pt.user_id = u.id
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE pt.project_id = ?
       GROUP BY pt.id, pt.user_id, pt.role, pt.assigned_at, u.first_name, u.last_name, u.email
       ORDER BY pt.assigned_at ASC`,
      [projectId]
    );
    
    res.json({
      success: true,
      message: "Project team retrieved successfully",
      data: {
        team
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
  updateStatus,
  addDeployment,
  remove,
  assignTeamMember,
  removeTeamMember,
  getTeam,
  getAuditLog
};

// Get project audit log
async function getAuditLog(req, res, next) {
  try {
    const projectId = req.params.id;
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;

    // Check if project exists
    const existingProject = await db.query(
      "SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL",
      [projectId]
    );
    if (!existingProject.length) {
      return res.status(404).json({
        success: false,
        error: "Project not found"
      });
    }

    // Get audit log
    const result = await auditService.getProjectAuditLog(projectId, page, limit);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: "Project audit log retrieved successfully",
      data: result.data
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
  updateStatus,
  addDeployment,
  remove,
  assignTeamMember,
  removeTeamMember,
  getTeam,
  getAuditLog
};