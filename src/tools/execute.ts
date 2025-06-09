import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';
import { QueryValidator } from '../security/query-validator';

export interface ExecuteResult {
  affectedRows?: number;
  message: string;
}

export class ExecuteTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger,
    private readonly queryValidator: QueryValidator,
    private readonly enableUpdates: boolean
  ) {}

  async execute(
    database: string,
    sql: string
  ): Promise<ExecuteResult> {
    if (!database || typeof database !== 'string') {
      throw new Error('Database parameter is required');
    }
    
    if (!sql || typeof sql !== 'string') {
      throw new Error('SQL parameter is required');
    }

    // Check if updates are enabled
    if (!this.enableUpdates) {
      throw new Error('Write operations are disabled. Set enable_updates=true in configuration to allow write operations.');
    }

    // Validate query
    const validation = this.queryValidator.validate(sql);
    if (!validation.isValid) {
      throw new Error(`Query validation failed: ${validation.error}`);
    }

    // Ensure this is a write operation
    if (this.queryValidator.isReadOnly(validation.queryType)) {
      throw new Error(`Use the query tool for read-only operations (${validation.queryType})`);
    }

    const startTime = Date.now();
    
    try {
      const result = await this.client.query(sql, database);
      const duration = Date.now() - startTime;
      
      // Extract affected rows if available
      let affectedRows: number | undefined;
      let message = `${validation.queryType} operation completed successfully`;
      
      // Different query types may return different result formats
      if (result.stats && typeof result.stats === 'object') {
        // Look for row count in stats
        const stats = result.stats as any;
        if (stats.processedRows !== undefined) {
          affectedRows = stats.processedRows;
          message = `${validation.queryType} operation completed. Affected rows: ${affectedRows}`;
        } else if (stats.completedSplits !== undefined) {
          message = `${validation.queryType} operation completed successfully`;
        }
      }
      
      // For CREATE/DROP/ALTER operations, we might not have row counts
      if (['CREATE', 'DROP', 'ALTER'].includes(validation.queryType)) {
        message = `${validation.queryType} operation completed successfully`;
      }
      
      this.auditLogger.logSuccess(
        validation.queryType,
        sql,
        database,
        duration,
        affectedRows
      );
      
      return {
        affectedRows,
        message,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.auditLogger.logFailure(
        validation.queryType,
        sql,
        errorMessage,
        database,
        duration
      );
      
      throw new Error(`Execute operation failed: ${errorMessage}`);
    }
  }
}