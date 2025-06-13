import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive()
});

export const listSegmentsTool = {
  name: 'list_segments',
  description: '[EXPERIMENTAL] Retrieve segment list under a specific parent segment from TD-CDP API',
  schema: {
    input: {
      type: 'object',
      properties: {
        parent_segment_id: { type: 'integer', description: 'The ID of the parent segment' }
      },
      required: ['parent_segment_id']
    }
  },
  handler: async (args: unknown, _context: unknown) => {
    const config = loadConfig();
    
    if (!config.td_api_key) {
      throw new Error('TD_API_KEY is required');
    }

    try {
      const { parent_segment_id } = inputSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      const segments = await client.getSegments(parent_segment_id);

      return {
        parentSegmentId: parent_segment_id,
        segments: segments.map(segment => ({
          id: segment.id,
          name: segment.name,
          description: segment.description || null,
          createdAt: segment.createdAt,
          updatedAt: segment.updatedAt
        })),
        total: segments.length
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
};