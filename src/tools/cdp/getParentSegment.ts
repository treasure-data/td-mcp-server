import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive()
});

export const getParentSegmentTool = {
  name: 'get_parent_segment',
  description: 'Get details of a specific parent segment from TD-CDP API',
  schema: {
    input: {
      type: 'object',
      properties: {
        parent_segment_id: { type: 'integer', description: 'The ID of the parent segment to retrieve' }
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
      const parentSegment = await client.getParentSegment(parent_segment_id);

      let resultText = `Parent Segment Details:\n\n`;
      resultText += `ID: ${parentSegment.id}\n`;
      
      if (parentSegment.attributes) {
        resultText += `Name: ${parentSegment.attributes.name}\n`;
        resultText += `Description: ${parentSegment.attributes.description || 'N/A'}\n`;
        resultText += `Created: ${parentSegment.attributes.createdAt}\n`;
        resultText += `Updated: ${parentSegment.attributes.updatedAt}\n`;
      }

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