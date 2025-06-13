import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const segmentSqlSchema = z.object({
  audience_id: z.number().describe('The parent segment (audience) ID'),
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
      
      // Get the segment details to retrieve the rule
      const segmentDetails = await client.getSegmentDetails(args.audience_id, args.segment_id);
      
      // Generate the SQL with the segment's rule
      const queryRequest = {
        format: 'sql' as const,
        ...(segmentDetails.rule ? { rule: segmentDetails.rule } : {})
      };
      
      const queryResponse = await client.getSegmentQuery(args.audience_id, queryRequest);
      
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