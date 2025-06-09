import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DescribeTableTool } from '../../src/tools/describe-table';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';

describe('DescribeTableTool', () => {
  let tool: DescribeTableTool;
  let mockClient: any;
  let mockAuditLogger: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };
    
    mockAuditLogger = {
      logSuccess: vi.fn(),
      logFailure: vi.fn(),
    };
    
    tool = new DescribeTableTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger
    );
  });

  it('should describe table successfully', async () => {
    // Mock table exists check
    mockClient.query.mockResolvedValueOnce({
      data: [{ '1': 1 }],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    // Mock column info query
    mockClient.query.mockResolvedValueOnce({
      data: [
        { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'varchar', is_nullable: 'YES' },
        { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'NO' },
      ],
      columns: [
        { name: 'column_name', type: 'varchar' },
        { name: 'data_type', type: 'varchar' },
        { name: 'is_nullable', type: 'varchar' },
      ],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'users');
    
    expect(result.columns).toEqual([
      { column_name: 'id', data_type: 'bigint', is_nullable: false },
      { column_name: 'name', data_type: 'varchar', is_nullable: true },
      { column_name: 'created_at', data_type: 'timestamp', is_nullable: false },
    ]);
    
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'mydb',
      expect.any(Number),
      3
    );
  });

  it('should handle table with no columns', async () => {
    // Mock table exists check
    mockClient.query.mockResolvedValueOnce({
      data: [{ '1': 1 }],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    // Mock empty column list
    mockClient.query.mockResolvedValueOnce({
      data: [],
      columns: [
        { name: 'column_name', type: 'varchar' },
        { name: 'data_type', type: 'varchar' },
        { name: 'is_nullable', type: 'varchar' },
      ],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'empty_table');
    
    expect(result.columns).toEqual([]);
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'mydb',
      expect.any(Number),
      0
    );
  });

  it('should throw error for non-existent table', async () => {
    // Mock table does not exist
    mockClient.query.mockResolvedValueOnce({
      data: [],
      columns: [{ name: '1', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    await expect(tool.execute('mydb', 'nonexistent')).rejects.toThrow(
      "Failed to describe table: Table 'mydb.nonexistent' does not exist"
    );
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalled();
  });

  it('should validate database parameter', async () => {
    await expect(tool.execute('', 'table')).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(null as any, 'table')).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(undefined as any, 'table')).rejects.toThrow('Database parameter is required');
  });

  it('should validate table parameter', async () => {
    await expect(tool.execute('mydb', '')).rejects.toThrow('Table parameter is required');
    await expect(tool.execute('mydb', null as any)).rejects.toThrow('Table parameter is required');
    await expect(tool.execute('mydb', undefined as any)).rejects.toThrow('Table parameter is required');
  });

  it('should handle query errors', async () => {
    const error = new Error('Connection failed');
    mockClient.query.mockRejectedValue(error);
    
    await expect(tool.execute('mydb', 'users')).rejects.toThrow('Failed to describe table: Connection failed');
    
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
    
    await expect(tool.execute('mydb', 'users')).rejects.toThrow('Failed to describe table: Unknown error');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'Unknown error',
      'mydb',
      expect.any(Number)
    );
  });
});