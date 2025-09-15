import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDHiveClient } from '../../src/client/hive';

// Mock maskApiKey to predictable masking
vi.mock('../../src/config', () => ({
  maskApiKey: (k: string) => `${k.slice(0,4)}...${k.slice(-4)}`,
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('TDHiveClient', () => {
  const apiKey = '1111222233334444';
  const baseConfig = {
    td_api_key: apiKey,
    site: 'us01' as const,
    database: 'sample_datasets',
  };
  const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockRes({ ok = true, status = 200, json, text, contentType = 'application/json' }: any) {
    return {
      ok,
      status,
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
      json: json ? async () => json : undefined,
      text: text ? async () => text : async () => '',
    } as any;
  }

  it('issues hive job with correct payload', async () => {
    const client = new TDHiveClient(baseConfig);
    mockFetch.mockResolvedValueOnce(mockRes({ json: { job_id: '123' } }));
    const res = await client.issueHive('SELECT 1', 'db1', { priority: 1, retry_limit: 2, pool_name: 'gold' });
    expect(res).toEqual({ job_id: '123' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.treasuredata.com/v3/job/issue/hive/db1',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `TD1 ${apiKey}` }),
        body: JSON.stringify({ query: 'SELECT 1', db: 'db1', priority: 1, retry_limit: 2, pool_name: 'gold' }),
      })
    );
  });

  it('gets job status', async () => {
    const client = new TDHiveClient(baseConfig);
    mockFetch.mockResolvedValueOnce(mockRes({ json: { job_id: '123', status: 'running' } }));
    const res = await client.jobStatus('123');
    expect(res.status).toBe('running');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.treasuredata.com/v3/job/status/123',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetches job result with format=json', async () => {
    const client = new TDHiveClient(baseConfig);
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '[[1],[2]]' } as any);
    const res = await client.jobResult('123');
    expect(res.rows).toEqual([[1],[2]]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.treasuredata.com/v3/job/result/123?format=json',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetches job result schema via job/show', async () => {
    const client = new TDHiveClient(baseConfig);
    const hiveSchema = JSON.stringify([["c1","int"],["c2","varchar"]]);
    mockFetch.mockResolvedValueOnce(mockRes({ json: { hive_result_schema: hiveSchema } }));
    const res = await client.jobResultSchema('123');
    expect(res).toEqual([{ name: 'c1', type: 'int' }, { name: 'c2', type: 'varchar' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.treasuredata.com/v3/job/show/123',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('waits for completion until terminal state', async () => {
    const client = new TDHiveClient(baseConfig);
    mockFetch
      .mockResolvedValueOnce(mockRes({ json: { status: 'queued' } }))
      .mockResolvedValueOnce(mockRes({ json: { status: 'running' } }))
      .mockResolvedValueOnce(mockRes({ json: { status: 'success' } }));
    const status = await client.waitForCompletion('123', { pollMs: 1, timeoutMs: 1000 });
    expect(status.status).toBe('success');
  });

  it('masks API key in error messages', async () => {
    const client = new TDHiveClient(baseConfig);
    mockFetch.mockResolvedValueOnce(mockRes({ ok: false, status: 403, text: `Forbidden for ${apiKey}` }));
    await expect(client.issueHive('SELECT 1')).rejects.toThrow(/1111\.\.\.4444/);
  });
});
