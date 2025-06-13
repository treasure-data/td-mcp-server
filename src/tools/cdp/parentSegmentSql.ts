import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const parentSegmentSqlSchema = z.object({
  parent_segment_id: z.number().describe('The parent segment ID'),
});

type ParentSegmentSqlInput = z.infer<typeof parentSegmentSqlSchema>;

export const parentSegmentSql = {
  name: 'parent_segment_sql',
  description: '[EXPERIMENTAL] Get the SQL statement for a parent segment (audience). Requires parent_segment_id parameter. Use list_parent_segments first to find available parent segment IDs.',
  inputSchema: parentSegmentSqlSchema,
  
  async execute(args: ParentSegmentSqlInput) {
    const config = loadConfig();
    
    try {
      const client = createCDPClient(config.td_api_key, config.site);
      
      // Generate the SQL for the parent segment
      const queryResponse = await client.getSegmentQuery(args.parent_segment_id, {
        format: 'sql'
      });
      
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
          text: `Error generating parent segment SQL: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
};