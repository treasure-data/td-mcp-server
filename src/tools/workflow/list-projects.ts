import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const listProjects = {
  name: 'list_projects',
  description: 'List all workflow projects',
  inputSchema: {
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
  },
  handler: async (args: unknown) => {
    const { limit = 100, last_id } = args as {
      limit?: number;
      last_id?: string;
    };

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.listProjects({
        limit,
        last_id,
      });

      return {
        projects: response.projects,
        next_page_id: response.next_page_id,
        count: response.projects.length,
      };
    } catch (error) {
      throw new Error(`Failed to list projects: ${(error as Error).message || String(error)}`);
    }
  },
};