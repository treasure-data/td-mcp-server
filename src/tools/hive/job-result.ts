import { z } from 'zod';
import { loadConfig } from '../../config';
import { TDHiveClient } from '../../client/hive';

const inputSchema = z.object({
  job_id: z.string().min(1).describe('TD job id to fetch results for')
});

export const hiveJobResult = {
  name: 'hive_job_result',
  description: 'Fetch result rows and schema for a completed Treasure Data Hive job.',
  inputSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string', description: 'Completed job ID.' }
    },
    required: ['job_id']
  },
  handler: async (args: unknown) => {
    const { job_id } = inputSchema.parse(args);
    const config = loadConfig();
    const client = new TDHiveClient(config);
    const [schema, result] = await Promise.all([
      client.jobResultSchema(job_id).catch(() => []),
      client.jobResult(job_id),
    ]);

    const columns = Array.isArray(schema)
      ? schema.map((c) => ({ name: c.name, type: c.type }))
      : [];
    const rows = result.rows || [];
    return {
      columns,
      rows,
      rowCount: rows.length,
    };
  }
};

