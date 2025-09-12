import { z } from 'zod';
import { loadConfig } from '../../config';
import { TDHiveClient } from '../../client/hive';
import { QueryValidator } from '../../security/query-validator';
import { AuditLogger } from '../../security/audit-logger';
import { hiveQuery } from './query';

type HiveExecuteWriteResult = {
  job_id: string;
  status: string;
  success: boolean;
  message: string;
};

type HiveQueryResult = {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
};

const inputSchema = z.object({
  sql: z.string().min(1).describe('The Hive SQL to execute (write operations allowed when enable_updates=true)'),
  database: z.string().optional().describe('Database to execute against'),
  priority: z.number().int().optional().describe('Job priority (optional)'),
  retry_limit: z.number().int().optional().describe('Retry limit (optional)'),
  pool_name: z.string().optional().describe('Resource pool name (optional)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe('Max rows to return for read-only SQL routed to hive_query (default 40)')
});

export const hiveExecute = {
  name: 'hive_execute',
  description: 'Execute write operations using Treasure Data Hive (requires enable_updates=true). Returns job id and final status.',
  inputSchema: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'Hive SQL statement to execute.' },
      database: { type: 'string', description: 'Database (optional).' },
      priority: { type: 'number', description: 'Job priority (optional).' },
      retry_limit: { type: 'number', description: 'Retry limit (optional).' },
      pool_name: { type: 'string', description: 'Resource pool name (optional).' },
      limit: { type: 'number', description: 'Max rows to return for read-only SQL (default 40).', minimum: 1, maximum: 10000 }
    },
    required: ['sql']
  },
  handler: async (args: unknown): Promise<HiveExecuteWriteResult | HiveQueryResult> => {
    const { sql, database, priority, retry_limit, pool_name, limit } = inputSchema.parse(args);

    const config = loadConfig();
    const client = new TDHiveClient({ ...config, database: database || config.database });
    const validator = new QueryValidator(config.enable_updates);
    const auditor = new AuditLogger({ logToConsole: process.env.TD_MCP_LOG_TO_CONSOLE === 'true' });

    // Validate the statement
    const validation = validator.validate(sql);
    if (!validation.isValid) {
      throw new Error(`Query validation failed: ${validation.error}`);
    }

    if (validator.isReadOnly(validation.queryType)) {
      // Reuse hive_query for SELECT/SHOW/DESCRIBE to return data rows
      return await hiveQuery.handler({ sql, database, limit: limit ?? 40 });
    }

    const start = Date.now();
    try {
      const { job_id } = await client.issueHive(sql, database, { priority, retry_limit, pool_name });
      const status = await client.waitForCompletion(job_id);
      const duration = Date.now() - start;
      const success = status.status === 'success';

      if (success) {
        auditor.logSuccess(validation.queryType, sql, client.database, duration, status.num_records || 0);
      } else {
        auditor.logFailure(validation.queryType, sql, status.error || status.status, client.database, duration);
      }

      return {
        job_id,
        status: status.status,
        success,
        message: success ? 'Job completed successfully' : (status.error || 'Job did not succeed')
      };
    } catch (e) {
      const duration = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      auditor.logFailure(validation.queryType, sql, msg, client.database, duration);
      throw new Error(`Hive execute failed: ${msg}`);
    }
  }
};
