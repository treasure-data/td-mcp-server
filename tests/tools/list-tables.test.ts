import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListTablesTool } from '../../src/tools/list-tables';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';

describe('ListTablesTool', () => {
  let tool: ListTablesTool;
  let mockClient: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      escapeStringLiteral: vi.fn((value: string) => `'${value.replace(/'/g, "''")}'`),
      escapeIdentifier: vi.fn((identifier: string) => `"${identifier.replace(/"/g, '""')}"`),
    };
    
    mockAuditLogger = {
      logSuccess: vi.fn(),
      logFailure: vi.fn(),
    };
    
    tool = new ListTablesTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger
    );
  });

  it('should list tables successfully', async () => {
    // Mock database exists check
    mockClient.query.mockResolvedValueOnce({
      data: [{ '1': 1 }],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    // Mock table list query
    mockClient.query.mockResolvedValueOnce({
      data: [
        { table_name: 'users' },
        { table_name: 'orders' },
        { table_name: 'products' },
      ],
      columns: [{ name: 'table_name', type: 'varchar' }],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb');
    
    expect(result.tables).toEqual(['users', 'orders', 'products']);
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockClient.query).toHaveBeenNthCalledWith(1,
      expect.stringContaining('schema_name = \'mydb\'')
    );
    expect(mockClient.query).toHaveBeenNthCalledWith(2,
      expect.stringContaining('table_schema = \'mydb\'')
    );
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'mydb',
      expect.any(Number),
      3
    );
  });

  it('should handle empty table list', async () => {
    // Mock database exists check
    mockClient.query.mockResolvedValueOnce({
      data: [{ '1': 1 }],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    // Mock empty table list
    mockClient.query.mockResolvedValueOnce({
      data: [],
      columns: [{ name: 'table_name', type: 'varchar' }],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('empty_db');
    
    expect(result.tables).toEqual([]);
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'empty_db',
      expect.any(Number),
      0
    );
  });

  it('should throw error for non-existent database', async () => {
    // Mock database does not exist
    mockClient.query.mockResolvedValueOnce({
      data: [],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    await expect(tool.execute('nonexistent')).rejects.toThrow(
      "Failed to list tables: Database 'nonexistent' does not exist"
    );
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalled();
  });

  it('should validate database parameter', async () => {
    await expect(tool.execute('')).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(null as any)).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(undefined as any)).rejects.toThrow('Database parameter is required');
  });

  it('should handle query errors', async () => {
    const error = new Error('Connection failed');
    mockClient.query.mockRejectedValue(error);
    
    await expect(tool.execute('mydb')).rejects.toThrow('Failed to list tables: Connection failed');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'Connection failed',
      'mydb',
      expect.any(Number)
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockClient.query.mockRejectedValue('String error');
    
    await expect(tool.execute('mydb')).rejects.toThrow('Failed to list tables: Unknown error');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'Unknown error',
      'mydb',
      expect.any(Number)
    );
  });
});