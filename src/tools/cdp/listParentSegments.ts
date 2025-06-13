import { createCDPClient } from '../../client/cdp';
import { loadConfig } from '../../config';


export const listParentSegmentsTool = {
  name: 'list_parent_segments',
  description: '[EXPERIMENTAL] List all parent segments (audiences) in Customer Data Platform. No parameters required.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async (_args: unknown, _context: unknown) => {
    const config = loadConfig();
    
    if (!config.td_api_key) {
      throw new Error('TD_API_KEY is required');
    }

    try {
      const client = createCDPClient(config.td_api_key, config.site);
      const parentSegments = await client.getParentSegments();

      return {
        parentSegments: parentSegments.map(ps => ({
          id: ps.id,
          name: ps.attributes?.name,
          description: ps.attributes?.description || null,
          createdAt: ps.attributes?.createdAt,
          updatedAt: ps.attributes?.updatedAt,
          type: ps.type
        })),
        total: parentSegments.length
      };
    } catch (error) {
      throw error; // Let the server handle error formatting
    }
  }
};