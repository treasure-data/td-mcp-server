import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listParentSegmentsTool } from '../../../src/tools/cdp/listParentSegments';
import * as cdpClientModule from '../../../src/client/cdp';
import * as configModule from '../../../src/config';

vi.mock('../../../src/client/cdp');
vi.mock('../../../src/config');

describe('listParentSegmentsTool', () => {
  const mockClient = {
    getParentSegments: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (cdpClientModule.createCDPClient as any).mockReturnValue(mockClient);
  });

  it('should have correct metadata', () => {
    expect(listParentSegmentsTool.name).toBe('list_parent_segments');
    expect(listParentSegmentsTool.description).toBe('Retrieve parent segment list from TD-CDP API');
    expect(listParentSegmentsTool.schema.input).toEqual({
      type: 'object',
      properties: {},
      required: []
    });
  });

  it('should throw error when API key is missing', async () => {
    (configModule.loadConfig as any).mockReturnValue({
      td_api_key: null,
      site: 'us01'
    });

    await expect(listParentSegmentsTool.handler({}, {})).rejects.toThrow();
  });

  it('should return parent segments successfully', async () => {
    (configModule.loadConfig as any).mockReturnValue({
      td_api_key: 'test-key',
      site: 'us01'
    });

    const mockSegments = [
      {
        id: '123',
        attributes: {
          name: 'Parent Segment 1',
          description: 'Test description',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        }
      },
      {
        id: '456',
        attributes: {
          name: 'Parent Segment 2',
          description: null,
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-04T00:00:00Z'
        }
      }
    ];

    mockClient.getParentSegments.mockResolvedValue(mockSegments);

    const result = await listParentSegmentsTool.handler({}, {});

    expect(cdpClientModule.createCDPClient).toHaveBeenCalledWith('test-key', 'us01');
    expect(mockClient.getParentSegments).toHaveBeenCalled();

    expect(result).toEqual({
      parentSegments: [
        {
          id: '123',
          name: 'Parent Segment 1',
          description: 'Test description',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          type: undefined
        },
        {
          id: '456',
          name: 'Parent Segment 2',
          description: null,
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-04T00:00:00Z',
          type: undefined
        }
      ],
      total: 2
    });
  });

  it('should handle empty results', async () => {
    (configModule.loadConfig as any).mockReturnValue({
      td_api_key: 'test-key',
      site: 'us01'
    });

    mockClient.getParentSegments.mockResolvedValue([]);

    const result = await listParentSegmentsTool.handler({}, {});

    expect(result).toEqual({
      parentSegments: [],
      total: 0
    });
  });

  it('should handle segments without attributes', async () => {
    (configModule.loadConfig as any).mockReturnValue({
      td_api_key: 'test-key',
      site: 'us01'
    });

    const mockSegments = [
      {
        id: '789',
        // No attributes
      }
    ];

    mockClient.getParentSegments.mockResolvedValue(mockSegments);

    const result = await listParentSegmentsTool.handler({}, {});

    expect(result).toEqual({
      parentSegments: [
        {
          id: '789',
          name: undefined,
          description: null,
          createdAt: undefined,
          updatedAt: undefined,
          type: undefined
        }
      ],
      total: 1
    });
  });

  it('should handle API errors', async () => {
    (configModule.loadConfig as any).mockReturnValue({
      td_api_key: 'test-key',
      site: 'us01'
    });

    mockClient.getParentSegments.mockRejectedValue(new Error('API connection failed'));

    await expect(listParentSegmentsTool.handler({}, {})).rejects.toThrow('API connection failed');
  });
});