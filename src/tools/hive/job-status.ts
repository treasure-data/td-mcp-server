import { z } from 'zod';
import { loadConfig } from '../../config';
import { TDHiveClient } from '../../client/hive';

const inputSchema = z.object({
  job_id: z.string().min(1).describe('TD job id to check')
});

export const hiveJobStatus = {
  name: 'hive_job_status',
  description: 'Get status/details for a Treasure Data Hive job by job_id.',
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string', description: 'Job ID to check.' }
    },
    required: ['job_id']
  },
  handler: async (args: unknown) => {
    const { job_id } = inputSchema.parse(args);
    const config = loadConfig();
    const client = new TDHiveClient(config);
    const status = await client.jobStatus(job_id);
    return status;
  }
};

