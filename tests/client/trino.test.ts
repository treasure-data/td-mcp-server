import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDTrinoClient } from '../../src/client/trino';
import { Config } from '../../src/types';
import { Trino } from 'trino-client';

// Mock the trino-client module
vi.mock('trino-client');

// Mock package.json to provide a version
vi.mock('../../../package.json', () => ({
  version: '0.1.0',
}));

describe('TDTrinoClient', () => {
  const mockConfig: Config = {
    td_api_key: 'test-api-key-12345',
    site: 'us01',
    enable_updates: false,
  };

  let mockTrinoInstance: any;
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock query function
    mockQuery = vi.fn();

    // Create mock Trino instance
    mockTrinoInstance = {
      query: mockQuery,
    };

    // Mock Trino.create to return our mock instance
    vi.mocked(Trino.create).mockReturnValue(mockTrinoInstance);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      new TDTrinoClient(mockConfig);

      // Client is now created immediately in constructor
      expect(Trino.create).toHaveBeenCalledWith(
        expect.objectContaining({
          catalog: 'td',
          schema: 'information_schema', // Default schema
        })
      );
    });

    it('should create client with correct endpoint', () => {
      const jpConfig = { ...mockConfig, site: 'jp01' as const };
      new TDTrinoClient(jpConfig);

      expect(Trino.create).toHaveBeenCalledWith(
        expect.objectContaining({
          server: 'https://api-presto.treasuredata.co.jp:443',
          catalog: 'td',
          schema: 'information_schema', // Default schema since no database in config
          auth: expect.any(Object),
        })
      );
    });

    it('should include User-Agent header with version', () => {
      new TDTrinoClient(mockConfig);

      expect(Trino.create).toHaveBeenCalledWith(
        expect.objectContaining({
          extraHeaders: {
            'User-Agent': expect.stringMatching(/^td-mcp-server\/\d+\.\d+\.\d+$/),
          },
        })
      );
    });
  });

  describe('query', () => {
    it('should execute query and return formatted results', async () => {
      const client = new TDTrinoClient(mockConfig);

      // Mock async iterator
      const mockResults = [
        {
          columns: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'varchar' },
          ],
          data: [
            [1, 'Alice'],
            [2, 'Bob'],
          ],
        },
      ];

      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const result of mockResults) {
            yield result;
          }
        },
      });

      const result = await client.query('SELECT * FROM users');

      expect(result).toEqual({
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'varchar' },
        ],
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        rowCount: 2,
      });
    });

    it('should execute query with database parameter', async () => {
      const client = new TDTrinoClient(mockConfig);

      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { columns: [], data: [] };
        },
      });

      await client.query('SELECT 1');

      // The database parameter is ignored - query executes in default schema context
      expect(mockQuery).toHaveBeenCalledWith({
        query: 'SELECT 1',
        user: 'test-api-key-12345',
      });
    });

    it('should handle query errors', async () => {
      const client = new TDTrinoClient(mockConfig);

      mockQuery.mockRejectedValue(new Error('Query failed: syntax error'));

      await expect(client.query('INVALID SQL')).rejects.toThrow('Query failed: syntax error');
    });

    it('should handle QueryResult error field for syntax errors', async () => {
      const client = new TDTrinoClient(mockConfig);

      // Mock async iterator that returns a result with error
      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'query-12345',
            error: {
              message: 'line 1:8: mismatched input \'INVALID\'. Expecting: \'(\'',
              errorCode: 1,
              errorName: 'SYNTAX_ERROR',
              errorType: 'USER_ERROR',
              failureInfo: {
                type: 'com.facebook.presto.sql.parser.ParsingException',
                message: 'line 1:8: mismatched input \'INVALID\'',
                suppressed: [],
                stack: [],
              },
            },
          };
        },
      });

      await expect(client.query('SELECT INVALID SQL')).rejects.toThrow(
        '[SYNTAX_ERROR] line 1:8: mismatched input \'INVALID\'. Expecting: \'(\' (query-12345)'
      );
    });

    it('should handle QueryResult error without query ID', async () => {
      const client = new TDTrinoClient(mockConfig);

      // Mock async iterator that returns a result with error but no ID
      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            error: {
              message: 'Connection timeout',
              errorCode: 999,
              errorName: 'CONNECTION_ERROR',
              errorType: 'INTERNAL_ERROR',
              failureInfo: {
                type: 'java.net.SocketTimeoutException',
                message: 'Connection timeout',
                suppressed: [],
                stack: [],
              },
            },
          };
        },
      });

      await expect(client.query('SELECT 1')).rejects.toThrow(
        '[CONNECTION_ERROR] Connection timeout'
      );
    });

    it('should mask API key in error messages', async () => {
      const client = new TDTrinoClient(mockConfig);

      mockQuery.mockRejectedValue(new Error(`Auth failed for user test-api-key-12345`));

      await expect(client.query('SELECT 1')).rejects.toThrow('Auth failed for user ***');
    });
  });

  describe('execute', () => {
    it('should execute statement and return affected rows', async () => {
      const client = new TDTrinoClient(mockConfig);

      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'query-123',
            stats: { processedRows: 5 },
          };
        },
      });

      const result = await client.execute('UPDATE users SET active = true');

      expect(result).toEqual({
        affectedRows: 5,
        success: true,
      });
    });

    it('should handle QueryResult error field in execute', async () => {
      const client = new TDTrinoClient(mockConfig);

      mockQuery.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            id: 'query-67890',
            error: {
              message: 'Table users does not exist',
              errorCode: 42,
              errorName: 'TABLE_NOT_FOUND',
              errorType: 'USER_ERROR',
              failureInfo: {
                type: 'com.facebook.presto.sql.analyzer.SemanticException',
                message: 'Table users does not exist',
                suppressed: [],
                stack: [],
              },
            },
          };
        },
      });

      await expect(client.execute('UPDATE users SET active = true')).rejects.toThrow(
        '[TABLE_NOT_FOUND] Table users does not exist (query-67890)'
      );
    });
  });

  describe('utility methods', () => {
    let client: TDTrinoClient;

    beforeEach(() => {
      client = new TDTrinoClient(mockConfig);
    });

    describe('testConnection', () => {
      it('should return true when connection succeeds', async () => {
        mockQuery.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield { columns: [], data: [[1]] };
          },
        });

        const result = await client.testConnection();
        expect(result).toBe(true);
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
          query: 'SELECT 1',
          user: 'test-api-key-12345',
        }));
      });

      it('should return false when connection fails', async () => {
        mockQuery.mockRejectedValue(new Error('Connection failed'));

        const result = await client.testConnection();
        expect(result).toBe(false);
      });
    });

    describe('listDatabases', () => {
      it('should return list of database names', async () => {
        mockQuery.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              columns: [{ name: 'schema_name', type: 'varchar' }],
              data: [['db1'], ['db2'], ['db3']],
            };
          },
        });

        const databases = await client.listDatabases();
        expect(databases).toEqual(['db1', 'db2', 'db3']);
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
          query: "SELECT schema_name FROM \"td\".information_schema.schemata WHERE catalog_name = 'td' ORDER BY schema_name",
          user: 'test-api-key-12345',
        }));
      });
    });

    describe('listTables', () => {
      it('should return list of table names for database', async () => {
        mockQuery.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              columns: [{ name: 'table_name', type: 'varchar' }],
              data: [['users'], ['products'], ['orders']],
            };
          },
        });

        const tables = await client.listTables('mydb');
        expect(tables).toEqual(['users', 'products', 'orders']);
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
          query: "SELECT table_name FROM \"td\".information_schema.tables WHERE table_catalog = 'td' AND table_schema = 'mydb' ORDER BY table_name",
          user: 'test-api-key-12345',
        }));
      });
    });

    describe('describeTable', () => {
      it('should return table schema information', async () => {
        mockQuery.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              columns: [
                { name: 'column_name', type: 'varchar' },
                { name: 'data_type', type: 'varchar' },
                { name: 'is_nullable', type: 'varchar' },
              ],
              data: [
                ['id', 'integer', 'NO'],
                ['name', 'varchar', 'YES'],
                ['created_at', 'timestamp', 'NO'],
              ],
            };
          },
        });

        const schema = await client.describeTable('mydb', 'users');
        expect(schema).toEqual([
          { name: 'id', type: 'integer', nullable: false },
          { name: 'name', type: 'varchar', nullable: true },
          { name: 'created_at', type: 'timestamp', nullable: false },
        ]);
      });
    });
  });
});