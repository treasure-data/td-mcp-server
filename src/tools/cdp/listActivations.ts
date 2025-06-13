import { z } from 'zod';
import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';

const inputSchema = z.object({
  parent_segment_id: z.number().int().positive(),
  segment_id: z.number().int().positive()
});

export const listActivationsTool = {
  name: 'list_activations',
  description: 'Retrieve activation list under a specific segment from TD-CDP API',
  schema: {
    input: {
      type: 'object',
      properties: {
        parent_segment_id: { type: 'integer', description: 'The ID of the parent segment' },
        segment_id: { type: 'integer', description: 'The ID of the segment' }
      },
      required: ['parent_segment_id', 'segment_id']
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
      const { parent_segment_id, segment_id } = inputSchema.parse(args);
      const client = createCDPClient(config.td_api_key, config.site);
      const activations = await client.getActivations(parent_segment_id, segment_id);

      if (activations.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No activations found for segment ${segment_id} under parent segment ${parent_segment_id}`
          }]
        };
      }

      let resultText = `Activations for Segment ${segment_id} (Total: ${activations.length}):\n\n`;
      
      activations.forEach(activation => {
        resultText += `ID: ${activation.id}\n`;
        
        if (activation.attributes) {
          resultText += `Name: ${activation.attributes.name}\n`;
          resultText += `Description: ${activation.attributes.description || 'N/A'}\n`;
          resultText += `Connection ID: ${activation.attributes.connectionId}\n`;
          resultText += `Last Workflow Run: ${activation.attributes.lastWorkflowRun || 'N/A'}\n`;
          resultText += `Created: ${activation.attributes.createdAt}\n`;
          resultText += `Updated: ${activation.attributes.updatedAt}\n`;
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