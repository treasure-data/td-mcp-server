import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const retryAttempt = {
  name: 'retry_attempt',
  description: 'Retry a specific failed attempt with resume capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      attempt_id: {
        type: 'string',
        description: 'Attempt ID to retry',
      },
      resume_from: {
        type: 'string',
        description: 'Task name to resume from (skip successful tasks)',
      },
      retry_params: {
        type: 'object',
        description: 'Override parameters for retry',
      },
      force: {
        type: 'boolean',
        description: 'Force retry even if attempt is running (default: false)',
      },
    },
    required: ['attempt_id'],
  },
  handler: async (args: unknown) => {
    const { attempt_id, resume_from, retry_params, force = false } = args as {
      attempt_id: string;
      resume_from?: string;
      retry_params?: Record<string, unknown>;
      force?: boolean;
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
      const response = await client.retryAttempt({
        attempt_id,
        resume_from,
        retry_params,
        force,
      });

      return {
        new_attempt_id: response.new_attempt_id,
        session_id: response.session_id,
        message: response.message,
        resumed_from: response.resumed_from,
      };
    } catch (error) {
      throw new Error(`Failed to retry attempt: ${(error as Error).message || String(error)}`);
    }
  },
};