import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const listWorkflows = {
  name: 'list_workflows',
  description: 'List workflows. Optionally filter by project name.',
  inputSchema: {
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
  },
  handler: async (args: unknown) => {
    const { project_name, limit = 100, last_id } = args as {
      project_name?: string;
      limit?: number;
      last_id?: string;
    };

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.listWorkflows({
        project_name,
        limit,
        last_id,
      });

      return {
        workflows: response.workflows,
        next_page_id: response.next_page_id,
        count: response.workflows.length,
      };
    } catch (error) {
      throw new Error(`Failed to list workflows: ${(error as Error).message || String(error)}`);
    }
  },
};