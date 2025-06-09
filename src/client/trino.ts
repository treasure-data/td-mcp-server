import { Trino, BasicAuth, Query as TrinoQuery } from 'trino-client';
import { Config, QueryResult } from '../types';
import { getEndpointForSite, getTrinoPort, getCatalog } from './endpoints';

export class TDTrinoClient {
  private config: Config;
  private catalog: string;
  private clients: Map<string, Trino> = new Map();

  constructor(config: Config) {
    this.config = config;
    this.catalog = getCatalog();
  }

  private getClient(database: string = 'default'): Trino {
    // Cache clients per database
    if (!this.clients.has(database)) {
      const endpoint = getEndpointForSite(this.config.site);
      const url = new URL(endpoint);

      // Initialize Trino client with TD-specific configuration
      const client = Trino.create({
        server: `${url.protocol}//${url.hostname}:${getTrinoPort()}`,
        catalog: this.catalog,
        schema: database, // In TD, schema = database
        // TD uses API key as username in BasicAuth
        auth: new BasicAuth(this.config.td_api_key),
        ssl: {
          rejectUnauthorized: true,
        },
      });
      
      this.clients.set(database, client);
    }
    
    return this.clients.get(database)!;
  }

  async query(sql: string, database?: string): Promise<QueryResult> {
    try {
      // Get client for the specific database
      const client = this.getClient(database);
      
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        // TD uses API key as the user in X-Trino-User header
        user: this.config.td_api_key,
      };

      // Execute the query
      const iterator = await client.query(queryObj);
      
      // Collect results
      const rows: Array<Record<string, unknown>> = [];
      const columns: Array<{ name: string; type: string }> = [];
      let columnsSet = false;

      for await (const result of iterator) {
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

  async execute(sql: string, database?: string): Promise<{ affectedRows: number; success: boolean }> {
    try {
      // Get client for the specific database
      const client = this.getClient(database);
      
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        // TD uses API key as the user in X-Trino-User header
        user: this.config.td_api_key,
      };

      // Execute the statement
      const iterator = await client.query(queryObj);
      
      let affectedRows = 0;
      let success = false;

      for await (const result of iterator) {
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

  async listDatabases(): Promise<string[]> {
    // Query information_schema to get all databases
    // Use information_schema database for this query
    const result = await this.query(
      `SELECT schema_name FROM ${this.catalog}.information_schema.schemata WHERE catalog_name = '${this.catalog}' ORDER BY schema_name`,
      'information_schema'
    );
    return result.data.map((row) => row.schema_name as string);
  }

  async listTables(database: string): Promise<string[]> {
    // Query information_schema to get tables in a specific database
    const result = await this.query(
      `SELECT table_name FROM ${this.catalog}.information_schema.tables WHERE table_catalog = '${this.catalog}' AND table_schema = '${database}' ORDER BY table_name`,
      'information_schema'
    );
    return result.data.map((row) => row.table_name as string);
  }

  async describeTable(
    database: string,
    table: string
  ): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    // Query information_schema to get column information
    const result = await this.query(
      `SELECT column_name, data_type, is_nullable FROM ${this.catalog}.information_schema.columns WHERE table_catalog = '${this.catalog}' AND table_schema = '${database}' AND table_name = '${table}' ORDER BY ordinal_position`,
      'information_schema'
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
      return new Error(`Trino query failed: ${message}`);
    }
    return new Error('Trino query failed: Unknown error');
  }

  destroy(): void {
    // Clean up all client connections
    this.clients.clear();
  }
}