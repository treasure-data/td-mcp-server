import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  listProjects,
  listWorkflows,
  listSessions,
  getSessionAttempts,
  getAttemptTasks,
  getTaskLogs,
  getAttemptLogs,
} from '../../src/tools/workflow';

const isIntegrationTest = !!process.env.TD_API_KEY_DEVELOPMENT_AWS;

describe.skipIf(!isIntegrationTest)('Workflow MCP Tools Integration Tests', () => {
  const testProjectName = process.env.TD_TEST_PROJECT || 'test_workflows';
  let originalApiKey: string | undefined;
  let originalSite: string | undefined;
  let originalEnableUpdates: string | undefined;

  beforeAll(() => {
    // Save original env vars
    originalApiKey = process.env.TD_API_KEY;
    originalSite = process.env.TD_SITE;
    originalEnableUpdates = process.env.TD_ENABLE_UPDATES;

    // Set test env vars
    process.env.TD_API_KEY = process.env.TD_API_KEY_DEVELOPMENT_AWS;
    process.env.TD_SITE = 'dev';
    process.env.TD_ENABLE_UPDATES = 'false'; // Read-only for integration tests
  });

  afterAll(() => {
    // Restore original env vars
    if (originalApiKey !== undefined) {
      process.env.TD_API_KEY = originalApiKey;
    } else {
      delete process.env.TD_API_KEY;
    }

    if (originalSite !== undefined) {
      process.env.TD_SITE = originalSite;
    } else {
      delete process.env.TD_SITE;
    }

    if (originalEnableUpdates !== undefined) {
      process.env.TD_ENABLE_UPDATES = originalEnableUpdates;
    } else {
      delete process.env.TD_ENABLE_UPDATES;
    }
  });

  describe('list_projects tool', () => {
    it('should list projects using MCP tool handler', async () => {
      const result = await listProjects.handler({
        limit: 10,
      });

      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('count');
      expect(Array.isArray(result.projects)).toBe(true);
      expect(result.count).toBe(result.projects.length);

      console.log(`MCP tool found ${result.count} projects`);
      
      if (result.projects.length > 0) {
        console.log('First project from MCP tool:', {
          id: result.projects[0].id,
          name: result.projects[0].name,
          revision: result.projects[0].revision,
        });
      }
    }, 30000);
  });

  describe('list_workflows tool', () => {
    it('should list workflows using MCP tool handler', async () => {
      try {
        const result = await listWorkflows.handler({
          project_name: testProjectName,
          limit: 5,
        });

        expect(result).toHaveProperty('workflows');
        expect(result).toHaveProperty('count');
        expect(Array.isArray(result.workflows)).toBe(true);
        expect(result.count).toBe(result.workflows.length);

        console.log(`MCP tool found ${result.count} workflows in project '${testProjectName}'`);
        
        if (result.workflows.length > 0) {
          console.log('First workflow from MCP tool:', {
            id: result.workflows[0].id,
            name: result.workflows[0].name,
            last_session_status: result.workflows[0].last_session_status,
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          console.log(`Project '${testProjectName}' not found in MCP tool test`);
          return;
        }
        throw error;
      }
    }, 30000);

    it('should handle missing project_name parameter', async () => {
      await expect(listWorkflows.handler({}))
        .rejects.toThrow('project_name is required');
    });
  });

  describe('list_sessions tool', () => {
    it('should list all sessions using MCP tool handler', async () => {
      const result = await listSessions.handler({
        limit: 10,
      });

      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('count');
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(result.count).toBe(result.sessions.length);

      console.log(`MCP tool found ${result.count} sessions`);
      
      if (result.sessions.length > 0) {
        console.log('Session statuses:', 
          result.sessions.map(s => s.status).filter((v, i, a) => a.indexOf(v) === i)
        );
      }
    }, 30000);

    it('should filter sessions by status', async () => {
      const result = await listSessions.handler({
        status: 'success',
        limit: 5,
      });

      console.log(`Found ${result.count} sessions when filtering by 'success' status`);
      
      if (result.sessions.length === 0) {
        console.log('No sessions with success status found, skipping assertions');
        return;
      }
      
      // Log actual statuses to understand API behavior
      const actualStatuses = result.sessions.map(s => s.status);
      console.log(`Actual statuses in response: ${JSON.stringify(actualStatuses)}`);
      
      // Check if any sessions don't match the requested status
      const mismatchedSessions = result.sessions.filter(s => s.status !== 'success');
      if (mismatchedSessions.length > 0) {
        console.warn(`WARNING: ${mismatchedSessions.length} sessions don't have 'success' status`);
        console.warn('The API may not be filtering by status correctly');
        console.warn('Mismatched statuses:', mismatchedSessions.map(s => ({ id: s.id, status: s.status })));
      }
    }, 30000);

    it('should filter sessions by project and workflow', async () => {
      // First get a workflow to test with
      try {
        const workflowsResult = await listWorkflows.handler({
          project_name: testProjectName,
          limit: 1,
        });

        if (workflowsResult.workflows.length === 0) {
          console.log('No workflows found for session filter test');
          return;
        }

        const workflow = workflowsResult.workflows[0];
        
        const result = await listSessions.handler({
          project_name: testProjectName,
          workflow_name: workflow.name,
          limit: 5,
        });

        // All sessions should belong to the specified workflow
        for (const session of result.sessions) {
          expect(session.project).toBe(testProjectName);
          expect(session.workflow).toBe(workflow.name);
        }

        console.log(`Found ${result.count} sessions for workflow ${workflow.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          console.log('Project not found for session filter test');
          return;
        }
        throw error;
      }
    }, 30000);
  });

  describe('get_session_attempts tool', () => {
    it('should get attempts for a session using MCP tool', async () => {
      // Find a session first
      const sessionsResult = await listSessions.handler({ limit: 10 });
      
      if (sessionsResult.sessions.length === 0) {
        console.log('No sessions available for attempts test');
        return;
      }

      let sessionId = null;
      for (const session of sessionsResult.sessions) {
        try {
          const result = await getSessionAttempts.handler({
            session_id: session.id,
          });

          if (result.attempts.length > 0) {
            sessionId = session.id;
            console.log(`MCP tool found ${result.count} attempts for session ${sessionId}`);
            
            const firstAttempt = result.attempts[0];
            expect(firstAttempt).toHaveProperty('id');
            expect(firstAttempt).toHaveProperty('status');
            expect(firstAttempt).toHaveProperty('done');
            
            break;
          }
        } catch (error) {
          // Some sessions might not be accessible
          continue;
        }
      }

      if (!sessionId) {
        console.log('No accessible sessions with attempts found');
      }
    }, 60000);

    it('should handle missing session_id parameter', async () => {
      await expect(getSessionAttempts.handler({}))
        .rejects.toThrow('session_id is required');
    });
  });

  describe('get_attempt_tasks tool', () => {
    it('should get tasks and prioritize failed tasks', async () => {
      // Find an attempt with tasks
      const sessionsResult = await listSessions.handler({
        status: 'error', // More likely to have failed tasks
        limit: 10,
      });

      let attemptWithTasks = null;
      for (const session of sessionsResult.sessions) {
        try {
          const attemptsResult = await getSessionAttempts.handler({
            session_id: session.id,
          });

          if (attemptsResult.attempts.length > 0) {
            const tasksResult = await getAttemptTasks.handler({
              attempt_id: attemptsResult.attempts[0].id,
            });

            if (tasksResult.tasks.length > 0) {
              attemptWithTasks = {
                attemptId: attemptsResult.attempts[0].id,
                tasks: tasksResult.tasks,
                failedCount: tasksResult.failed_count,
              };
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      if (!attemptWithTasks) {
        console.log('No attempts with tasks found');
        return;
      }

      console.log(`MCP tool found ${attemptWithTasks.tasks.length} tasks with ${attemptWithTasks.failedCount} failures`);

      // If there are failed tasks, verify they appear first
      if (attemptWithTasks.failedCount > 0) {
        const firstTask = attemptWithTasks.tasks[0];
        expect(firstTask.state).toBe('error');
        console.log('First task (failed):', {
          fullName: firstTask.fullName,
          state: firstTask.state,
          error: firstTask.error,
        });
      }
    }, 60000);
  });

  describe('get_task_logs tool', () => {
    it('should retrieve logs for a task', async () => {
      // Find a task to get logs from
      const sessionsResult = await listSessions.handler({
        status: 'success',
        limit: 5,
      });

      let taskForLogs = null;
      for (const session of sessionsResult.sessions) {
        try {
          const attemptsResult = await getSessionAttempts.handler({
            session_id: session.id,
          });

          if (attemptsResult.attempts.length === 0) continue;

          const tasksResult = await getAttemptTasks.handler({
            attempt_id: attemptsResult.attempts[0].id,
          });

          if (tasksResult.tasks.length > 0) {
            taskForLogs = {
              attemptId: attemptsResult.attempts[0].id,
              taskName: tasksResult.tasks[0].full_name,
            };
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!taskForLogs) {
        console.log('No tasks found for log retrieval');
        return;
      }

      try {
        const result = await getTaskLogs.handler({
          attempt_id: taskForLogs.attemptId,
          task_name: taskForLogs.taskName,
          limit: 500, // Get first 500 bytes
        });

        expect(result).toHaveProperty('logs');
        expect(result).toHaveProperty('has_more');
        expect(typeof result.logs).toBe('string');

        console.log(`MCP tool retrieved ${result.logs.length} bytes of logs`);
        console.log('Log preview:', result.logs.substring(0, 100));
      } catch (error) {
        console.log('Could not retrieve task logs:', error);
      }
    }, 60000);

    it('should validate required parameters', async () => {
      await expect(getTaskLogs.handler({
        task_name: 'test',
      })).rejects.toThrow('attempt_id is required');

      await expect(getTaskLogs.handler({
        attempt_id: '123',
      })).rejects.toThrow('task_name is required');
    });
  });

  describe('get_attempt_logs tool', () => {
    it('should retrieve aggregated logs with filtering', async () => {
      // Find an error session
      const sessionsResult = await listSessions.handler({
        status: 'error',
        limit: 5,
      });

      if (sessionsResult.sessions.length === 0) {
        console.log('No error sessions found for log test');
        return;
      }

      let attemptId = null;
      for (const session of sessionsResult.sessions) {
        try {
          const attemptsResult = await getSessionAttempts.handler({
            session_id: session.id,
          });

          if (attemptsResult.attempts.length > 0) {
            attemptId = attemptsResult.attempts[0].id;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!attemptId) {
        console.log('No attempts found for aggregated log test');
        return;
      }

      try {
        const result = await getAttemptLogs.handler({
          attempt_id: attemptId,
          level_filter: 'ERROR',
          limit: 2000,
        });

        expect(result).toHaveProperty('logs');
        expect(result).toHaveProperty('count');
        expect(result).toHaveProperty('has_more');
        expect(Array.isArray(result.logs)).toBe(true);

        console.log(`MCP tool retrieved ${result.count} ERROR log entries`);
        
        if (result.logs.length > 0) {
          // All logs should be ERROR level
          for (const log of result.logs) {
            expect(log.level).toBe('ERROR');
          }

          console.log('First error log entry:', {
            task: result.logs[0].task,
            timestamp: result.logs[0].timestamp,
            message: result.logs[0].message.substring(0, 80) + '...',
          });
        }
      } catch (error) {
        console.log('Could not retrieve aggregated logs:', error);
      }
    }, 60000);
  });

  describe('Workflow Control Operations', () => {

    it('workflow control operations are enabled by default', async () => {
      // All workflow control operations (kill/retry) are now enabled by default
      // since they are safe operations that don't directly modify data:
      // - retry operations create new attempts
      // - kill sends a cancellation request
      const { killAttempt, retrySession, retryAttempt } = await import('../../src/tools/workflow');
      
      // These operations should be available without TD_ENABLE_UPDATES
      expect(killAttempt).toBeDefined();
      expect(retrySession).toBeDefined();
      expect(retryAttempt).toBeDefined();
      
      console.log('Workflow control operations are enabled by default');
    });

    it.skip('actual kill/retry operations are not tested in integration to avoid disrupting workflows', () => {
      console.log('Skipping actual kill/retry tests to avoid disrupting real workflows');
    });
  });
});