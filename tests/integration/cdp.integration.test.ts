import { describe, it, expect } from 'vitest';
import { CDPClient } from '../../src/client/cdp/client';

describe('CDP Integration Tests', () => {
  const apiKey = process.env.TD_API_KEY_DEVELOPMENT_AWS;
  
  if (!apiKey) {
    it.skip('requires TD_API_KEY_DEVELOPMENT_AWS environment variable', () => {});
    return;
  }

  describe('CDP Client', () => {
    it('should connect to dev CDP endpoint and fetch parent segments', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      // This should not throw
      const parentSegments = await client.getParentSegments();
      
      // We should get an array (even if empty)
      expect(Array.isArray(parentSegments)).toBe(true);
      
      // Log for debugging
      console.log(`Found ${parentSegments.length} parent segments`);
      
      if (parentSegments.length > 0) {
        const firstSegment = parentSegments[0];
        expect(firstSegment).toHaveProperty('id');
        console.log('First parent segment:', JSON.stringify(firstSegment, null, 2));
      }
    });

    it('should fetch a specific parent segment if available', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      // First get list of parent segments
      const parentSegments = await client.getParentSegments();
      
      if (parentSegments.length === 0) {
        console.log('No parent segments available, skipping specific fetch test');
        return;
      }

      // Get the first parent segment ID
      const firstSegmentId = parseInt(parentSegments[0].id);
      console.log(`Fetching parent segment with ID: ${firstSegmentId}`);
      
      // Fetch specific parent segment
      const segment = await client.getParentSegment(firstSegmentId);
      
      expect(segment).toHaveProperty('id');
      expect(segment.id).toBe(firstSegmentId.toString());
      console.log('Parent segment details:', JSON.stringify(segment, null, 2));
    });

    it('should fetch segments under a parent segment', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      // First get list of parent segments
      const parentSegments = await client.getParentSegments();
      
      if (parentSegments.length === 0) {
        console.log('No parent segments available, skipping segments test');
        return;
      }

      // Try a few parent segments to find one with child segments
      let foundSegments = false;
      for (let i = 0; i < Math.min(5, parentSegments.length); i++) {
        const parentId = parseInt(parentSegments[i].id);
        console.log(`Checking segments for parent ID: ${parentId}`);
        
        try {
          const segments = await client.getSegments(parentId);
          
          if (segments.length > 0) {
            console.log(`Found ${segments.length} segments under parent ${parentId}`);
            console.log('First segment:', JSON.stringify(segments[0], null, 2));
            foundSegments = true;
            
            // Test fetching activations for this segment
            const segmentId = parseInt(segments[0].id);
            try {
              const activations = await client.getActivations(parentId, segmentId);
              console.log(`Found ${activations.length} activations for segment ${segmentId}`);
              if (activations.length > 0) {
                console.log('First activation:', JSON.stringify(activations[0], null, 2));
              }
            } catch (error) {
              console.log('Error fetching activations:', error.message);
            }
            
            break;
          }
        } catch (error) {
          console.log(`Error fetching segments for parent ${parentId}:`, error.message);
        }
      }
      
      if (!foundSegments) {
        console.log('No segments found in the tested parent segments');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parent segment ID gracefully', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      try {
        await client.getParentSegment(999999999); // Non-existent ID
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('CDP API Error');
        // Should not expose the API key
        expect(error.message).not.toContain(apiKey);
        console.log('Error message for invalid ID:', error.message);
      }
    });

    it('should handle invalid segment IDs gracefully', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      try {
        await client.getSegments(999999999); // Non-existent parent ID
        // Some endpoints might return empty array instead of error
        console.log('No error thrown for invalid parent segment ID - API might return empty array');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('CDP API Error');
        console.log('Error message for invalid parent segment ID:', error.message);
      }
    });

    it('should handle network errors gracefully', async () => {
      // Test that invalid site throws error in constructor
      expect(() => new CDPClient(apiKey, 'unknown' as any)).toThrow('Unknown site: unknown');
    });
  });

  describe('CDP Tools with Real Config', () => {
    it('should work with actual loadConfig when env vars are set', async () => {
      // Temporarily set env vars
      const originalApiKey = process.env.TD_API_KEY;
      const originalSite = process.env.TD_SITE;
      
      process.env.TD_API_KEY = apiKey;
      process.env.TD_SITE = 'dev';
      
      try {
        // Import tools fresh to pick up env vars
        const { listParentSegmentsTool } = await import('../../src/tools/cdp');
        
        const result = await listParentSegmentsTool.handler({}, {});
        
        expect(result).toHaveProperty('parentSegments');
        expect(Array.isArray(result.parentSegments)).toBe(true);
        expect(result).toHaveProperty('total');
        
        console.log(`Tool returned ${result.total} parent segments`);
        if (result.parentSegments.length > 0) {
          console.log('First parent segment:', JSON.stringify(result.parentSegments[0], null, 2));
        }
      } finally {
        // Restore original env vars
        if (originalApiKey !== undefined) {
          process.env.TD_API_KEY = originalApiKey;
        } else {
          delete process.env.TD_API_KEY;
        }
        
        if (originalSite !== undefined) {
          process.env.TD_SITE = originalSite;
        } else {
          delete process.env.TD_SITE;
        }
      }
    });
  });
});