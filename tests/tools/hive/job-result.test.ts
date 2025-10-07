import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hiveJobResult } from '../../../src/tools/hive/job-result';
import { loadConfig } from '../../../src/config';
import { TDHiveClient } from '../../../src/client/hive';

vi.mock('../../../src/config');
vi.mock('../../../src/client/hive');

describe('hiveJobResult tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockHiveClient = TDHiveClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ td_api_key: 'k', site: 'us01' });
    mockClient = { jobResultSchema: vi.fn(), jobResult: vi.fn() };
    MockHiveClient.mockImplementation(() => mockClient);
  });

  it('returns columns and rows', async () => {
    mockClient.jobResultSchema.mockResolvedValue([{ name: 'c1', type: 'int' }]);
    mockClient.jobResult.mockResolvedValue({ rows: [[1]] });
    const res = await hiveJobResult.handler({ job_id: 'jid' });
    expect(res).toEqual({ columns: [{ name: 'c1', type: 'int' }], rows: [[1]], rowCount: 1 });
  });
});

