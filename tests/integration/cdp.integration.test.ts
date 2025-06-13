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

  describe('New CDP Methods', () => {
    it('should fetch segment details with getSegmentDetails', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      // First get list of parent segments and their child segments
      const parentSegments = await client.getParentSegments();
      
      if (parentSegments.length === 0) {
        console.log('No parent segments available, skipping segment details test');
        return;
      }

      // Find a segment to test
      let testSegment = null;
      let testParentId = null;
      
      for (const parent of parentSegments.slice(0, 5)) {
        const parentId = parseInt(parent.id);
        try {
          const segments = await client.getSegments(parentId);
          if (segments.length > 0) {
            testSegment = segments[0];
            testParentId = parentId;
            break;
          }
        } catch (error) {
          console.log(`Error fetching segments for parent ${parentId}:`, error.message);
        }
      }

      if (!testSegment || !testParentId) {
        console.log('No segments found to test segment details');
        return;
      }

      // Test getSegmentDetails
      const segmentId = parseInt(testSegment.id);
      console.log(`Testing getSegmentDetails for audience ${testParentId}, segment ${segmentId}`);
      
      const segmentDetails = await client.getSegmentDetails(testParentId, segmentId);
      
      expect(segmentDetails).toHaveProperty('id');
      expect(segmentDetails).toHaveProperty('audienceId');
      expect(segmentDetails).toHaveProperty('name');
      expect(segmentDetails).toHaveProperty('population');
      expect(segmentDetails).toHaveProperty('createdAt');
      expect(segmentDetails).toHaveProperty('updatedAt');
      
      console.log('Segment details:', JSON.stringify(segmentDetails, null, 2));
      
      if (segmentDetails.rule) {
        console.log('Segment has rule:', JSON.stringify(segmentDetails.rule, null, 2));
      }
    });

    it('should generate SQL queries with getSegmentQuery', async () => {
      const client = new CDPClient(apiKey, 'dev');
      
      // First get list of parent segments
      const parentSegments = await client.getParentSegments();
      
      if (parentSegments.length === 0) {
        console.log('No parent segments available, skipping SQL query test');
        return;
      }

      const parentId = parseInt(parentSegments[0].id);
      console.log(`Testing SQL generation for audience ${parentId}`);

      // Test audience SQL (without rule)
      const audienceSQL = await client.getSegmentQuery(parentId, { format: 'sql' });
      
      expect(audienceSQL).toHaveProperty('sql');
      expect(audienceSQL.sql).toContain('select');
      expect(audienceSQL.sql).toContain('from');
      console.log('Audience SQL:', audienceSQL.sql);

      // Try to find a segment with a rule
      let segmentWithRule = null;
      try {
        const segments = await client.getSegments(parentId);
        for (const segment of segments.slice(0, 5)) {
          try {
            const details = await client.getSegmentDetails(parentId, parseInt(segment.id));
            if (details.rule) {
              segmentWithRule = details;
              break;
            }
          } catch (error) {
            console.log(`Error fetching details for segment ${segment.id}:`, error.message);
          }
        }
      } catch (error) {
        console.log('Error fetching segments:', error.message);
      }

      if (segmentWithRule) {
        console.log(`Testing SQL generation with rule for segment ${segmentWithRule.id}`);
        
        const segmentSQL = await client.getSegmentQuery(parentId, {
          format: 'sql',
          rule: segmentWithRule.rule
        });
        
        expect(segmentSQL).toHaveProperty('sql');
        expect(segmentSQL.sql).toContain('where');
        console.log('Segment SQL with rule:', segmentSQL.sql);
      } else {
        console.log('No segments with rules found to test SQL generation');
      }
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

    it('should test new CDP tools: audience_sql, segment_sql, get_segment', async () => {
      // Temporarily set env vars
      const originalApiKey = process.env.TD_API_KEY;
      const originalSite = process.env.TD_SITE;
      
      process.env.TD_API_KEY = apiKey;
      process.env.TD_SITE = 'dev';
      
      try {
        // Import tools fresh to pick up env vars
        const { audienceSql, segmentSql, getSegment, listParentSegmentsTool, listSegmentsTool } = await import('../../src/tools/cdp');
        
        // First, get parent segments to find test data
        const parentResult = await listParentSegmentsTool.handler({}, {});
        
        if (parentResult.total === 0) {
          console.log('No parent segments available, skipping new tools test');
          return;
        }

        const parentId = parseInt(parentResult.parentSegments[0].id);
        console.log(`Testing new tools with audience ID: ${parentId}`);

        // Test audience_sql tool
        console.log('\nTesting audience_sql tool...');
        const audienceResult = await audienceSql.execute({ audience_id: parentId });
        
        expect(audienceResult.content[0].type).toBe('text');
        expect(audienceResult.content[0].text).toContain('select');
        expect(audienceResult.isError).toBeFalsy();
        console.log('Audience SQL result:', audienceResult.content[0].text);

        // Try to find a segment for testing
        const segmentsResult = await listSegmentsTool.handler({ parent_segment_id: parentId }, {});
        
        if (segmentsResult.total > 0) {
          const segmentId = parseInt(segmentsResult.segments[0].id);
          console.log(`\nTesting segment tools with segment ID: ${segmentId}`);

          // Test get_segment tool
          console.log('\nTesting get_segment tool...');
          const getSegmentResult = await getSegment.execute({ 
            audience_id: parentId, 
            segment_id: segmentId 
          });
          
          expect(getSegmentResult.content[0].type).toBe('text');
          expect(getSegmentResult.isError).toBeFalsy();
          
          const segmentDetails = JSON.parse(getSegmentResult.content[0].text);
          console.log('Segment details:', JSON.stringify(segmentDetails, null, 2));

          // Test segment_sql tool
          console.log('\nTesting segment_sql tool...');
          const segmentSqlResult = await segmentSql.execute({ 
            audience_id: parentId, 
            segment_id: segmentId 
          });
          
          expect(segmentSqlResult.content[0].type).toBe('text');
          expect(segmentSqlResult.isError).toBeFalsy();
          console.log('Segment SQL result:', segmentSqlResult.content[0].text);
          
          // If the segment has a rule, the SQL should contain WHERE clause
          if (segmentDetails.rule) {
            expect(segmentSqlResult.content[0].text).toContain('where');
          }
        } else {
          console.log('No segments found under parent, skipping segment-specific tool tests');
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

    it('should handle errors in new tools gracefully', async () => {
      // Temporarily set env vars
      const originalApiKey = process.env.TD_API_KEY;
      const originalSite = process.env.TD_SITE;
      
      process.env.TD_API_KEY = apiKey;
      process.env.TD_SITE = 'dev';
      
      try {
        const { audienceSql, segmentSql, getSegment } = await import('../../src/tools/cdp');
        
        // Test with non-existent IDs
        console.log('\nTesting error handling with non-existent IDs...');
        
        // Test audience_sql with invalid ID
        const audienceResult = await audienceSql.execute({ audience_id: 999999999 });
        expect(audienceResult.isError).toBe(true);
        expect(audienceResult.content[0].text).toContain('Error');
        console.log('Audience SQL error:', audienceResult.content[0].text);

        // Test segment_sql with invalid IDs
        const segmentSqlResult = await segmentSql.execute({ 
          audience_id: 999999999, 
          segment_id: 999999999 
        });
        expect(segmentSqlResult.isError).toBe(true);
        expect(segmentSqlResult.content[0].text).toContain('Error');
        console.log('Segment SQL error:', segmentSqlResult.content[0].text);

        // Test get_segment with invalid IDs
        const getSegmentResult = await getSegment.execute({ 
          audience_id: 999999999, 
          segment_id: 999999999 
        });
        expect(getSegmentResult.isError).toBe(true);
        expect(getSegmentResult.content[0].text).toContain('Error');
        console.log('Get segment error:', getSegmentResult.content[0].text);

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