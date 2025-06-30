import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAttemptTasks } from '../../../src/tools/workflow/get-attempt-tasks';
import { loadConfig } from '../../../src/config';
import { WorkflowClient } from '../../../src/client/workflow';

vi.mock('../../../src/config');
vi.mock('../../../src/client/workflow');

describe('getAttemptTasks tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockWorkflowClient = WorkflowClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLoadConfig.mockReturnValue({
      td_api_key: 'test_key',
      site: 'us01',
    });

    mockClient = {
      getAttemptTasks: vi.fn(),
    };

    MockWorkflowClient.mockImplementation(() => mockClient);
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(getAttemptTasks.name).toBe('get_attempt_tasks');
      expect(getAttemptTasks.description).toBe('List all tasks within an attempt with their execution status');
      expect(getAttemptTasks.inputSchema).toEqual({
        type: 'object',
        properties: {
          attempt_id: {
            type: 'string',
            description: 'Attempt ID',
          },
          include_subtasks: {
            type: 'boolean',
            description: 'Include subtasks (default: true)',
          },
        },
        required: ['attempt_id'],
      });
    });
  });

  describe('handler', () => {
    it('should get tasks and prioritize failed tasks', async () => {
      const mockResponse = {
        tasks: [
          {
            id: '1',
            fullName: '+main+task1',
            state: 'success',
            config: {},
            upstreams: [],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            fullName: '+main+task2',
            state: 'error',
            config: {},
            upstreams: ['1'],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:01:00Z',
            error: {
              message: 'Connection timeout',
              type: 'NetworkError',
            },
          },
          {
            id: '3',
            fullName: '+main+task3',
            state: 'success',
            config: {},
            upstreams: ['1'],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:02:00Z',
          },
          {
            id: '4',
            fullName: '+main+task4',
            state: 'error',
            config: {},
            upstreams: ['3'],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:03:00Z',
            error: {
              message: 'Invalid input',
              type: 'ValidationError',
            },
          },
        ],
      };

      mockClient.getAttemptTasks.mockResolvedValue(mockResponse);

      const result = await getAttemptTasks.handler({
        attempt_id: 'attempt123',
      });

      // Verify failed tasks come first
      expect(result.tasks[0].state).toBe('error');
      expect(result.tasks[1].state).toBe('error');
      expect(result.tasks[2].state).toBe('success');
      expect(result.tasks[3].state).toBe('success');

      expect(result).toEqual({
        tasks: [
          mockResponse.tasks[1], // error task
          mockResponse.tasks[3], // error task
          mockResponse.tasks[0], // success task
          mockResponse.tasks[2], // success task
        ],
        count: 4,
        failed_count: 2,
      });

      expect(mockClient.getAttemptTasks).toHaveBeenCalledWith('attempt123', true);
    });

    it('should handle include_subtasks parameter', async () => {
      mockClient.getAttemptTasks.mockResolvedValue({ tasks: [] });

      await getAttemptTasks.handler({
        attempt_id: 'attempt123',
        include_subtasks: false,
      });

      expect(mockClient.getAttemptTasks).toHaveBeenCalledWith('attempt123', false);
    });

    it('should handle attempts with no failed tasks', async () => {
      const mockResponse = {
        tasks: [
          {
            id: '1',
            fullName: '+main+task1',
            state: 'success',
            config: {},
            upstreams: [],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            fullName: '+main+task2',
            state: 'success',
            config: {},
            upstreams: ['1'],
            exportParams: {},
            storeParams: {},
            stateParams: {},
            updatedAt: '2024-01-01T00:01:00Z',
          },
        ],
      };

      mockClient.getAttemptTasks.mockResolvedValue(mockResponse);

      const result = await getAttemptTasks.handler({
        attempt_id: 'attempt123',
      });

      expect(result).toEqual({
        tasks: mockResponse.tasks,
        count: 2,
        failed_count: 0,
      });
    });

    it('should handle empty task list', async () => {
      mockClient.getAttemptTasks.mockResolvedValue({ tasks: [] });

      const result = await getAttemptTasks.handler({
        attempt_id: 'attempt123',
      });

      expect(result).toEqual({
        tasks: [],
        count: 0,
        failed_count: 0,
      });
    });

    it('should throw error when attempt_id is missing', async () => {
      await expect(getAttemptTasks.handler({}))
        .rejects.toThrow('attempt_id is required');

      expect(mockClient.getAttemptTasks).not.toHaveBeenCalled();
    });

    it('should handle client errors gracefully', async () => {
      mockClient.getAttemptTasks.mockRejectedValue(new Error('API error'));

      await expect(getAttemptTasks.handler({
        attempt_id: 'attempt123',
      })).rejects.toThrow('Failed to get attempt tasks: API error');
    });
  });
});