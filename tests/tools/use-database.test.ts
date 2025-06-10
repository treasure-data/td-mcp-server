import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TDMcpServer } from '../../src/server';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';

// Mock the config module
vi.mock('../../src/config', () => ({
  loadConfig: vi.fn(() => ({
    td_api_key: 'test-api-key-12345',
    site: 'dev',
    enable_updates: false,
    database: 'initial_db',
  })),
}));

// Mock TDTrinoClient
vi.mock('../../src/client/trino');

// Mock AuditLogger
vi.mock('../../src/security/audit-logger');

// Mock the StdioServerTransport
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    close: vi.fn(),
  })),
}));

describe('use_database functionality', () => {
  let server: TDMcpServer;
  let mockListDatabases: ReturnType<typeof vi.fn>;
  let mockTestConnection: ReturnType<typeof vi.fn>;
  let mockDestroy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock implementations
    mockListDatabases = vi.fn().mockResolvedValue(['initial_db', 'test_db', 'prod_db']);
    mockTestConnection = vi.fn().mockResolvedValue(true);
    mockDestroy = vi.fn();

    // Mock TDTrinoClient constructor and methods
    vi.mocked(TDTrinoClient).mockImplementation(() => ({
      listDatabases: mockListDatabases,
      testConnection: mockTestConnection,
      destroy: mockDestroy,
      database: 'mocked_db',
      query: vi.fn(),
      execute: vi.fn(),
      listTables: vi.fn(),
      describeTable: vi.fn(),
    } as any));

    // Mock AuditLogger
    vi.mocked(AuditLogger).mockImplementation(() => ({
      logSuccess: vi.fn(),
      logFailure: vi.fn(),
      logQuery: vi.fn(),
    } as any));

    server = new TDMcpServer();
  });

  describe('switchDatabase', () => {
    it('should successfully switch to a database', async () => {
      await server.switchDatabase('test_db');
      
      // Verify connection test was performed
      expect(mockTestConnection).toHaveBeenCalled();
      
      // Verify current database was updated
      expect(server.getCurrentDatabase()).toBe('test_db');
    });

    it('should destroy old client when switching databases', async () => {
      // First switch to create an initial client
      await server.switchDatabase('test_db');
      
      // Reset mocks
      vi.clearAllMocks();
      
      // Switch again
      await server.switchDatabase('prod_db');
      
      // Now old client should be destroyed
      expect(mockDestroy).toHaveBeenCalled();
      expect(server.getCurrentDatabase()).toBe('prod_db');
    });

    it('should let database validation happen at query time', async () => {
      // Since we removed upfront validation, switching to non-existent database
      // will succeed but queries will fail later
      await server.switchDatabase('non_existent_db');
      
      // Database switch succeeds
      expect(server.getCurrentDatabase()).toBe('non_existent_db');
      
      // The error will be caught when user tries to query
    });

    it('should throw error when connection test fails', async () => {
      mockTestConnection.mockResolvedValueOnce(false);

      await expect(server.switchDatabase('test_db')).rejects.toThrow(
        "Failed to connect with database 'test_db'"
      );

      // Verify current database was not changed
      expect(server.getCurrentDatabase()).toBe('initial_db');
    });

    it('should create new client during switch', async () => {
      await server.switchDatabase('test_db');

      // Should create 1 new client with new database
      expect(TDTrinoClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentDatabase', () => {
    it('should return initial database from config', () => {
      expect(server.getCurrentDatabase()).toBe('initial_db');
    });

    it('should return updated database after switch', async () => {
      await server.switchDatabase('test_db');
      expect(server.getCurrentDatabase()).toBe('test_db');
    });
  });

  describe('getClient', () => {
    it('should throw error if client not initialized', () => {
      // Create a fresh server instance that hasn't initialized client yet
      const freshServer = new TDMcpServer();
      
      // Access private property for testing (not ideal, but necessary for this test)
      (freshServer as any).trinoClient = null;
      
      expect(() => freshServer.getClient()).toThrow('Client not initialized');
    });
  });
});