import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CDPClient } from '../../../src/client/cdp/client';
import { CDPApiError } from '../../../src/types/cdp';

// Mock fetch globally
global.fetch = vi.fn();

describe('CDPClient', () => {
  let client: CDPClient;
  const mockApiKey = 'test-api-key-12345';
  const mockSite = 'us01';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CDPClient(mockApiKey, mockSite);
  });

  describe('constructor', () => {
    it('should create client with valid site', () => {
      expect(() => new CDPClient(mockApiKey, 'us01')).not.toThrow();
      expect(() => new CDPClient(mockApiKey, 'jp01')).not.toThrow();
      expect(() => new CDPClient(mockApiKey, 'dev')).not.toThrow();
    });

    it('should throw error for unknown site', () => {
      expect(() => new CDPClient(mockApiKey, 'unknown')).toThrow('Unknown site: unknown');
    });
  });

  describe('getParentSegments', () => {
    it('should fetch parent segments successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: '123',
            type: 'parent_segment',
            attributes: {
              name: 'Test Parent Segment',
              description: 'Test description',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-02T00:00:00Z'
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getParentSegments();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-cdp.treasuredata.com/entities/parent_segments',
        {
          method: 'GET',
          headers: {
            'Authorization': 'TD1 test-api-key-12345',
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.treasuredata.v1+json'
          },
          body: undefined
        }
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle array response format', async () => {
      const mockResponse = [
        {
          data: {
            id: '123',
            attributes: { name: 'Segment 1' }
          }
        },
        {
          data: {
            id: '456',
            attributes: { name: 'Segment 2' }
          }
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getParentSegments();

      expect(result).toEqual([
        { id: '123', attributes: { name: 'Segment 1' } },
        { id: '456', attributes: { name: 'Segment 2' } }
      ]);
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'Unauthorized' })
      });

      await expect(client.getParentSegments()).rejects.toThrow('CDP API Error: HTTP 401 - Unauthorized');
    });

    it('should mask API key in error messages', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error(`Network error with key ${mockApiKey}`)
      );

      await expect(client.getParentSegments()).rejects.toThrow('Network error with key test...2345');
    });
  });

  describe('getParentSegment', () => {
    it('should fetch a specific parent segment', async () => {
      const mockResponse = {
        data: {
          id: '123',
          attributes: {
            name: 'Test Parent Segment',
            description: 'Test description'
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getParentSegment(123);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-cdp.treasuredata.com/entities/parent_segments/123',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getSegments', () => {
    it('should fetch segments for a parent', async () => {
      const mockResponse = [
        { id: '1', name: 'Segment 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        { id: '2', name: 'Segment 2', createdAt: '2024-01-02', updatedAt: '2024-01-02' }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getSegments(123);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-cdp.treasuredata.com/audiences/123/segments',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getActivations', () => {
    it('should fetch activations for a segment', async () => {
      const mockResponse = {
        data: [
          {
            id: 'act-1',
            attributes: {
              name: 'Activation 1',
              connectionId: 'conn-1',
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01'
            }
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getActivations(123, 456);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api-cdp.treasuredata.com/audiences/123/segments/456/syndications',
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('error handling', () => {
    it('should handle non-JSON error responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      await expect(client.getParentSegments()).rejects.toThrow('CDP API Error: HTTP 500 - Internal Server Error');
    });

    it('should include status code and response body in error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: 'Not found' })
      });

      try {
        await client.getParentSegments();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const cdpError = error as CDPApiError;
        expect(cdpError.statusCode).toBe(404);
        expect(cdpError.responseBody).toBe('{"error":"Not found"}');
      }
    });
  });
});