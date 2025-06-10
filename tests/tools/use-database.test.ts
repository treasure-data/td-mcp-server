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
    it('should successfully switch to an existing database', async () => {
      await server.switchDatabase('test_db');

      // Verify database validation was performed
      expect(mockListDatabases).toHaveBeenCalled();
      
      // Verify connection test was performed
      expect(mockTestConnection).toHaveBeenCalled();
      
      // Verify old client was destroyed
      expect(mockDestroy).toHaveBeenCalled();
      
      // Verify current database was updated
      expect(server.getCurrentDatabase()).toBe('test_db');
    });

    it('should throw error when switching to non-existent database', async () => {
      await expect(server.switchDatabase('non_existent_db')).rejects.toThrow(
        "Database 'non_existent_db' does not exist"
      );

      // Verify temp client was cleaned up even on error
      expect(mockDestroy).toHaveBeenCalled();
      
      // Verify current database was not changed
      expect(server.getCurrentDatabase()).toBe('initial_db');
    });

    it('should throw error when connection test fails', async () => {
      mockTestConnection.mockResolvedValueOnce(false);

      await expect(server.switchDatabase('test_db')).rejects.toThrow(
        "Failed to connect with database 'test_db'"
      );

      // Verify current database was not changed
      expect(server.getCurrentDatabase()).toBe('initial_db');
    });

    it('should create multiple clients during switch', async () => {
      await server.switchDatabase('test_db');

      // Should create 2 clients during switch:
      // 1. Temp client for validation
      // 2. New client with new database
      expect(TDTrinoClient).toHaveBeenCalledTimes(2);
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