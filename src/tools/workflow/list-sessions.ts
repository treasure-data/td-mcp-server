import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';
import type { WorkflowStatus } from '../../types/workflow.js';

export const listSessions = {
  name: 'list_sessions',
  description: 'List workflow execution sessions with filtering options',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Filter by project name',
      },
      workflow_name: {
        type: 'string',
        description: 'Filter by workflow name',
      },
      status: {
        type: 'string',
        enum: ['running', 'success', 'error', 'killed', 'planned'],
        description: 'Filter by status',
      },
      from_time: {
        type: 'string',
        description: 'Start time (ISO 8601)',
      },
      to_time: {
        type: 'string',
        description: 'End time (ISO 8601)',
      },
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
  },
  handler: async (args: unknown) => {
    const {
      project_name,
      workflow_name,
      status,
      from_time,
      to_time,
      limit = 100,
      last_id,
    } = args as {
      project_name?: string;
      workflow_name?: string;
      status?: WorkflowStatus;
      from_time?: string;
      to_time?: string;
      limit?: number;
      last_id?: string;
    };

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.listSessions({
        project_name,
        workflow_name,
        status,
        from_time,
        to_time,
        limit,
        last_id,
      });

      return {
        sessions: response.sessions,
        next_page_id: response.next_page_id,
        count: response.sessions.length,
      };
    } catch (error) {
      throw new Error(`Failed to list sessions: ${(error as Error).message || String(error)}`);
    }
  },
};