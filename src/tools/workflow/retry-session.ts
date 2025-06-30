import { loadConfig } from '../../config.js';
import { WorkflowClient } from '../../client/workflow/index.js';

export const retrySession = {
  name: 'retry_session',
  description: 'Retry a failed session from the beginning or a specific task',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Session ID',
      },
      from_task: {
        type: 'string',
        description: 'Task name to retry from',
      },
      retry_params: {
        type: 'object',
        description: 'Override parameters for retry',
      },
    },
    required: ['session_id'],
  },
  handler: async (args: unknown) => {
    const { session_id, from_task, retry_params } = args as {
      session_id: string;
      from_task?: string;
      retry_params?: Record<string, unknown>;
    };

    if (!session_id) {
      throw new Error('session_id is required');
    }

    const config = loadConfig();
    
    // Check if updates are enabled for workflow control operations
    if (!config.enable_updates) {
      throw new Error(
        'Workflow control operations are disabled. Set TD_ENABLE_UPDATES=true to enable.'
      );
    }

    const client = new WorkflowClient({
      apiKey: config.td_api_key,
      site: config.site,
    });

    try {
      const response = await client.retrySession({
        session_id,
        from_task,
        retry_params,
      });

      return {
        attempt_id: response.attempt_id,
        message: response.message,
      };
    } catch (error) {
      throw new Error(`Failed to retry session: ${(error as Error).message || String(error)}`);
    }
  },
};