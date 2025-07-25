import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listWorkflows } from '../../../src/tools/workflow/list-workflows';
import { loadConfig } from '../../../src/config';
import { WorkflowClient } from '../../../src/client/workflow';

vi.mock('../../../src/config');
vi.mock('../../../src/client/workflow');

describe('listWorkflows tool', () => {
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
      listWorkflows: vi.fn(),
    };

    MockWorkflowClient.mockImplementation(() => mockClient);
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(listWorkflows.name).toBe('list_workflows');
      expect(listWorkflows.description).toBe('List workflows. Optionally filter by project name.');
      expect(listWorkflows.inputSchema).toEqual({
        type: 'object',
        properties: {
          project_name: {
            type: 'string',
            description: 'Name of the project to filter by (optional)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of workflows to return (default: 100)',
          },
          last_id: {
            type: 'string',
            description: 'Pagination cursor for next page',
          },
        },
        required: [],
      });
    });
  });

  describe('handler', () => {
    it('should list workflows successfully', async () => {
      const mockResponse = {
        workflows: [
          {
            id: '1',
            name: 'daily_etl',
            project: { id: '1', name: 'test_project' },
            revision: 'abc123',
            timezone: 'UTC',
            last_session_time: '2024-01-01T00:00:00Z',
            last_session_status: 'success',
          },
          {
            id: '2',
            name: 'hourly_sync',
            project: { id: '1', name: 'test_project' },
            revision: 'def456',
            timezone: 'UTC',
            last_session_time: '2024-01-01T01:00:00Z',
            last_session_status: 'error',
          },
        ],
        next_page_id: 'next123',
      };

      mockClient.listWorkflows.mockResolvedValue(mockResponse);

      const result = await listWorkflows.handler({
        project_name: 'test_project',
        limit: 50,
      });

      expect(result).toEqual({
        workflows: mockResponse.workflows,
        next_page_id: 'next123',
        count: 2,
      });

      expect(mockClient.listWorkflows).toHaveBeenCalledWith({
        project_name: 'test_project',
        limit: 50,
        last_id: undefined,
      });
    });

    it('should use default limit when not specified', async () => {
      mockClient.listWorkflows.mockResolvedValue({
        workflows: [],
        next_page_id: null,
      });

      await listWorkflows.handler({
        project_name: 'test_project',
      });

      expect(mockClient.listWorkflows).toHaveBeenCalledWith({
        project_name: 'test_project',
        limit: 100,
        last_id: undefined,
      });
    });

    it('should handle pagination with last_id', async () => {
      mockClient.listWorkflows.mockResolvedValue({
        workflows: [],
        next_page_id: null,
      });

      await listWorkflows.handler({
        project_name: 'test_project',
        last_id: 'prev123',
      });

      expect(mockClient.listWorkflows).toHaveBeenCalledWith({
        project_name: 'test_project',
        limit: 100,
        last_id: 'prev123',
      });
    });

    it('should list all workflows when project_name is not provided', async () => {
      mockClient.listWorkflows.mockResolvedValue({
        workflows: [
          {
            id: '1',
            name: 'workflow1',
            project: { id: '1', name: 'test' },
            revision: 'abc123',
            timezone: 'UTC',
          },
        ],
        next_page_id: undefined,
      });

      const result = await listWorkflows.handler({});

      expect(mockClient.listWorkflows).toHaveBeenCalledWith({
        project_name: undefined,
        limit: 100,
        last_id: undefined,
      });
      expect(result).toEqual({
        workflows: [
          {
            id: '1',
            name: 'workflow1',
            project: { id: '1', name: 'test' },
            revision: 'abc123',
            timezone: 'UTC',
          },
        ],
        next_page_id: undefined,
        count: 1,
      });
    });

    it('should handle client errors gracefully', async () => {
      mockClient.listWorkflows.mockRejectedValue(new Error('API error'));

      await expect(listWorkflows.handler({
        project_name: 'test_project',
      })).rejects.toThrow('Failed to list workflows: API error');
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.listWorkflows.mockRejectedValue('String error');

      await expect(listWorkflows.handler({
        project_name: 'test_project',
      })).rejects.toThrow('Failed to list workflows: String error');
    });
  });
});