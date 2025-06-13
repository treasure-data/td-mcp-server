import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive().describe('The parent segment ID to retrieve details for')
});

export const getParentSegmentTool = {
  name: 'get_parent_segment',
  description: '[EXPERIMENTAL] Get details of a specific parent segment by its ID. Requires parent_segment_id parameter. Use list_parent_segments first to find available parent segment IDs.',
  inputSchema: {
    type: 'object',
    properties: {
      parent_segment_id: { 
        type: 'integer', 
        description: 'The parent segment ID to retrieve details for (required). Use list_parent_segments to find available IDs.' 
      }
    },
    required: ['parent_segment_id']
  },
  handler: async (args: unknown, _context: unknown) => {
    const config = loadConfig();
    
    if (!config.td_api_key) {
      throw new Error('TD_API_KEY is required');
    }

    try {
      const { parent_segment_id } = inputSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      const parentSegment = await client.getParentSegment(parent_segment_id);

      return {
        parentSegment: {
          id: parentSegment.id,
          name: parentSegment.attributes?.name,
          description: parentSegment.attributes?.description || null,
          createdAt: parentSegment.attributes?.createdAt,
          updatedAt: parentSegment.attributes?.updatedAt,
          type: parentSegment.type
        }
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
};