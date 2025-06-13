import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive().describe('The parent segment ID'),
  segment_id: z.number().int().positive().describe('The segment ID')
});

export const listActivationsTool = {
  name: 'list_activations',
  description: '[EXPERIMENTAL] List all activations (syndications) for a specific segment. Requires both parent_segment_id and segment_id parameters. Use list_parent_segments and list_segments first to find available IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      parent_segment_id: { 
        type: 'integer', 
        description: 'The parent segment ID (required). Use list_parent_segments to find available IDs.' 
      },
      segment_id: { 
        type: 'integer', 
        description: 'The segment ID (required). Use list_segments to find available IDs under the parent segment.' 
      }
    },
    required: ['parent_segment_id', 'segment_id']
  },
  handler: async (args: unknown, _context: unknown) => {
    const config = loadConfig();
    
    if (!config.td_api_key) {
      throw new Error('TD_API_KEY is required');
    }

    try {
      const { parent_segment_id, segment_id } = inputSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      const activations = await client.getActivations(parent_segment_id, segment_id);

      return {
        parentSegmentId: parent_segment_id,
        segmentId: segment_id,
        activations: activations.map(activation => ({
          id: activation.id,
          name: activation.attributes?.name,
          description: activation.attributes?.description || null,
          connectionId: activation.attributes?.connectionId,
          lastWorkflowRun: activation.attributes?.lastWorkflowRun || null,
          createdAt: activation.attributes?.createdAt,
          updatedAt: activation.attributes?.updatedAt,
          type: activation.type
        })),
        total: activations.length
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
};