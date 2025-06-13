import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segmentSql } from '../../../src/tools/cdp/segmentSql';
import { createCDPClient } from '../../../src/client/cdp';
import { loadConfig } from '../../../src/config';

vi.mock('../../../src/client/cdp', () => ({
  createCDPClient: vi.fn()
}));
vi.mock('../../../src/config', () => ({
  loadConfig: vi.fn()
}));

describe('segmentSql', () => {
  const mockClient = {
    getSegmentDetails: vi.fn(),
    getSegmentQuery: vi.fn()
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
    expect(segmentSql.name).toBe('segment_sql');
    expect(segmentSql.description).toContain('Get the SQL statement for a segment with filtering conditions');
    expect(segmentSql.inputSchema).toBeDefined();
  });

  it('should generate SQL for segment with rule successfully', async () => {
    // Mock segment details
    const mockSegmentDetails = {
      audienceId: '287197',
      id: '1536120',
      name: 'Test Segment',
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
      }
    };
    mockClient.getSegmentDetails.mockResolvedValueOnce(mockSegmentDetails);

    // Mock SQL generation
    const mockSql = 'select\n  a.*\nfrom "cdp_audience_287197"."customers" a\nwhere (\n  (position(\'Male\' in a."gender") > 0)\n)\n';
    mockClient.getSegmentQuery.mockResolvedValueOnce({ sql: mockSql });

    const result = await segmentSql.execute({ parent_segment_id: 287197, segment_id: 1536120 });

    expect(mockClient.getSegmentDetails).toHaveBeenCalledWith(287197, 1536120);
    expect(mockClient.getSegmentQuery).toHaveBeenCalledWith(287197, {
      format: 'sql',
      rule: mockSegmentDetails.rule
    });
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{
      type: 'text',
      text: mockSql
    }]);
  });

  it('should generate SQL for segment without rule', async () => {
    const mockSegmentDetails = {
      audienceId: '287197',
      id: '1536120',
      name: 'Test Segment'
      // No rule property
    };
    mockClient.getSegmentDetails.mockResolvedValueOnce(mockSegmentDetails);

    const mockSql = 'select\n  a.*\nfrom "cdp_audience_287197"."customers" a\n';
    mockClient.getSegmentQuery.mockResolvedValueOnce({ sql: mockSql });

    const result = await segmentSql.execute({ parent_segment_id: 287197, segment_id: 1536120 });

    expect(mockClient.getSegmentQuery).toHaveBeenCalledWith(287197, {
      format: 'sql'
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe(mockSql);
  });

  it('should handle segment not found', async () => {
    // Mock segment not found
    mockClient.getSegmentDetails.mockRejectedValueOnce(new Error('Not found'));

    const result = await segmentSql.execute({ parent_segment_id: 287197, segment_id: 999999 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error generating segment SQL: Not found');
  });

  it('should handle errors gracefully', async () => {
    mockClient.getSegmentDetails.mockRejectedValueOnce(new Error('API Error'));

    const result = await segmentSql.execute({ parent_segment_id: 287197, segment_id: 1536120 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error generating segment SQL: API Error');
  });
});