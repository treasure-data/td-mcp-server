import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const segmentSqlSchema = z.object({
  parent_segment_id: z.number().describe('The parent segment ID'),
  segment_id: z.number().describe('The segment ID'),
});

export const segmentSql = {
  name: 'segment_sql',
  description: '[EXPERIMENTAL] Get the SQL statement for a segment with filtering conditions applied to the parent segment (audience) SQL. Requires both parent_segment_id and segment_id parameters. Use list_parent_segments and list_segments first to find available IDs.',
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
      const parsedArgs = segmentSqlSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      
      // Get the segment details to retrieve the rule
      const segmentDetails = await client.getSegmentDetails(parsedArgs.parent_segment_id, parsedArgs.segment_id);
      
      // Generate the SQL with the segment's rule
      const queryRequest = {
        format: 'sql' as const,
        ...(segmentDetails.rule ? { rule: segmentDetails.rule } : {})
      };
      
      const queryResponse = await client.getSegmentQuery(parsedArgs.parent_segment_id, queryRequest);
      
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