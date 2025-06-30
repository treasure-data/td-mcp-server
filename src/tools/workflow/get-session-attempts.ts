import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const getSessionAttempts = {
  name: 'get_session_attempts',
  description: 'Get detailed information about all attempts for a specific session',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID',
      },
    },
    required: ['session_id'],
  },
  handler: async (args: unknown) => {
    const { session_id } = args as {
      session_id: string;
    };

    if (!session_id) {
      throw new Error('session_id is required');
    }

    const config = loadConfig();
    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.getSessionAttempts(session_id);

      return {
        attempts: response.attempts,
        count: response.attempts.length,
      };
    } catch (error) {
      throw new Error(`Failed to get session attempts: ${(error as Error).message || String(error)}`);
    }
  },
};