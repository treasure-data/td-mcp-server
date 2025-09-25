import { z } from 'zod';
import { loadConfig } from '../../config';
import { TDHiveClient } from '../../client/hive';
import { QueryValidator } from '../../security/query-validator';
import { AuditLogger } from '../../security/audit-logger';

const inputSchema = z.object({
  sql: z.string().min(1).describe('The Hive SQL query to execute (read-only)'),
  database: z.string().optional().describe('The database name (optional if TD_DATABASE is configured)'),
  limit: z.number().int().min(1).max(10000).optional().describe('Max rows to return (default 40)')
});

export const hiveQuery = {
  name: 'hive_query',
  description: 'Execute a read-only SQL query using Treasure Data Hive (v3 API). Supports LIMIT injection and returns rows + schema.',
  inputSchema: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'Hive SQL query (SELECT, SHOW, DESCRIBE only).' },
      database: { type: 'string', description: 'Database to query (optional).' },
      limit: { type: 'number', description: 'Max rows to return (default 40).', minimum: 1, maximum: 10000 }
    },
    required: ['sql']
  },
  handler: async (args: unknown) => {
    const { sql, database, limit } = inputSchema.parse(args);

    const config = loadConfig();
    const client = new TDHiveClient({ ...config, database: database || config.database });
    const validator = new QueryValidator(false); // disallow writes regardless of env flag for this tool
    const auditor = new AuditLogger({ logToConsole: process.env.TD_MCP_LOG_TO_CONSOLE === 'true' });

    // Validate as read-only
    const validation = validator.validate(sql);
    if (!validation.isValid || !validator.isReadOnly(validation.queryType)) {
      throw new Error('Only read-only queries are allowed in hive_query. Use hive_execute for write operations.');
    }

    const finalLimit = limit ?? 40;
    const processedSql = injectLimit(sql, finalLimit);
    const start = Date.now();
    try {
      const result = await client.query(processedSql, database);
      const duration = Date.now() - start;

      // Convert to rows[][] for MCP
      const rows = result.data.map((row) => result.columns.map((c) => row[c.name]));
      const truncated = rows.length === finalLimit && !hasExplicitLimit(sql);

      auditor.logSuccess(validation.queryType, processedSql, client.database, duration, rows.length);

      return {
        columns: result.columns,
        rows,
        rowCount: rows.length,
        truncated
      };
    } catch (e) {
      const duration = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      auditor.logFailure(validation.queryType, processedSql, msg, client.database, duration);
      throw new Error(`Hive query failed: ${msg}`);
    }
  }
};

function injectLimit(sql: string, limit: number): string {
  if (hasExplicitLimit(sql)) return sql;
  const trimmed = sql.trim().replace(/;+$/, '');
  return `${trimmed} LIMIT ${limit}`;
}

function hasExplicitLimit(sql: string): boolean {
  return /\bLIMIT\s+\d+/i.test(sql);
}
