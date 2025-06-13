import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive()
});

export const listSegmentsTool = {
  name: 'list_segments',
  description: 'Retrieve segment list under a specific parent segment from TD-CDP API',
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
      return {
        content: [{
          type: 'text',
          text: 'Error: TD_API_KEY is required'
        }]
      };
    }

    try {
      const { parent_segment_id } = inputSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      const segments = await client.getSegments(parent_segment_id);

      if (segments.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No segments found under parent segment ${parent_segment_id}`
          }]
        };
      }

      let resultText = `Segments under Parent Segment ${parent_segment_id} (Total: ${segments.length}):\n\n`;
      
      segments.forEach(segment => {
        resultText += `ID: ${segment.id}\n`;
        resultText += `Name: ${segment.name}\n`;
        resultText += `Description: ${segment.description || 'N/A'}\n`;
        resultText += `Created: ${segment.createdAt}\n`;
        resultText += `Updated: ${segment.updatedAt}\n`;
        resultText += '---\n';
      });

      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          content: [{
            type: 'text',
            text: `Invalid input: ${error.errors.map(e => e.message).join(', ')}`
          }]
        };
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{
          type: 'text',
          text: `Error calling TD-CDP API: ${errorMessage}`
        }]
      };
    }
  }
};