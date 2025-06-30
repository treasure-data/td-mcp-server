import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const getAttemptTasks = {
  name: 'get_attempt_tasks',
  description: 'List all tasks within an attempt with their execution status',
  inputSchema: {
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
  },
  handler: async (args: unknown) => {
    const { attempt_id, include_subtasks = true } = args as {
      attempt_id: string;
      include_subtasks?: boolean;
    };

    if (!attempt_id) {
      throw new Error('attempt_id is required');
    }

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.getAttemptTasks(attempt_id, include_subtasks);

      // Filter to show failed tasks first for easier debugging
      const failedTasks = response.tasks.filter(t => t.state === 'error');
      const otherTasks = response.tasks.filter(t => t.state !== 'error');

      return {
        tasks: [...failedTasks, ...otherTasks],
        count: response.tasks.length,
        failed_count: failedTasks.length,
      };
    } catch (error) {
      throw new Error(`Failed to get attempt tasks: ${(error as Error).message || String(error)}`);
    }
  },
};