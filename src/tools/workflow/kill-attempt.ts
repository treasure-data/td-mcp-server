import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const killAttempt = {
  name: 'kill_attempt',
  description: 'Request cancellation of a running attempt',
  inputSchema: {
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
  },
  handler: async (args: unknown) => {
    const { attempt_id, reason } = args as {
      attempt_id: string;
      reason?: string;
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
      const response = await client.killAttempt(attempt_id, reason);

      return {
        success: response.success,
        message: response.message,
      };
    } catch (error) {
      throw new Error(`Failed to kill attempt: ${(error as Error).message || String(error)}`);
    }
  },
};