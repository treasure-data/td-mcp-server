import { Trino, BasicAuth, Query as TrinoQuery } from 'trino-client';
import { Config, QueryResult } from '../types';
import { getEndpointForSite, getTrinoPort, getCatalog } from './endpoints';

/**
 * Trino client wrapper for Treasure Data
 * Handles authentication, query execution, and connection management
 */
export class TDTrinoClient {
  private config: Config;
  private catalog: string;
  private client: Trino;
  private defaultDatabase: string;

  constructor(config: Config) {
    this.config = config;
    this.catalog = getCatalog();
    this.defaultDatabase = config.database || 'information_schema';
    
    // Initialize single Trino client with default database
    const endpoint = getEndpointForSite(this.config.site);
    const url = new URL(endpoint);

    this.client = Trino.create({
      server: `${url.protocol}//${url.hostname}:${getTrinoPort()}`,
      catalog: this.catalog,
      schema: this.defaultDatabase, // Set default schema
      // TD uses API key as username in BasicAuth
      auth: new BasicAuth(this.config.td_api_key),
      ssl: {
        rejectUnauthorized: true,
      },
    });
  }

  /**
   * Executes a SQL query and returns the results
   * @param sql - SQL query to execute
   * @returns Query results with columns and data
   * @throws {Error} If query fails
   */
  async query(sql: string): Promise<QueryResult> {
    try {
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        // TD uses API key as the user in X-Trino-User header
        user: this.config.td_api_key,
      };

      // Execute the query
      const iterator = await this.client.query(queryObj);
      
      // Collect results
      const rows: Array<Record<string, unknown>> = [];
      const columns: Array<{ name: string; type: string }> = [];
      let columnsSet = false;

      for await (const result of iterator) {
        // Check for query errors first
        if (result.error) {
          const error = new Error(
            `${result.error.message} (${result.error.errorName}: ${result.error.errorCode})`
          );
          throw error;
        }

        if (!columnsSet && result.columns) {
          columns.push(
            ...result.columns.map((col) => ({
              name: col.name,
              type: col.type,
            }))
          );
          columnsSet = true;
        }

        if (result.data) {
          for (const row of result.data) {
            const rowObj: Record<string, unknown> = {};
            columns.forEach((col, idx) => {
              rowObj[col.name] = row[idx];
            });
            rows.push(rowObj);
          }
        }
      }

      return {
        columns,
        data: rows,
        rowCount: rows.length,
      };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  /**
   * Executes a SQL statement (for write operations)
   * @param sql - SQL statement to execute
   * @returns Execution result with affected rows count
   * @throws {Error} If execution fails
   */
  async execute(sql: string): Promise<{ affectedRows: number; success: boolean }> {
    try {
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        // TD uses API key as the user in X-Trino-User header
        user: this.config.td_api_key,
      };

      // Execute the statement
      const iterator = await this.client.query(queryObj);
      
      let affectedRows = 0;
      let success = false;

      for await (const result of iterator) {
        // Check for query errors first
        if (result.error) {
          const error = new Error(
            `${result.error.message} (${result.error.errorName}: ${result.error.errorCode})`
          );
          throw error;
        }

        if (result.stats) {
          // Try to get affected rows from stats
          affectedRows = result.stats.processedRows || 0;
        }
        if (result.id) {
          // Query has an ID, meaning it was accepted
          success = true;
        }
      }

      return { affectedRows, success };
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple query to test connection
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists all databases accessible to the user
   * @returns Array of database names
   */
  async listDatabases(): Promise<string[]> {
    // Query information_schema to get all databases
    const result = await this.query(
      `SELECT schema_name FROM ${this.catalog}.information_schema.schemata WHERE catalog_name = '${this.catalog}' ORDER BY schema_name`
    );
    return result.data.map((row) => row.schema_name as string);
  }

  /**
   * Lists all tables in a database
   * @param database - Database name
   * @returns Array of table names
   */
  async listTables(database: string): Promise<string[]> {
    // Query information_schema to get tables in a specific database
    const result = await this.query(
      `SELECT table_name FROM ${this.catalog}.information_schema.tables WHERE table_catalog = '${this.catalog}' AND table_schema = '${database}' ORDER BY table_name`
    );
    return result.data.map((row) => row.table_name as string);
  }

  async describeTable(
    database: string,
    table: string
  ): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    // Query information_schema to get column information
    const result = await this.query(
      `SELECT column_name, data_type, is_nullable FROM ${this.catalog}.information_schema.columns WHERE table_catalog = '${this.catalog}' AND table_schema = '${database}' AND table_name = '${table}' ORDER BY ordinal_position`
    );
    return result.data.map((row) => ({
      name: row.column_name as string,
      type: row.data_type as string,
      nullable: row.is_nullable === 'YES',
    }));
  }

  private wrapError(error: unknown): Error {
    if (error instanceof Error) {
      // Don't expose API key in error messages
      const message = error.message.replace(this.config.td_api_key, '***');
      return new Error(message);
    }
    return new Error('Unknown error');
  }

  destroy(): void {
    // Clean up client connection
    // Note: The trino-client library doesn't expose a destroy method,
    // but the connection will be cleaned up when the process exits
  }

  /**
   * Gets the current database/schema name
   */
  get database(): string {
    return this.defaultDatabase;
  }
}