import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { listProjects } from '../../../src/tools/workflow/list-projects';
import { WorkflowClient } from '../../../src/client/workflow';
import { loadConfig } from '../../../src/config';

vi.mock('../../../src/config');
vi.mock('../../../src/client/workflow');

describe('listProjects tool', () => {
  const mockLoadConfig = loadConfig as Mock;
  const MockWorkflowClient = WorkflowClient as unknown as Mock;
  const mockClient = {
    listProjects: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockWorkflowClient.mockReturnValue(mockClient);
    mockLoadConfig.mockReturnValue({
      td_api_key: 'test_key',
      site: 'us01',
    });
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(listProjects.name).toBe('list_projects');
      expect(listProjects.description).toBe('List all workflow projects');
      expect(listProjects.inputSchema).toEqual({
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum results (default: 100)',
          },
          last_id: {
            type: 'string',
            description: 'Pagination cursor',
          },
        },
        required: [],
      });
    });
  });

  describe('handler', () => {
    it('should list projects successfully', async () => {
      const mockResponse = {
        projects: [
          {
            id: '1',
            name: 'etl_pipeline',
            revision: 'abc123',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            archiveType: 's3',
            archiveMd5: 'hash1',
          },
          {
            id: '2',
            name: 'data_processing',
            revision: 'def456',
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z',
            archiveType: 's3',
            archiveMd5: 'hash2',
          },
        ],
      };

      mockClient.listProjects.mockResolvedValue(mockResponse);

      const result = await listProjects.handler({});

      expect(result).toEqual({
        projects: mockResponse.projects,
        next_page_id: undefined,
        count: 2,
      });

      expect(MockWorkflowClient).toHaveBeenCalledWith({
        apiKey: 'test_key',
        site: 'us01',
      });

      expect(mockClient.listProjects).toHaveBeenCalledWith({
        limit: 100,
        last_id: undefined,
      });
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        projects: [],
        next_page_id: 'next123',
      };

      mockClient.listProjects.mockResolvedValue(mockResponse);

      const result = await listProjects.handler({
        limit: 50,
        last_id: 'prev123',
      });

      expect(result).toEqual({
        projects: [],
        next_page_id: 'next123',
        count: 0,
      });

      expect(mockClient.listProjects).toHaveBeenCalledWith({
        limit: 50,
        last_id: 'prev123',
      });
    });

    it('should handle client errors gracefully', async () => {
      mockClient.listProjects.mockRejectedValue(new Error('Network error'));

      await expect(listProjects.handler({}))
        .rejects.toThrow('Failed to list projects: Network error');
    });
  });
});