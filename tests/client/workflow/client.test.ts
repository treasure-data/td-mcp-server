import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowClient } from '../../../src/client/workflow/client';
import { maskApiKey } from '../../../src/config';

// Mock fetch globally
global.fetch = vi.fn();

// Mock config module
vi.mock('../../../src/config', () => ({
  maskApiKey: vi.fn((key: string) => `${key.substring(0, 4)}...${key.substring(key.length - 4)}`),
}));

describe('WorkflowClient', () => {
  let client: WorkflowClient;
  const mockApiKey = 'test_api_key_123456';
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new WorkflowClient({
      apiKey: mockApiKey,
      site: 'us01',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct settings', () => {
      const customClient = new WorkflowClient({
        apiKey: 'key123',
        site: 'jp01',
        timeout: 60000,
      });
      expect(customClient).toBeDefined();
    });

    it('should use default timeout when not specified', () => {
      const defaultClient = new WorkflowClient({
        apiKey: 'key123',
        site: 'us01',
      });
      expect(defaultClient).toBeDefined();
    });
  });

  describe('listWorkflows', () => {
    it('should fetch workflows successfully', async () => {
      const mockResponse = {
        workflows: [
          { id: '1', name: 'workflow1', project: 'test', revision: 'abc', timezone: 'UTC' },
          { id: '2', name: 'workflow2', project: 'test', revision: 'def', timezone: 'UTC' },
        ],
        next_page_id: 'next123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listWorkflows({
        project_name: 'test',
        limit: 10,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/projects/test/workflows?page_size=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `TD1 ${mockApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ workflows: [], next_page_id: null }),
      });

      await client.listWorkflows({
        project_name: 'test',
        limit: 50,
        last_id: 'last123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page_size=50&last_id=last123'),
        expect.any(Object)
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Project not found',
      });

      await expect(client.listWorkflows({ project_name: 'nonexistent' }))
        .rejects.toThrow('Workflow API error (404): Project not found');
    });
  });

  describe('listSessions', () => {
    it('should list all sessions without filters', async () => {
      const mockResponse = {
        sessions: [
          {
            id: '1',
            project: 'test',
            workflow: 'wf1',
            session_uuid: 'uuid1',
            session_time: '2024-01-01T00:00:00Z',
            status: 'success' as const,
            params: {},
          },
        ],
        next_page_id: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listSessions({});

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/sessions',
        expect.any(Object)
      );
    });

    it('should list sessions for specific workflow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [], next_page_id: null }),
      });

      await client.listSessions({
        project_name: 'test',
        workflow_name: 'workflow1',
        status: 'error',
        from_time: '2024-01-01T00:00:00Z',
        to_time: '2024-01-02T00:00:00Z',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/test/workflows/workflow1/sessions'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=error'),
        expect.any(Object)
      );
    });
  });

  describe('getSessionAttempts', () => {
    it('should get attempts for a session', async () => {
      const mockResponse = {
        attempts: [
          {
            id: '1',
            index: 1,
            status: 'error' as const,
            stateParams: {},
            done: true,
            success: false,
            cancelRequested: false,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getSessionAttempts('session123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/sessions/session123/attempts',
        expect.any(Object)
      );
    });
  });

  describe('getAttemptTasks', () => {
    it('should get tasks with subtasks by default', async () => {
      const mockResponse = {
        tasks: [
          {
            id: '1',
            fullName: '+main+task1',
            state: 'success' as const,
            config: {},
            upstreams: [],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getAttemptTasks('attempt123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('include_subtasks=true'),
        expect.any(Object)
      );
    });

    it('should exclude subtasks when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      });

      await client.getAttemptTasks('attempt123', false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('include_subtasks=false'),
        expect.any(Object)
      );
    });
  });

  describe('getTaskLogs', () => {
    it('should get logs for a specific task', async () => {
      const mockResponse = {
        logs: '2024-01-01 00:00:00 [INFO] Task started',
        next_offset: 1024,
        has_more: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getTaskLogs({
        attempt_id: 'attempt123',
        task_name: '+main+task1',
        offset: 0,
        limit: 1000,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/attempts/attempt123/tasks/%2Bmain%2Btask1/logs'),
        expect.any(Object)
      );
    });
  });

  describe('getAttemptLogs', () => {
    it('should get aggregated logs with filters', async () => {
      const mockResponse = {
        logs: [
          {
            task: '+main+task1',
            timestamp: '2024-01-01T00:00:00Z',
            level: 'ERROR' as const,
            message: 'Task failed',
            context: { attempt_id: 'attempt123', session_id: 'session123' },
          },
        ],
        next_offset: 2048,
        has_more: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getAttemptLogs({
        attempt_id: 'attempt123',
        task_filter: 'main',
        level_filter: 'ERROR',
        limit: 5000,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('task_filter=main&level_filter=ERROR'),
        expect.any(Object)
      );
    });
  });

  describe('killAttempt', () => {
    it('should kill an attempt with reason', async () => {
      const mockResponse = {
        success: true,
        message: 'Cancellation requested',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.killAttempt('attempt123', 'User requested');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/attempts/attempt123/kill',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason: 'User requested' }),
        })
      );
    });
  });

  describe('retrySession', () => {
    it('should retry a session from specific task', async () => {
      const mockResponse = {
        attempt_id: 'new_attempt123',
        message: 'Retry attempt created',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.retrySession({
        session_id: 'session123',
        from_task: '+main+task2',
        retry_params: { override: 'value' },
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/sessions/session123/retry',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            from_task: '+main+task2',
            params: { override: 'value' },
          }),
        })
      );
    });
  });

  describe('retryAttempt', () => {
    it('should retry an attempt with resume', async () => {
      const mockResponse = {
        new_attempt_id: 'new_attempt123',
        session_id: 'session123',
        message: 'Retry attempt created',
        resumed_from: '+main+task3',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.retryAttempt({
        attempt_id: 'attempt123',
        resume_from: '+main+task3',
        retry_params: { param: 'value' },
        force: true,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/attempts/attempt123/retry',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            resume_from: '+main+task3',
            params: { param: 'value' },
            force: true,
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should mask API key in error messages', async () => {
      const errorMessage = `Connection failed with key ${mockApiKey}`;
      mockFetch.mockRejectedValueOnce(new Error(errorMessage));

      await expect(client.listWorkflows({ project_name: 'test' }))
        .rejects.toThrow('Connection failed with key test...3456');

      expect(maskApiKey).toHaveBeenCalledWith(mockApiKey);
    });

    it('should handle network timeout', async () => {
      // Mock AbortController behavior
      let abortSignal: AbortSignal | undefined;
      mockFetch.mockImplementationOnce((url: string, options: any) => {
        abortSignal = options.signal;
        // Simulate network delay longer than timeout
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ workflows: [] }),
            });
          }, 200);

          // Listen for abort signal
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('The operation was aborted'));
            });
          }
        });
      });

      const fastClient = new WorkflowClient({
        apiKey: mockApiKey,
        site: 'us01',
        timeout: 50, // 50ms timeout (shorter than mock delay)
      });

      await expect(fastClient.listWorkflows({ project_name: 'test' }))
        .rejects.toThrow('The operation was aborted');
    });

    it('should handle non-JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => { throw new Error('Not JSON'); },
      });

      await expect(client.listWorkflows({ project_name: 'test' }))
        .rejects.toThrow('Workflow API error (500): Unknown error');
    });
  });

  describe('listProjects', () => {
    it('should list all projects', async () => {
      const mockResponse = {
        projects: [
          {
            id: '1',
            name: 'project1',
            revision: 'abc123',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            archiveType: 's3',
            archiveMd5: 'md5hash',
          },
          {
            id: '2',
            name: 'project2',
            revision: 'def456',
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
            archiveType: 's3',
            archiveMd5: 'md5hash2',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.listProjects({ limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/projects?page_size=10',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      await client.listProjects({ limit: 20, last_id: 'abc' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api-workflow.treasuredata.com/api/projects?page_size=20&last_id=abc',
        expect.any(Object)
      );
    });
  });
});