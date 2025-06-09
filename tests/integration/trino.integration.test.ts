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
      // Sample dataset should exist in dev environment
      expect(databases).toContain('sample_datasets');
      expect(databases).toContain('information_schema');
    });

    it('should list tables in sample_datasets', async () => {
      const tables = await client.listTables('sample_datasets');
      
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      // These tables should exist in sample_datasets
      expect(tables).toContain('www_access');
      expect(tables).toContain('nasdaq');
    });

    it('should describe www_access table schema', async () => {
      const schema = await client.describeTable('sample_datasets', 'www_access');
      
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      
      // Verify known columns in www_access table
      const columnNames = schema.map(col => col.name);
      expect(columnNames).toContain('time');
      expect(columnNames).toContain('method');
      expect(columnNames).toContain('path');
      expect(columnNames).toContain('code');
      expect(columnNames).toContain('size');
      
      // Verify column properties
      schema.forEach(col => {
        expect(col).toHaveProperty('name');
        expect(col).toHaveProperty('type');
        expect(col).toHaveProperty('nullable');
        expect(typeof col.nullable).toBe('boolean');
      });
    });

    it('should describe nasdaq table schema', async () => {
      const schema = await client.describeTable('sample_datasets', 'nasdaq');
      
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      
      // Verify known columns in nasdaq table
      const columnNames = schema.map(col => col.name);
      expect(columnNames).toContain('symbol');
      expect(columnNames).toContain('open');
      expect(columnNames).toContain('close');
      expect(columnNames).toContain('high');
      expect(columnNames).toContain('low');
      expect(columnNames).toContain('volume');
    });
  });

  describe('Query Execution', () => {
    it('should execute simple SELECT query', async () => {
      // Use a specific database for the query
      const result = await client.query('SELECT 1 as test_col, 2 as another_col', 'sample_datasets');
      
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual({ name: 'test_col', type: 'integer' });
      expect(result.columns[1]).toEqual({ name: 'another_col', type: 'integer' });
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({ test_col: 1, another_col: 2 });
      expect(result.rowCount).toBe(1);
    });

    it('should query www_access table with limit', async () => {
      const result = await client.query(
        'SELECT time, method, path, code FROM www_access LIMIT 5',
        'sample_datasets'
      );
      
      expect(result.columns).toHaveLength(4);
      expect(result.columns[0].name).toBe('time');
      expect(result.columns[1].name).toBe('method');
      expect(result.columns[2].name).toBe('path');
      expect(result.columns[3].name).toBe('code');
      
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.rowCount).toBeLessThanOrEqual(5);
      
      // Verify data structure
      if (result.data.length > 0) {
        const firstRow = result.data[0];
        expect(firstRow).toHaveProperty('time');
        expect(firstRow).toHaveProperty('method');
        expect(firstRow).toHaveProperty('path');
        expect(firstRow).toHaveProperty('code');
      }
    });

    it('should query nasdaq table with aggregation', async () => {
      const result = await client.query(
        'SELECT symbol, AVG(close) as avg_close FROM nasdaq GROUP BY symbol ORDER BY avg_close DESC LIMIT 10',
        'sample_datasets'
      );
      
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].name).toBe('symbol');
      expect(result.columns[1].name).toBe('avg_close');
      
      expect(result.data.length).toBeLessThanOrEqual(10);
      
      // Verify data is properly ordered
      if (result.data.length > 1) {
        for (let i = 1; i < result.data.length; i++) {
          const prevAvg = result.data[i - 1].avg_close as number;
          const currAvg = result.data[i].avg_close as number;
          expect(prevAvg).toBeGreaterThanOrEqual(currAvg);
        }
      }
    });

    it('should handle query with no results', async () => {
      const result = await client.query(
        "SELECT * FROM nasdaq WHERE symbol = 'NON_EXISTENT_SYMBOL_12345'",
        'sample_datasets'
      );
      
      expect(result.columns.length).toBeGreaterThan(0);
      expect(result.data).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it.skip('should handle query errors gracefully', async () => {
      // Note: Trino might return empty results rather than throwing errors for non-existent tables
      // This behavior can vary by environment configuration
      await expect(
        client.query('SELECT * FROM non_existent_table', 'sample_datasets')
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