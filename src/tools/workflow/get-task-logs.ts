import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const getTaskLogs = {
  name: 'get_task_logs',
  description: 'Retrieve logs for a specific task',
  inputSchema: {
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
  },
  handler: async (args: unknown) => {
    const { attempt_id, task_name, offset, limit = 1048576 } = args as {
      attempt_id: string;
      task_name: string;
      offset?: number;
      limit?: number;
    };

    if (!attempt_id) {
      throw new Error('attempt_id is required');
    }

    if (!task_name) {
      throw new Error('task_name is required');
    }

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.getTaskLogs({
        attempt_id,
        task_name,
        offset,
        limit,
      });

      return {
        logs: response.logs,
        next_offset: response.next_offset,
        has_more: response.has_more,
      };
    } catch (error) {
      throw new Error(`Failed to get task logs: ${(error as Error).message || String(error)}`);
    }
  },
};