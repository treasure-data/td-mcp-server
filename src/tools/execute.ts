import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';
import { QueryValidator } from '../security/query-validator';

export interface ExecuteResult {
  affectedRows?: number;
  message: string;
}

/**
 * MCP tool for executing write operations (UPDATE, DELETE, INSERT, etc.)
 */
export class ExecuteTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger,
    private readonly queryValidator: QueryValidator,
    private readonly enableUpdates: boolean
  ) {}

  /**
   * Executes a write operation SQL statement
   * @param sql - SQL statement to execute
   * @returns Execution result with affected rows and status message
   * @throws {Error} If write operations are disabled, parameters are invalid, or execution fails
   */
  async execute(
    sql: string
  ): Promise<ExecuteResult> {
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
      // Use the execute method for write operations
      const result = await this.client.execute(sql);
      const duration = Date.now() - startTime;
      
      // Extract affected rows if available
      const affectedRows = result.affectedRows;
      let message = `${validation.queryType} operation completed successfully`;
      
      if (affectedRows !== undefined && affectedRows > 0) {
        message = `${validation.queryType} operation completed. Affected rows: ${affectedRows}`;
      }
      
      // For CREATE/DROP/ALTER operations, we might not have row counts
      if (['CREATE', 'DROP', 'ALTER'].includes(validation.queryType)) {
        message = `${validation.queryType} operation completed successfully`;
      }
      
      this.auditLogger.logSuccess(
        validation.queryType,
        sql,
        this.client.database,
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
        this.client.database,
        duration
      );
      
      throw new Error(`Execute operation failed: ${errorMessage}`);
    }
  }
}