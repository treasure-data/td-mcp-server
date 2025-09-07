import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hiveQuery } from '../../../src/tools/hive/query';
import { loadConfig } from '../../../src/config';
import { TDHiveClient } from '../../../src/client/hive';

vi.mock('../../../src/config');
vi.mock('../../../src/client/hive');

describe('hiveQuery tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockHiveClient = TDHiveClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ td_api_key: 'k', site: 'us01', database: 'db' });
    mockClient = { query: vi.fn() };
    MockHiveClient.mockImplementation(() => mockClient);
  });

  it('executes read-only query and injects limit', async () => {
    mockClient.query.mockResolvedValue({
      columns: [{ name: 'c1', type: 'int' }],
      data: [{ c1: 1 }],
      rowCount: 1,
    });

    const res = await hiveQuery.handler({ sql: 'SELECT 1', limit: 5 });
    expect(res).toEqual({
      columns: [{ name: 'c1', type: 'int' }],
      rows: [[1]],
      rowCount: 1,
      truncated: false,
    });
    expect(MockHiveClient).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 LIMIT 5', undefined);
  });

  it('rejects write statements', async () => {
    await expect(hiveQuery.handler({ sql: 'UPDATE t SET a=1' })).rejects.toThrow(
      'Only read-only queries are allowed in hive_query'
    );
  });
});

