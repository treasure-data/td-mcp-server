import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hiveJobStatus } from '../../../src/tools/hive/job-status';
import { loadConfig } from '../../../src/config';
import { TDHiveClient } from '../../../src/client/hive';

vi.mock('../../../src/config');
vi.mock('../../../src/client/hive');

describe('hiveJobStatus tool', () => {
  const mockLoadConfig = loadConfig as any;
  const MockHiveClient = TDHiveClient as any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockReturnValue({ td_api_key: 'k', site: 'us01' });
    mockClient = { jobStatus: vi.fn() };
    MockHiveClient.mockImplementation(() => mockClient);
  });

  it('returns job status', async () => {
    mockClient.jobStatus.mockResolvedValue({ job_id: 'jid', status: 'running' });
    const res = await hiveJobStatus.handler({ job_id: 'jid' });
    expect(res).toEqual({ job_id: 'jid', status: 'running' });
    expect(mockClient.jobStatus).toHaveBeenCalledWith('jid');
  });
});

