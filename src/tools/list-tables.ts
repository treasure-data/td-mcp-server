import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';

export interface ListTablesResult {
  tables: string[];
}

/**
 * MCP tool for listing tables in a specific database
 */
export class ListTablesTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Lists all tables in the specified database
   * @param database - Database name to list tables from
   * @returns Object containing array of table names
   * @throws {Error} If database parameter is invalid or query fails
   */
  async execute(database: string): Promise<ListTablesResult> {
    if (!database || typeof database !== 'string') {
      throw new Error('Database parameter is required');
    }

    const query = `
      SELECT table_name 
      FROM td.information_schema.tables 
      WHERE table_catalog = 'td' 
        AND table_schema = '${database}'
      ORDER BY table_name
    `.trim();

    const startTime = Date.now();
    
    try {
      // First verify the database exists
      const dbCheckQuery = `
        SELECT 1 
        FROM td.information_schema.schemata 
        WHERE catalog_name = 'td' 
          AND schema_name = '${database}'
      `.trim();
      
      const dbExists = await this.client.query(dbCheckQuery, 'information_schema');
      
      if (dbExists.data.length === 0) {
        throw new Error(`Database '${database}' does not exist`);
      }
      
      // Execute the main query
      const result = await this.client.query(query, 'information_schema');
      const duration = Date.now() - startTime;
      
      // Extract table names from results
      const tables = result.data.map((row: any) => row.table_name as string);
      
      this.auditLogger.logSuccess(
        'SELECT',
        query,
        database,
        duration,
        tables.length
      );
      
      return { tables };
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
      
      throw new Error(`Failed to list tables: ${errorMessage}`);
    }
  }
}