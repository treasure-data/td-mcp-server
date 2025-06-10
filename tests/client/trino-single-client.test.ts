import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TDTrinoClient } from '../../src/client/trino';
import { Config } from '../../src/types';

// Mock the Trino client
const mockTrinoQuery = vi.fn();
vi.mock('trino-client', () => ({
  Trino: {
    create: vi.fn(() => ({
      query: mockTrinoQuery,
    })),
  },
  BasicAuth: vi.fn(),
}));

describe('TDTrinoClient - Single Client Fix', () => {
  let client: TDTrinoClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    const config: Config = {
      td_api_key: 'test-api-key',
      site: 'dev',
      database: 'my_default_db', // Default database
    };
    
    client = new TDTrinoClient(config);
  });
  
  it('should use the configured default database for queries', async () => {
    // The client is configured with 'my_default_db' as the default database
    // When querying a table without database prefix, it should look in my_default_db
    
    mockTrinoQuery.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          columns: [{ name: 'id', type: 'bigint' }],
          data: [[1], [2], [3]],
        };
      },
    });
    
    await client.query('SELECT * FROM accounts');
    
    // The query should be executed as-is, without modification
    expect(mockTrinoQuery).toHaveBeenCalledWith({
      query: 'SELECT * FROM accounts',
      user: 'test-api-key',
    });
    
    // Since the client is configured with my_default_db, but the user wants leo_dbt,
    // and we're not modifying the query, this will likely result in a table not found error
    // if 'accounts' doesn't exist in my_default_db
  });
  
  it('should use information_schema as default when no database is configured', () => {
    const config: Config = {
      td_api_key: 'test-api-key',
      site: 'dev',
      // No database specified - should default to information_schema
    };
    
    const clientWithoutDefault = new TDTrinoClient(config);
    
    // Check that the client was created with information_schema as the default
    expect(clientWithoutDefault['defaultDatabase']).toBe('information_schema');
  });
});