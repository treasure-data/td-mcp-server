import { TDTrinoClient } from '../client/trino';
import { AuditLogger } from '../security/audit-logger';

export interface ListDatabasesResult {
  databases: string[];
}

/**
 * MCP tool for listing all databases in Treasure Data
 */
export class ListDatabasesTool {
  constructor(
    private readonly client: TDTrinoClient,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Lists all databases accessible to the user
   * @returns Object containing array of database names
   * @throws {Error} If the query fails
   */
  async execute(): Promise<ListDatabasesResult> {
    const query = `
      SELECT schema_name 
      FROM td.information_schema.schemata 
      WHERE catalog_name = 'td' 
      ORDER BY schema_name
    `.trim();

    const startTime = Date.now();
    
    try {
      // Execute query
      const result = await this.client.query(query);
      const duration = Date.now() - startTime;
      
      // Extract database names from results
      const databases = result.data.map((row: Record<string, unknown>) => row.schema_name as string);
      
      this.auditLogger.logSuccess(
        'SELECT',
        query,
        'information_schema',
        duration,
        databases.length
      );
      
      return { databases };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.auditLogger.logFailure(
        'SELECT',
        query,
        errorMessage,
        'information_schema',
        duration
      );
      
      throw new Error(`Failed to list databases: ${errorMessage}`);
    }
  }
}