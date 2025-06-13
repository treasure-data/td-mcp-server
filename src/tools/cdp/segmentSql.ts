import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const segmentSqlSchema = z.object({
  segment_id: z.number().describe('The segment ID'),
});

type SegmentSqlInput = z.infer<typeof segmentSqlSchema>;

export const segmentSql = {
  name: 'segment_sql',
  description: '[EXPERIMENTAL] Get the SQL statement for a segment with filtering conditions applied to the parent segment (audience) SQL',
  inputSchema: segmentSqlSchema,
  
  async execute(args: SegmentSqlInput) {
    const config = loadConfig();
    
    try {
      const client = createCDPClient(config.td_api_key, config.site);
      
      // First, we need to get the segment details to find the audience ID and rule
      // We'll need to search through parent segments to find which one contains this segment
      const parentSegments = await client.getParentSegments();
      
      let audienceId: number | null = null;
      let segmentDetails = null;
      
      // Search for the segment in each parent segment
      for (const parent of parentSegments) {
        const parentId = parseInt(parent.id);
        if (isNaN(parentId)) continue;
        
        try {
          segmentDetails = await client.getSegmentDetails(parentId, args.segment_id);
          audienceId = parentId;
          break;
        } catch (error) {
          // This segment doesn't belong to this parent, continue searching
          continue;
        }
      }
      
      if (!audienceId || !segmentDetails) {
        return {
          content: [{
            type: 'text',
            text: `Segment with ID ${args.segment_id} not found`
          }],
          isError: true
        };
      }
      
      // Generate the SQL with the segment's rule
      const queryRequest = {
        format: 'sql' as const,
        ...(segmentDetails.rule ? { rule: segmentDetails.rule } : {})
      };
      
      const queryResponse = await client.getSegmentQuery(audienceId, queryRequest);
      
      return {
        content: [{
          type: 'text',
          text: queryResponse.sql
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        content: [{
          type: 'text',
          text: `Error generating segment SQL: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
};