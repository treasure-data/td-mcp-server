import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSegment } from '../../../src/tools/cdp/getSegment';
import { createCDPClient } from '../../../src/client/cdp';
import { loadConfig } from '../../../src/config';

vi.mock('../../../src/client/cdp', () => ({
  createCDPClient: vi.fn()
}));
vi.mock('../../../src/config', () => ({
  loadConfig: vi.fn()
}));

describe('getSegment', () => {
  const mockClient = {
    getSegmentDetails: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createCDPClient as any).mockReturnValue(mockClient);
    (loadConfig as any).mockReturnValue({
      td_api_key: 'test-key',
      site: 'us01'
    });
  });

  it('should have correct metadata', () => {
    expect(getSegment.name).toBe('get_segment');
    expect(getSegment.description).toContain('Get detailed information about a specific segment');
    expect(getSegment.inputSchema).toBeDefined();
  });

  it('should fetch segment details successfully', async () => {
    const mockSegmentDetails = {
      audienceId: '287197',
      id: '1536120',
      name: 'Test Segment',
      realtime: false,
      isVisible: true,
      numSyndications: 5,
      description: 'Test description',
      segmentFolderId: '795863',
      population: 14665,
      createdAt: '2024-10-16T21:26:30.815Z',
      updatedAt: '2025-04-30T22:50:10.188Z',
      createdBy: {
        id: '381',
        td_user_id: '1275',
        name: 'Test User'
      },
      updatedBy: {
        id: '381',
        td_user_id: '1275',
        name: 'Test User'
      },
      kind: 0,
      rule: {
        type: 'And',
        conditions: [
          {
            type: 'Value',
            leftValue: { name: 'gender' },
            operator: {
              not: false,
              rightValues: ['Male'],
              type: 'Contain'
            }
          }
        ]
      },
      referencedBy: []
    };

    mockClient.getSegmentDetails.mockResolvedValueOnce(mockSegmentDetails);

    const result = await getSegment.execute({ audience_id: 287197, segment_id: 1536120 });

    expect(mockClient.getSegmentDetails).toHaveBeenCalledWith(287197, 1536120);
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{
      type: 'text',
      text: JSON.stringify(mockSegmentDetails, null, 2)
    }]);
  });

  it('should handle errors gracefully', async () => {
    mockClient.getSegmentDetails.mockRejectedValueOnce(new Error('API Error'));

    const result = await getSegment.execute({ audience_id: 287197, segment_id: 999999 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error fetching segment details: API Error');
  });
});