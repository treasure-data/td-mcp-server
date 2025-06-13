import { createCDPClient } from '../../client/cdp';
import { ParentSegment } from '../../types/cdp';
import { loadConfig } from '../../config';


export const listParentSegmentsTool = {
  name: 'list_parent_segments',
  description: 'Retrieve parent segment list from TD-CDP API',
  schema: {
    input: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  handler: async (_args: unknown, _context: unknown) => {
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
      const client = createCDPClient(config.td_api_key, config.site);
      const parentSegments = await client.getParentSegments();

      if (parentSegments.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No parent segments found'
          }]
        };
      }

      let resultText = `Parent Segments (Total: ${parentSegments.length}):\n\n`;
      
      parentSegments.forEach((ps: ParentSegment) => {
        resultText += `ID: ${ps.id}\n`;
        
        if (ps.attributes) {
          resultText += `Name: ${ps.attributes.name}\n`;
          resultText += `Description: ${ps.attributes.description || 'N/A'}\n`;
          resultText += `Created: ${ps.attributes.createdAt}\n`;
          resultText += `Updated: ${ps.attributes.updatedAt}\n`;
        }
        
        resultText += '---\n';
      });

      return {
        content: [{
          type: 'text',
          text: resultText
        }]
      };
    } catch (error) {
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