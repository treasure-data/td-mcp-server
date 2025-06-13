import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const getSegmentSchema = z.object({
  parent_segment_id: z.number().describe('The parent segment ID'),
  segment_id: z.number().describe('The segment ID'),
});

type GetSegmentInput = z.infer<typeof getSegmentSchema>;

export const getSegment = {
  name: 'get_segment',
  description: '[EXPERIMENTAL] Get detailed information about a specific segment including its filtering rules. Requires both parent_segment_id and segment_id parameters. Use list_parent_segments and list_segments first to find available IDs.',
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
  
  async execute(args: unknown) {
    const config = loadConfig();
    
    try {
      const parsedArgs = getSegmentSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      
      // Get the segment details
      const segmentDetails = await client.getSegmentDetails(parsedArgs.parent_segment_id, parsedArgs.segment_id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(segmentDetails, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [{
          type: 'text',
          text: `Error fetching segment details: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
};