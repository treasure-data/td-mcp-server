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
  description: '[EXPERIMENTAL] Get detailed information about a specific segment',
  inputSchema: getSegmentSchema,
  
  async execute(args: GetSegmentInput) {
    const config = loadConfig();
    
    try {
      const client = createCDPClient(config.td_api_key, config.site);
      
      // Get the segment details
      const segmentDetails = await client.getSegmentDetails(args.parent_segment_id, args.segment_id);
      
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