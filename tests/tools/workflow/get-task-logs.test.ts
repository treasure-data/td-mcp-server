import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTaskLogs } from '../../../src/tools/workflow/get-task-logs';
import { loadConfig } from '../../../src/config';
import { WorkflowClient } from '../../../src/client/workflow';

vi.mock('../../../src/config');
vi.mock('../../../src/client/workflow');

describe('getTaskLogs tool', () => {
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
      getTaskLogs: vi.fn(),
    };

    MockWorkflowClient.mockImplementation(function(this: any) {
      return mockClient;
    });
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(getTaskLogs.name).toBe('get_task_logs');
      expect(getTaskLogs.description).toBe('Retrieve logs for a specific task');
      expect(getTaskLogs.inputSchema).toEqual({
        type: 'object',
        properties: {
          attempt_id: {
            type: 'string',
            description: 'Attempt ID',
          },
          task_name: {
            type: 'string',
            description: 'Full task name (e.g., "+main+extract_data")',
          },
          offset: {
            type: 'number',
            description: 'Byte offset for pagination',
          },
          limit: {
            type: 'number',
            description: 'Maximum bytes to return (default: 1MB)',
          },
        },
        required: ['attempt_id', 'task_name'],
      });
    });
  });

  describe('handler', () => {
    it('should retrieve task logs successfully', async () => {
      const mockLogs = `2024-01-01 00:00:00 +0000 [INFO] Starting data extraction...
2024-01-01 00:00:05 +0000 [INFO] Connected to database
2024-01-01 00:00:10 +0000 [INFO] Extracted 1000 records
2024-01-01 00:00:15 +0000 [ERROR] Connection timeout to remote API
2024-01-01 00:00:16 +0000 [ERROR] Task failed`;

      const mockResponse = {
        logs: mockLogs,
        next_offset: 2048,
        has_more: true,
      };

      mockClient.getTaskLogs.mockResolvedValue(mockResponse);

      const result = await getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+extract_data',
      });

      expect(result).toEqual({
        logs: mockLogs,
        next_offset: 2048,
        has_more: true,
      });

      expect(mockClient.getTaskLogs).toHaveBeenCalledWith({
        attempt_id: 'attempt123',
        task_name: '+main+extract_data',
        offset: undefined,
        limit: 1048576, // 1MB default
      });
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        logs: 'Partial logs...',
        next_offset: 5000,
        has_more: true,
      };

      mockClient.getTaskLogs.mockResolvedValue(mockResponse);

      await getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+task',
        offset: 2048,
        limit: 4096,
      });

      expect(mockClient.getTaskLogs).toHaveBeenCalledWith({
        attempt_id: 'attempt123',
        task_name: '+main+task',
        offset: 2048,
        limit: 4096,
      });
    });

    it('should handle task names with special characters', async () => {
      const mockResponse = {
        logs: '',
        next_offset: undefined,
        has_more: false,
      };

      mockClient.getTaskLogs.mockResolvedValue(mockResponse);

      await getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+task:with:colons+and+plus',
      });

      expect(mockClient.getTaskLogs).toHaveBeenCalledWith({
        attempt_id: 'attempt123',
        task_name: '+main+task:with:colons+and+plus',
        offset: undefined,
        limit: 1048576,
      });
    });

    it('should handle empty logs', async () => {
      const mockResponse = {
        logs: '',
        next_offset: undefined,
        has_more: false,
      };

      mockClient.getTaskLogs.mockResolvedValue(mockResponse);

      const result = await getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+no_logs_task',
      });

      expect(result).toEqual({
        logs: '',
        next_offset: undefined,
        has_more: false,
      });
    });

    it('should use default limit when not specified', async () => {
      mockClient.getTaskLogs.mockResolvedValue({
        logs: 'logs',
        has_more: false,
      });

      await getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+task',
      });

      expect(mockClient.getTaskLogs).toHaveBeenCalledWith({
        attempt_id: 'attempt123',
        task_name: '+main+task',
        offset: undefined,
        limit: 1048576, // 1MB in bytes
      });
    });

    it('should throw error when attempt_id is missing', async () => {
      await expect(getTaskLogs.handler({
        task_name: '+main+task',
      })).rejects.toThrow('attempt_id is required');

      expect(mockClient.getTaskLogs).not.toHaveBeenCalled();
    });

    it('should throw error when task_name is missing', async () => {
      await expect(getTaskLogs.handler({
        attempt_id: 'attempt123',
      })).rejects.toThrow('task_name is required');

      expect(mockClient.getTaskLogs).not.toHaveBeenCalled();
    });

    it('should handle client errors gracefully', async () => {
      mockClient.getTaskLogs.mockRejectedValue(new Error('Task not found'));

      await expect(getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+nonexistent',
      })).rejects.toThrow('Failed to get task logs: Task not found');
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.getTaskLogs.mockRejectedValue('Network timeout');

      await expect(getTaskLogs.handler({
        attempt_id: 'attempt123',
        task_name: '+main+task',
      })).rejects.toThrow('Failed to get task logs: Network timeout');
    });
  });
});