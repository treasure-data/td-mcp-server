import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parentSegmentSql } from '../../../src/tools/cdp/parentSegmentSql';
import { createCDPClient } from '../../../src/client/cdp';
import { loadConfig } from '../../../src/config';

vi.mock('../../../src/client/cdp', () => ({
  createCDPClient: vi.fn()
}));
vi.mock('../../../src/config', () => ({
  loadConfig: vi.fn()
}));

describe('parentSegmentSql', () => {
  const mockClient = {
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
    expect(parentSegmentSql.name).toBe('parent_segment_sql');
    expect(parentSegmentSql.description).toContain('Get the SQL statement for a parent segment');
    expect(parentSegmentSql.inputSchema).toBeDefined();
  });

  it('should generate SQL for parent segment successfully', async () => {
    const mockSql = 'select\n  a.*\nfrom "cdp_audience_287197"."customers" a\n';
    mockClient.getSegmentQuery.mockResolvedValueOnce({
      sql: mockSql
    });

    const result = await parentSegmentSql.execute({ parent_segment_id: 287197 });

    expect(mockClient.getSegmentQuery).toHaveBeenCalledWith(287197, { format: 'sql' });
    expect(result.isError).toBeFalsy();
    expect(result.content).toEqual([{
      type: 'text',
      text: mockSql
    }]);
  });

  it('should handle errors gracefully', async () => {
    mockClient.getSegmentQuery.mockRejectedValueOnce(new Error('API Error'));

    const result = await parentSegmentSql.execute({ parent_segment_id: 999999 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error generating parent segment SQL: API Error');
  });
});