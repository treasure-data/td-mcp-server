import { Trino, BasicAuth, Query as TrinoQuery } from 'trino-client';
import { Config, QueryResult } from '../types';
import { getEndpointForSite, getTrinoPort, getCatalog } from './endpoints';

export class TDTrinoClient {
  private client: Trino;
  private config: Config;
  private catalog: string;

  constructor(config: Config) {
    this.config = config;
    this.catalog = getCatalog();

    const endpoint = getEndpointForSite(config.site);
    const url = new URL(endpoint);

    // Initialize Trino client with TD-specific configuration
    this.client = Trino.create({
      server: `${url.protocol}//${url.hostname}:${getTrinoPort()}`,
      catalog: this.catalog,
      schema: 'default',
      // No auth in connection, will use per-query auth
      auth: new BasicAuth('', ''),
      ssl: {
        rejectUnauthorized: true,
      },
    });
  }

  async query(sql: string, schema?: string): Promise<QueryResult> {
    try {
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        catalog: this.catalog,
        schema: schema || 'default',
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

  async execute(sql: string, schema?: string): Promise<{ affectedRows: number; success: boolean }> {
    try {
      // Build query object with TD API key as user
      const queryObj: TrinoQuery = {
        query: sql,
        catalog: this.catalog,
        schema: schema || 'default',
        // TD uses API key as the user in X-Trino-User header
        user: this.config.td_api_key,
      };

      // Execute the statement
      const iterator = await this.client.query(queryObj);
      
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
    const result = await this.query(
      `SELECT schema_name FROM ${this.catalog}.information_schema.schemata WHERE catalog_name = '${this.catalog}' ORDER BY schema_name`
    );
    return result.data.map((row) => row.schema_name as string);
  }

  async listTables(database: string): Promise<string[]> {
    const result = await this.query(
      `SELECT table_name FROM ${this.catalog}.information_schema.tables WHERE table_catalog = '${this.catalog}' AND table_schema = '${database}' ORDER BY table_name`
    );
    return result.data.map((row) => row.table_name as string);
  }

  async describeTable(
    database: string,
    table: string
  ): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
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
      return new Error(`Trino query failed: ${message}`);
    }
    return new Error('Trino query failed: Unknown error');
  }

  destroy(): void {
    // Clean up any resources if needed
    // The trino-client doesn't have explicit cleanup, but we include this for future use
  }
}