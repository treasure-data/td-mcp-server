import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hiveExecute } from '../../../src/tools/hive/execute';
import { loadConfig } from '../../../src/config';
import { TDHiveClient } from '../../../src/client/hive';

vi.mock('../../../src/config');
vi.mock('../../../src/client/hive');

describe('hiveExecute tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockHiveClient = TDHiveClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ td_api_key: 'k', site: 'us01', database: 'db', enable_updates: true });
    mockClient = { issueHive: vi.fn(), waitForCompletion: vi.fn(), query: vi.fn() };
    MockHiveClient.mockImplementation(() => mockClient);
  });

  it('routes read-only statements to hive_query and returns rows', async () => {
    mockLoadConfig.mockReturnValueOnce({ td_api_key: 'k', site: 'us01', database: 'db', enable_updates: true });
    // hive_query will call client.query and expect columns/data
    mockClient.query.mockResolvedValue({
      columns: [{ name: 'c1', type: 'int' }],
      data: [{ c1: 1 }],
      rowCount: 1,
    });

    const res = await hiveExecute.handler({ sql: 'SELECT 1' });
    expect(res).toEqual({
      columns: [{ name: 'c1', type: 'int' }],
      rows: [[1]],
      rowCount: 1,
      truncated: false,
    });
    expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 LIMIT 40', undefined);
  });

  it('routes read-only with custom limit', async () => {
    mockLoadConfig.mockReturnValueOnce({ td_api_key: 'k', site: 'us01', database: 'db', enable_updates: true });
    mockClient.query.mockResolvedValue({
      columns: [{ name: 'c1', type: 'int' }],
      data: [{ c1: 1 }],
      rowCount: 1,
    });

    const res = await hiveExecute.handler({ sql: 'SELECT 1', limit: 5 });
    expect(res).toEqual({
      columns: [{ name: 'c1', type: 'int' }],
      rows: [[1]],
      rowCount: 1,
      truncated: false,
    });
    expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 LIMIT 5', undefined);
  });

  it('executes write and returns status', async () => {
    mockClient.issueHive.mockResolvedValue({ job_id: 'jid' });
    mockClient.waitForCompletion.mockResolvedValue({ status: 'success', num_records: 0 });
    const res = await hiveExecute.handler({ sql: 'INSERT INTO t SELECT 1', database: 'db1' });
    expect(res).toEqual({ job_id: 'jid', status: 'success', success: true, message: 'Job completed successfully' });
    expect(mockClient.issueHive).toHaveBeenCalledWith('INSERT INTO t SELECT 1', 'db1', { priority: undefined, retry_limit: undefined, pool_name: undefined });
  });
});
