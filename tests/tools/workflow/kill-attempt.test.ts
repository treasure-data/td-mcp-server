import { describe, it, expect, beforeEach, vi } from 'vitest';
import { killAttempt } from '../../../src/tools/workflow/kill-attempt';
import { loadConfig } from '../../../src/config';
import { WorkflowClient } from '../../../src/client/workflow';

vi.mock('../../../src/config');
vi.mock('../../../src/client/workflow');

describe('killAttempt tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockWorkflowClient = WorkflowClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockClient = {
      killAttempt: vi.fn(),
    };

    MockWorkflowClient.mockImplementation(() => mockClient);
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(killAttempt.name).toBe('kill_attempt');
      expect(killAttempt.description).toBe('Request cancellation of a running attempt');
      expect(killAttempt.inputSchema).toEqual({
        type: 'object',
        properties: {
          attempt_id: {
            type: 'string',
            description: 'Attempt ID',
          },
          reason: {
            type: 'string',
            description: 'Reason for cancellation',
          },
        },
        required: ['attempt_id'],
      });
    });
  });

  describe('handler', () => {
    it('should kill attempt when updates are enabled', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: true,
      });

      const mockResponse = {
        success: true,
        message: 'Cancellation requested for attempt 123',
      };

      mockClient.killAttempt.mockResolvedValue(mockResponse);

      const result = await killAttempt.handler({
        attempt_id: 'attempt123',
        reason: 'User requested cancellation',
      });

      expect(result).toEqual({
        success: true,
        message: 'Cancellation requested for attempt 123',
      });

      expect(mockClient.killAttempt).toHaveBeenCalledWith(
        'attempt123',
        'User requested cancellation'
      );
    });

    it('should kill attempt without reason', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: true,
      });

      const mockResponse = {
        success: true,
        message: 'Cancellation requested',
      };

      mockClient.killAttempt.mockResolvedValue(mockResponse);

      await killAttempt.handler({
        attempt_id: 'attempt123',
      });

      expect(mockClient.killAttempt).toHaveBeenCalledWith(
        'attempt123',
        undefined
      );
    });

    it('should work even when enable_updates is false', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: false, // No longer required for workflow control operations
      });

      mockClient.killAttempt.mockResolvedValue({
        success: true,
        message: 'Cancellation requested',
      });

      const result = await killAttempt.handler({
        attempt_id: 'attempt123',
        reason: 'Testing',
      });

      expect(result).toEqual({
        success: true,
        message: 'Cancellation requested',
      });

      expect(mockClient.killAttempt).toHaveBeenCalledWith('attempt123', 'Testing');
    });

    it('should throw error when attempt_id is missing', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: true,
      });

      await expect(killAttempt.handler({}))
        .rejects.toThrow('attempt_id is required');

      expect(mockClient.killAttempt).not.toHaveBeenCalled();
    });

    it('should handle unsuccessful kill response', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: true,
      });

      const mockResponse = {
        success: false,
        message: 'Attempt is already completed',
      };

      mockClient.killAttempt.mockResolvedValue(mockResponse);

      const result = await killAttempt.handler({
        attempt_id: 'attempt123',
      });

      expect(result).toEqual({
        success: false,
        message: 'Attempt is already completed',
      });
    });

    it('should handle client errors gracefully', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: true,
      });

      mockClient.killAttempt.mockRejectedValue(new Error('Network error'));

      await expect(killAttempt.handler({
        attempt_id: 'attempt123',
      })).rejects.toThrow('Failed to kill attempt: Network error');
    });

    it('should create client regardless of enable_updates setting', async () => {
      mockLoadConfig.mockReturnValue({
        td_api_key: 'test_key',
        site: 'us01',
        enable_updates: false, // No longer affects workflow control operations
      });

      mockClient.killAttempt.mockResolvedValue({
        success: true,
        message: 'Cancellation requested',
      });

      await killAttempt.handler({
        attempt_id: 'attempt123',
      });

      // Client should be created even when enable_updates is false
      expect(MockWorkflowClient).toHaveBeenCalledWith({
        apiKey: 'test_key',
        site: 'us01',
      });
    });
  });
});