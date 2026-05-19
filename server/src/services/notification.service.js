/**
 * Notification Service
 * Handles sending notifications via email, SMS, and in-app channels
 */

const db = require("../config/db");
const mailer = require("./mailer");

/**
 * Send email notification
 */
async function sendEmailNotification(recipientEmail, subject, message, context = {}) {
  try {
    await mailer.send({
      to: recipientEmail,
      subject,
      html: message,
      context
    });
    return { success: true };
  } catch (err) {
    console.error("Email notification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send notification to multiple users by role
 */
async function sendNotificationToRole(role, subject, message, context = {}) {
  try {
    // Get users with specified role
    const users = await db.query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role = ? AND u.deleted_at IS NULL
    `, [role]);

    for (const user of users) {
      await sendEmailNotification(user.email, subject, message, {
        ...context,
        user_name: `${user.first_name} ${user.last_name}`
      });
    }

    return { success: true, notified_count: users.length };
  } catch (err) {
    console.error("Role notification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send notification to project team members
 */
async function sendProjectTeamNotification(projectId, subject, message, context = {}) {
  try {
    // Get project team members
    const team = await db.query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
      FROM project_team pt
      JOIN users u ON pt.user_id = u.id
      WHERE pt.project_id = ? AND u.deleted_at IS NULL
    `, [projectId]);

    for (const user of team) {
      await sendEmailNotification(user.email, subject, message, {
        ...context,
        user_name: `${user.first_name} ${user.last_name}`
      });
    }

    return { success: true, notified_count: team.length };
  } catch (err) {
    console.error("Project team notification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Check and notify for approaching project deadlines
 * Triggers notification 7 days before deadline
 */
async function checkDeadlineNotifications() {
  try {
    // Find projects with deadlines approaching within 7 days
    const projects = await db.query(`
      SELECT 
        p.id, p.project_id, p.project_name,
        p.deadline, p.budget, p.spent,
        c.company_name as client_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
        DATEDIFF(p.deadline, CURDATE()) as days_until_deadline
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.deleted_at IS NULL
        AND p.status NOT IN ('completed', 'deployed')
        AND p.deadline IS NOT NULL
        AND p.deadline > CURDATE()
        AND DATEDIFF(p.deadline, CURDATE()) <= 7
        AND DATEDIFF(p.deadline, CURDATE()) > 0
        AND NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE project_id = p.id
            AND type = 'deadline_alert'
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
        )
    `);

    for (const project of projects) {
      const subject = `Project Deadline Alert: ${project.project_name}`;
      const message = `
        <p>Dear Team,</p>
        <p>The project <strong>${project.project_name}</strong> for <strong>${project.client_name}</strong> 
        has a deadline in <strong>${project.days_until_deadline} days</strong> (${project.deadline}).</p>
        <p><strong>Project Details:</strong></p>
        <ul>
          <li>Project ID: ${project.project_id}</li>
          <li>Budget: ${project.budget}</li>
          <li>Spent: ${project.spent}</li>
          <li>Budget Utilization: ${calculateBudgetUtilization(project.budget, project.spent)}%</li>
          <li>Days Remaining: ${project.days_until_deadline}</li>
        </ul>
        <p>Please ensure all deliverables are on track.</p>
        <p>Best regards,<br/>ABANCOOL Command Center</p>
      `;

      // Send notification to project team
      const result = await sendProjectTeamNotification(
        project.id,
        subject,
        message,
        {
          project_name: project.project_name,
          client_name: project.client_name,
          days_until_deadline: project.days_until_deadline,
          deadline: project.deadline
        }
      );

      // Log notification
      if (result.success) {
        await logNotification(project.id, 'deadline_alert', subject);
      }
    }

    return { success: true, checked_count: projects.length };
  } catch (err) {
    console.error("Deadline notification check error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Check and notify for budget exceeded projects
 */
async function checkBudgetNotifications() {
  try {
    // Find projects where spent > budget
    const projects = await db.query(`
      SELECT 
        p.id, p.project_id, p.project_name,
        p.budget, p.spent, (p.spent - p.budget) as exceeded_amount,
        c.company_name as client_name,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.deleted_at IS NULL
        AND p.budget > 0
        AND p.spent > p.budget
        AND NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE project_id = p.id
            AND type = 'budget_exceeded'
            AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
        )
    `);

    for (const project of projects) {
      const subject = `Budget Alert: Project ${project.project_name} Exceeded`;
      const message = `
        <p>Dear Finance Team,</p>
        <p>The project <strong>${project.project_name}</strong> for <strong>${project.client_name}</strong> 
        has <strong>exceeded its budget</strong>.</p>
        <p><strong>Budget Details:</strong></p>
        <ul>
          <li>Project ID: ${project.project_id}</li>
          <li>Allocated Budget: ${project.budget}</li>
          <li>Amount Spent: ${project.spent}</li>
          <li>Exceeded Amount: ${project.exceeded_amount}</li>
          <li>Exceeded By: ${calculateBudgetOverPercentage(project.budget, project.spent)}%</li>
        </ul>
        <p>Please review and approve the overspend or take corrective action.</p>
        <p>Best regards,<br/>ABANCOOL Command Center</p>
      `;

      // Send notification to Finance role
      const result = await sendNotificationToRole(
        'finance',
        subject,
        message,
        {
          project_name: project.project_name,
          client_name: project.client_name,
          budget: project.budget,
          spent: project.spent,
          exceeded_amount: project.exceeded_amount
        }
      );

      // Log notification
      if (result.success) {
        await logNotification(project.id, 'budget_exceeded', subject);
      }
    }

    return { success: true, checked_count: projects.length };
  } catch (err) {
    console.error("Budget notification check error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Log notification in database
 */
async function logNotification(projectId, type, message, recipientEmail = null) {
  try {
    // Create notifications table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        project_id BIGINT,
        type VARCHAR(50),
        message TEXT,
        recipient_email VARCHAR(255),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        INDEX idx_project_id (project_id),
        INDEX idx_type (type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Insert notification log
    await db.query(
      `INSERT INTO notifications (project_id, type, message, recipient_email) 
       VALUES (?, ?, ?, ?)`,
      [projectId, type, message, recipientEmail]
    );

    return { success: true };
  } catch (err) {
    console.error("Notification logging error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Helper function to calculate budget utilization percentage
 */
function calculateBudgetUtilization(budget, spent) {
  if (!budget || budget === 0) return 0;
  return Math.round((spent / budget) * 100);
}

/**
 * Helper function to calculate budget over percentage
 */
function calculateBudgetOverPercentage(budget, spent) {
  if (!budget || budget === 0) return 0;
  return Math.round(((spent - budget) / budget) * 100);
}

/**
 * Send immediate project budget exceeded notification
 */
async function sendBudgetExceededNotification(projectId) {
  try {
    // Get project details
    const project = await db.query(`
      SELECT 
        p.id, p.project_id, p.project_name,
        p.budget, p.spent,
        c.company_name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `, [projectId]);

    if (!project.length) {
      return { success: false, error: "Project not found" };
    }

    const proj = project[0];
    if (proj.spent <= proj.budget) {
      return { success: false, error: "Project budget not exceeded" };
    }

    const subject = `URGENT: Budget Alert - Project ${proj.project_name}`;
    const message = `
      <p>Dear Finance Team,</p>
      <p><strong>URGENT: Project budget has been exceeded!</strong></p>
      <p>The project <strong>${proj.project_name}</strong> for <strong>${proj.client_name}</strong> 
      has exceeded its allocated budget.</p>
      <p><strong>Budget Summary:</strong></p>
      <ul>
        <li>Project ID: ${proj.project_id}</li>
        <li>Allocated Budget: ${proj.budget}</li>
        <li>Amount Spent: ${proj.spent}</li>
        <li>Exceeded By: ${proj.spent - proj.budget}</li>
        <li>Over Budget: ${calculateBudgetOverPercentage(proj.budget, proj.spent)}%</li>
      </ul>
      <p>Immediate action required. Please review and approve the overspend.</p>
      <p>Best regards,<br/>ABANCOOL Command Center</p>
    `;

    // Send to Finance role
    const result = await sendNotificationToRole('finance', subject, message, {
      project_id: proj.project_id,
      project_name: proj.project_name,
      budget: proj.budget,
      spent: proj.spent
    });

    if (result.success) {
      await logNotification(projectId, 'budget_exceeded_urgent', subject);
    }

    return result;
  } catch (err) {
    console.error("Budget exceeded notification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send immediate project deadline approaching notification
 */
async function sendDeadlineApproachingNotification(projectId) {
  try {
    // Get project details
    const project = await db.query(`
      SELECT 
        p.id, p.project_id, p.project_name,
        p.deadline,
        c.company_name as client_name,
        DATEDIFF(p.deadline, CURDATE()) as days_until_deadline
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `, [projectId]);

    if (!project.length) {
      return { success: false, error: "Project not found" };
    }

    const proj = project[0];
    if (proj.days_until_deadline <= 0) {
      return { success: false, error: "Project deadline has passed" };
    }

    const subject = `Project Deadline Alert: ${proj.project_name}`;
    const message = `
      <p>Dear Project Team,</p>
      <p>The project <strong>${proj.project_name}</strong> for <strong>${proj.client_name}</strong> 
      has a deadline in <strong>${proj.days_until_deadline} days</strong>.</p>
      <p><strong>Deadline Details:</strong></p>
      <ul>
        <li>Project ID: ${proj.project_id}</li>
        <li>Deadline: ${proj.deadline}</li>
        <li>Days Remaining: ${proj.days_until_deadline}</li>
      </ul>
      <p>Please ensure all deliverables are ready for on-time delivery.</p>
      <p>Best regards,<br/>ABANCOOL Command Center</p>
    `;

    // Send to project team
    const result = await sendProjectTeamNotification(projectId, subject, message, {
      project_name: proj.project_name,
      deadline: proj.deadline,
      days_until_deadline: proj.days_until_deadline
    });

    if (result.success) {
      await logNotification(projectId, 'deadline_alert', subject);
    }

    return result;
  } catch (err) {
    console.error("Deadline notification error:", err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendEmailNotification,
  sendNotificationToRole,
  sendProjectTeamNotification,
  checkDeadlineNotifications,
  checkBudgetNotifications,
  logNotification,
  sendBudgetExceededNotification,
  sendDeadlineApproachingNotification
};
