const request = require('supertest');
const express = require('express');
const db = require('../src/config/db');
const projects = require('../src/controllers/projects.controller');
const { authRequired } = require('../src/middleware/auth');
const { requirePermission } = require('../src/middleware/rbac');

// Mock dependencies
jest.mock('../config/db');
jest.mock('../middleware/auth');
jest.mock('../middleware/rbac');

const app = express();
app.use(express.json());

// Mock middleware
authRequired.mockImplementation((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

requirePermission.mockImplementation(() => (req, res, next) => next());

// Setup routes
app.get('/projects', authRequired, requirePermission('read_projects'), projects.list);
app.get('/projects/:id', authRequired, requirePermission('read_projects'), projects.get);
app.post('/projects', authRequired, requirePermission('manage_projects'), projects.create);
app.put('/projects/:id', authRequired, requirePermission('manage_projects'), projects.update);
app.put('/projects/:id/status', authRequired, requirePermission('manage_projects'), projects.updateStatus);
app.put('/projects/:id/deployment', authRequired, requirePermission('manage_projects'), projects.addDeployment);
app.delete('/projects/:id', authRequired, requirePermission('manage_projects'), projects.remove);
app.post('/projects/:id/team', authRequired, requirePermission('manage_projects'), projects.assignTeamMember);
app.delete('/projects/:id/team/:userId', authRequired, requirePermission('manage_projects'), projects.removeTeamMember);
app.get('/projects/:id/team', authRequired, requirePermission('read_projects'), projects.getTeam);

describe('Projects Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /projects', () => {
    it('should list projects with pagination', async () => {
      const mockProjects = [
        {
          id: 1,
          project_id: 'PRJ-2024-123456',
          project_name: 'Test Project',
          status: 'planning',
          client_name: 'Test Client',
          budget: 10000,
          spent: 2000,
          budget_utilization_percent: 20
        }
      ];

      db.query
        .mockResolvedValueOnce([{ total: 1 }]) // Count query
        .mockResolvedValueOnce(mockProjects); // Projects query

      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toEqual(mockProjects);
      expect(response.body.data.pagination.total).toBe(1);
    });

    it('should filter projects by status', async () => {
      db.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/projects?status=in_progress')
        .expect(200);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.status = ?'),
        expect.arrayContaining(['in_progress'])
      );
    });

    it('should filter projects by client_id', async () => {
      db.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/projects?client_id=1')
        .expect(200);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND p.client_id = ?'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('GET /projects/:id', () => {
    it('should get project details with team and files', async () => {
      const mockProject = {
        id: 1,
        project_id: 'PRJ-2024-123456',
        project_name: 'Test Project',
        status: 'planning',
        client_name: 'Test Client',
        budget: 10000,
        spent: 2000,
        budget_utilization_percent: 20
      };

      const mockTeam = [
        {
          id: 1,
          user_id: 2,
          user_name: 'John Doe',
          role: 'Developer',
          assigned_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      db.query
        .mockResolvedValueOnce([mockProject]) // Project query
        .mockResolvedValueOnce(mockTeam) // Team query
        .mockResolvedValueOnce([]); // Files query

      const response = await request(app)
        .get('/projects/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project).toEqual(mockProject);
      expect(response.body.data.team).toEqual(mockTeam);
    });

    it('should return 404 for non-existent project', async () => {
      db.query.mockResolvedValueOnce([]); // Empty result

      const response = await request(app)
        .get('/projects/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('POST /projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        client_id: 1,
        project_name: 'New Project',
        description: 'Test description',
        status: 'planning',
        budget: 15000,
        deadline: '2024-12-31'
      };

      const mockCreatedProject = {
        id: 1,
        project_id: 'PRJ-2024-123456',
        ...projectData,
        client_name: 'Test Client'
      };

      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Client exists check
        .mockResolvedValueOnce({ insertId: 1 }) // Insert query
        .mockResolvedValueOnce([mockCreatedProject]); // Get created project

      const response = await request(app)
        .post('/projects')
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project.project_name).toBe(projectData.project_name);
    });

    it('should return 400 for invalid client_id', async () => {
      const projectData = {
        client_id: 999,
        project_name: 'New Project'
      };

      db.query.mockResolvedValueOnce([]); // Client not found

      const response = await request(app)
        .post('/projects')
        .send(projectData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Client not found');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/projects')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('PUT /projects/:id', () => {
    it('should update project information', async () => {
      const updateData = {
        project_name: 'Updated Project',
        budget: 20000
      };

      const mockExistingProject = {
        id: 1,
        status: 'planning',
        budget: 15000,
        spent: 5000
      };

      const mockUpdatedProject = {
        id: 1,
        project_name: 'Updated Project',
        budget: 20000,
        budget_utilization_percent: 25
      };

      db.query
        .mockResolvedValueOnce([mockExistingProject]) // Check project exists
        .mockResolvedValueOnce() // Update query
        .mockResolvedValueOnce([mockUpdatedProject]); // Get updated project

      const response = await request(app)
        .put('/projects/1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project.project_name).toBe(updateData.project_name);
    });

    it('should validate status transitions', async () => {
      const updateData = {
        status: 'completed'
      };

      const mockExistingProject = {
        id: 1,
        status: 'planning',
        budget: 15000,
        spent: 5000
      };

      db.query.mockResolvedValueOnce([mockExistingProject]);

      const response = await request(app)
        .put('/projects/1')
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status transition');
    });

    it('should prevent budget less than spent amount', async () => {
      const updateData = {
        budget: 1000
      };

      const mockExistingProject = {
        id: 1,
        status: 'planning',
        budget: 15000,
        spent: 5000
      };

      db.query.mockResolvedValueOnce([mockExistingProject]);

      const response = await request(app)
        .put('/projects/1')
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Budget cannot be less than amount already spent');
    });
  });

  describe('PUT /projects/:id/status', () => {
    it('should update project status', async () => {
      const statusData = {
        status: 'in_progress'
      };

      const mockExistingProject = {
        id: 1,
        status: 'planning'
      };

      const mockUpdatedProject = {
        id: 1,
        status: 'in_progress',
        client_name: 'Test Client'
      };

      db.query
        .mockResolvedValueOnce([mockExistingProject]) // Check project exists
        .mockResolvedValueOnce() // Update query
        .mockResolvedValueOnce([mockUpdatedProject]); // Get updated project

      const response = await request(app)
        .put('/projects/1/status')
        .send(statusData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project.status).toBe(statusData.status);
    });

    it('should set deployed_at when status changes to deployed', async () => {
      const statusData = {
        status: 'deployed',
        deployment_url: 'https://example.com'
      };

      const mockExistingProject = {
        id: 1,
        status: 'testing'
      };

      db.query
        .mockResolvedValueOnce([mockExistingProject])
        .mockResolvedValueOnce()
        .mockResolvedValueOnce([{ id: 1, status: 'deployed' }]);

      const response = await request(app)
        .put('/projects/1/status')
        .send(statusData)
        .expect(200);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('deployed_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('PUT /projects/:id/deployment', () => {
    it('should add deployment URL', async () => {
      const deploymentData = {
        deployment_url: 'https://example.com'
      };

      const mockExistingProject = {
        id: 1,
        status: 'testing'
      };

      db.query
        .mockResolvedValueOnce([mockExistingProject])
        .mockResolvedValueOnce()
        .mockResolvedValueOnce([{ id: 1, deployment_url: 'https://example.com' }]);

      const response = await request(app)
        .put('/projects/1/deployment')
        .send(deploymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate URL format', async () => {
      const deploymentData = {
        deployment_url: 'invalid-url'
      };

      const response = await request(app)
        .put('/projects/1/deployment')
        .send(deploymentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid URL format');
    });
  });

  describe('DELETE /projects/:id', () => {
    it('should soft delete project', async () => {
      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Check project exists
        .mockResolvedValueOnce(); // Delete query

      const response = await request(app)
        .delete('/projects/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Project deleted successfully');
    });

    it('should return 404 for non-existent project', async () => {
      db.query.mockResolvedValueOnce([]); // Project not found

      const response = await request(app)
        .delete('/projects/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('POST /projects/:id/team', () => {
    it('should assign team member to project', async () => {
      const teamData = {
        user_id: 2,
        role: 'Developer'
      };

      const mockCreatedAssignment = {
        id: 1,
        user_id: 2,
        role: 'Developer',
        user_name: 'John Doe',
        user_email: 'john@example.com'
      };

      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Check project exists
        .mockResolvedValueOnce([{ id: 2 }]) // Check user exists
        .mockResolvedValueOnce([]) // Check no existing assignment
        .mockResolvedValueOnce({ insertId: 1 }) // Insert assignment
        .mockResolvedValueOnce([mockCreatedAssignment]); // Get created assignment

      const response = await request(app)
        .post('/projects/1/team')
        .send(teamData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignment.user_id).toBe(teamData.user_id);
    });

    it('should prevent duplicate assignments', async () => {
      const teamData = {
        user_id: 2,
        role: 'Developer'
      };

      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Check project exists
        .mockResolvedValueOnce([{ id: 2 }]) // Check user exists
        .mockResolvedValueOnce([{ id: 1 }]); // Existing assignment found

      const response = await request(app)
        .post('/projects/1/team')
        .send(teamData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User is already assigned to this project');
    });
  });

  describe('DELETE /projects/:id/team/:userId', () => {
    it('should remove team member from project', async () => {
      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Check assignment exists
        .mockResolvedValueOnce(); // Delete assignment

      const response = await request(app)
        .delete('/projects/1/team/2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Team member removed successfully');
    });

    it('should return 404 for non-existent assignment', async () => {
      db.query.mockResolvedValueOnce([]); // Assignment not found

      const response = await request(app)
        .delete('/projects/1/team/999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Team member assignment not found');
    });
  });

  describe('GET /projects/:id/team', () => {
    it('should get project team members', async () => {
      const mockTeam = [
        {
          id: 1,
          user_id: 2,
          user_name: 'John Doe',
          role: 'Developer',
          assigned_at: '2024-01-01T00:00:00.000Z'
        }
      ];

      db.query
        .mockResolvedValueOnce([{ id: 1 }]) // Check project exists
        .mockResolvedValueOnce(mockTeam); // Get team

      const response = await request(app)
        .get('/projects/1/team')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.team).toEqual(mockTeam);
    });
  });
});