import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const audienceSqlSchema = z.object({
  audience_id: z.number().describe('The parent segment (audience) ID'),
});

type AudienceSqlInput = z.infer<typeof audienceSqlSchema>;

export const audienceSql = {
  name: 'audience_sql',
  description: '[EXPERIMENTAL] Get the base SQL statement for an audience (parent segment)',
  inputSchema: audienceSqlSchema,
  
  async execute(args: AudienceSqlInput) {
    const config = loadConfig();
    
    try {
      const client = createCDPClient(config.td_api_key, config.site);
      
      // Generate the base SQL for the audience
      const queryResponse = await client.getSegmentQuery(args.audience_id, {
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
          text: `Error generating audience SQL: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
};