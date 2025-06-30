import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';
import type { LogLevel } from '../../types/workflow.js';

export const getAttemptLogs = {
  name: 'get_attempt_logs',
  description: 'List log files for an attempt (Note: returns file information, not full log content)',
  inputSchema: {
    type: 'object',
    properties: {
      attempt_id: {
        type: 'string',
        description: 'Attempt ID',
      },
      task_filter: {
        type: 'string',
        description: 'Filter by task name pattern',
      },
      level_filter: {
        type: 'string',
        enum: ['ERROR', 'WARN', 'INFO', 'DEBUG'],
        description: 'Filter by log level',
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
    required: ['attempt_id'],
  },
  handler: async (args: unknown) => {
    const { attempt_id, task_filter, level_filter, offset, limit = 1048576 } = args as {
      attempt_id: string;
      task_filter?: string;
      level_filter?: LogLevel;
      offset?: number;
      limit?: number;
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
      const response = await client.getAttemptLogs({
        attempt_id,
        task_filter,
        level_filter,
        offset,
        limit,
      });

      return {
        logs: response.logs,
        next_offset: response.next_offset,
        has_more: response.has_more,
        count: response.logs.length,
      };
    } catch (error) {
      throw new Error(`Failed to get attempt logs: ${(error as Error).message || String(error)}`);
    }
  },
};