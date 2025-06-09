import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
}

export interface DescribeTableResult {
  columns: ColumnInfo[];
}

/**
 * MCP tool for describing table schema
 */
export class DescribeTableTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Gets column information for a specific table
   * @param database - Database name
   * @param table - Table name
   * @returns Object containing array of column information
   * @throws {Error} If parameters are invalid or query fails
   */
  async execute(database: string, table: string): Promise<DescribeTableResult> {
    if (!database || typeof database !== 'string') {
      throw new Error('Database parameter is required');
    }
    
    if (!table || typeof table !== 'string') {
      throw new Error('Table parameter is required');
    }

    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM td.information_schema.columns 
      WHERE table_catalog = 'td' 
        AND table_schema = '${database}'
        AND table_name = '${table}'
      ORDER BY ordinal_position
    `.trim();

    const startTime = Date.now();
    
    try {
      // First verify the table exists
      const tableCheckQuery = `
        SELECT 1 
        FROM td.information_schema.tables 
        WHERE table_catalog = 'td' 
          AND table_schema = '${database}'
          AND table_name = '${table}'
      `.trim();
      
      const tableExists = await this.client.query(tableCheckQuery, 'information_schema');
      
      if (tableExists.data.length === 0) {
        throw new Error(`Table '${database}.${table}' does not exist`);
      }
      
      // Execute the main query
      const result = await this.client.query(query, 'information_schema');
      const duration = Date.now() - startTime;
      
      // Format column information
      const columns: ColumnInfo[] = result.data.map((row: Record<string, unknown>) => ({
        column_name: row.column_name as string,
        data_type: row.data_type as string,
        is_nullable: row.is_nullable === 'YES',
      }));
      
      this.auditLogger.logSuccess(
        'SELECT',
        query,
        database,
        duration,
        columns.length
      );
      
      return { columns };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.auditLogger.logFailure(
        'SELECT',
        query,
        errorMessage,
        database,
        duration
      );
      
      throw new Error(`Failed to describe table: ${errorMessage}`);
    }
  }
}