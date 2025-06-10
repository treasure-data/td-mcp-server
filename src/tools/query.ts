import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';
import { QueryValidator } from '../security/query-validator';

export interface QueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
}

/**
 * MCP tool for executing read-only SQL queries
 */
export class QueryTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger,
    private readonly queryValidator: QueryValidator
  ) {}

  /**
   * Executes a read-only SQL query
   * @param sql - SQL query to execute (SELECT, SHOW, DESCRIBE only)
   * @param limit - Maximum number of rows to return (default: 40, max: 10000)
   * @returns Query results with columns, rows, and metadata
   * @throws {Error} If parameters are invalid or query fails
   */
  async execute(sql: string, limit: number = 40): Promise<QueryResult> {
    if (!sql || typeof sql !== 'string') {
      throw new Error('SQL parameter is required');
    }

    if (limit < 1 || limit > 10000) {
      throw new Error('Limit must be between 1 and 10000');
    }

    // Validate query
    const validation = this.queryValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(`Query validation failed: ${validation.error}`);
    }

    // Inject LIMIT if not present
    const processedSql = this.injectLimit(sql, limit);
    const startTime = Date.now();

    try {
      const result = await this.client.query(processedSql);
      const duration = Date.now() - startTime;

      // Convert result to array format for MCP
      const rows = result.data.map((row: Record<string, unknown>) => {
        return result.columns.map((col) => row[col.name]);
      });

      // Check if we hit the limit (might indicate truncation)
      const truncated = rows.length === limit && !this.hasExplicitLimit(sql);

      this.auditLogger.logSuccess(
        validation.queryType,
        processedSql,
        this.client.database,
        duration,
        rows.length
      );

      return {
        columns: result.columns,
        rows,
        rowCount: rows.length,
        truncated,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.auditLogger.logFailure(
        validation.queryType,
        processedSql,
        errorMessage,
        this.client.database,
        duration
      );

      throw new Error(`Query execution failed: ${errorMessage}`);
    }
  }

  /**
   * Injects a LIMIT clause if the query doesn't already have one
   */
  private injectLimit(sql: string, limit: number): string {
    // Check if query already has LIMIT
    if (this.hasExplicitLimit(sql)) {
      return sql;
    }

    // Remove trailing semicolon if present
    const trimmedSql = sql.trim().replace(/;+$/, '');

    // Add LIMIT clause
    return `${trimmedSql} LIMIT ${limit}`;
  }

  /**
   * Checks if the query already contains a LIMIT clause
   */
  private hasExplicitLimit(sql: string): boolean {
    // Simple regex check for LIMIT clause
    // This is a basic implementation and might need refinement
    const limitPattern = /\bLIMIT\s+\d+/i;
    return limitPattern.test(sql);
  }
}
