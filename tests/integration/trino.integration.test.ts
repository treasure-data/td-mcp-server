import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TDTrinoClient } from '../../src/client/trino';
import { Config } from '../../src/types';

// Integration tests that connect to real TD dev environment
// These tests are skipped by default unless TD_API_KEY_DEVELOPMENT_AWS is set
const isIntegrationTest = !!process.env.TD_API_KEY_DEVELOPMENT_AWS;

describe.skipIf(!isIntegrationTest)('TDTrinoClient Integration Tests', () => {
  let client: TDTrinoClient;
  
  beforeAll(() => {
    const config: Config = {
      td_api_key: process.env.TD_API_KEY_DEVELOPMENT_AWS!,
      site: 'dev',
      enable_updates: false,
    };
    
    client = new TDTrinoClient(config);
  });

  afterAll(() => {
    client.destroy();
  });

  describe('Connection Tests', () => {
    it('should successfully connect to TD dev environment', async () => {
      const isConnected = await client.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should fail with invalid API key', async () => {
      const invalidConfig: Config = {
        td_api_key: 'invalid-key',
        site: 'dev',
        enable_updates: false,
      };
      
      const invalidClient = new TDTrinoClient(invalidConfig);
      const isConnected = await invalidClient.testConnection();
      expect(isConnected).toBe(false);
      invalidClient.destroy();
    });
  });

  describe('Database Operations', () => {
    it('should list databases', async () => {
      const databases = await client.listDatabases();
      
      expect(Array.isArray(databases)).toBe(true);
      expect(databases.length).toBeGreaterThan(0);
      // information_schema should always exist
      expect(databases).toContain('information_schema');
    });

    it('should list tables in information_schema', async () => {
      const tables = await client.listTables('information_schema');
      
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      // These tables should always exist in information_schema
      expect(tables).toContain('columns');
      expect(tables).toContain('tables');
      expect(tables).toContain('schemata');
    });

    it('should describe table schema', async () => {
      const schema = await client.describeTable('information_schema', 'columns');
      
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      
      // Verify schema structure
      const columnNames = schema.map(col => col.name);
      expect(columnNames).toContain('table_catalog');
      expect(columnNames).toContain('table_schema');
      expect(columnNames).toContain('table_name');
      expect(columnNames).toContain('column_name');
      
      // Verify column properties
      schema.forEach(col => {
        expect(col).toHaveProperty('name');
        expect(col).toHaveProperty('type');
        expect(col).toHaveProperty('nullable');
        expect(typeof col.nullable).toBe('boolean');
      });
    });
  });

  describe('Query Execution', () => {
    it('should execute simple SELECT query', async () => {
      const result = await client.query('SELECT 1 as test_col, 2 as another_col');
      
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual({ name: 'test_col', type: 'integer' });
      expect(result.columns[1]).toEqual({ name: 'another_col', type: 'integer' });
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({ test_col: 1, another_col: 2 });
      expect(result.rowCount).toBe(1);
    });

    it('should execute query with schema context', async () => {
      const result = await client.query(
        'SELECT COUNT(*) as table_count FROM tables',
        'information_schema'
      );
      
      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe('table_count');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].table_count).toBeGreaterThan(0);
    });

    it('should handle query with no results', async () => {
      const result = await client.query(
        "SELECT * FROM schemata WHERE schema_name = 'non_existent_schema_12345'",
        'information_schema'
      );
      
      expect(result.columns.length).toBeGreaterThan(0);
      expect(result.data).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it('should handle query errors gracefully', async () => {
      await expect(
        client.query('SELECT * FROM non_existent_table')
      ).rejects.toThrow('Trino query failed');
    });

    it('should execute query with LIMIT', async () => {
      const result = await client.query(
        'SELECT * FROM tables LIMIT 5',
        'information_schema'
      );
      
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.rowCount).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should mask API key in error messages', async () => {
      try {
        // This should fail with a syntax error
        await client.query('INVALID SQL SYNTAX');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        // Ensure API key is not exposed in error
        expect(errorMessage).not.toContain(process.env.TD_API_KEY_DEVELOPMENT_AWS);
        expect(errorMessage).toContain('Trino query failed');
      }
    });
  });
});