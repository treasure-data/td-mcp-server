import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListDatabasesTool } from '../../src/tools/list-databases';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';

describe('ListDatabasesTool', () => {
  let tool: ListDatabasesTool;
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
    
    tool = new ListDatabasesTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger
    );
  });

  it('should list databases successfully', async () => {
    const mockResult = {
      data: [
        { schema_name: 'database1' },
        { schema_name: 'database2' },
        { schema_name: 'sample_datasets' },
      ],
      columns: [{ name: 'schema_name', type: 'varchar' }],
      stats: { state: 'FINISHED' },
    };
    
    mockClient.query.mockResolvedValue(mockResult);
    
    const result = await tool.execute();
    
    expect(result.databases).toEqual(['database1', 'database2', 'sample_datasets']);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT schema_name'),
      'information_schema'
    );
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'information_schema',
      expect.any(Number),
      3
    );
  });

  it('should handle empty database list', async () => {
    const mockResult = {
      data: [],
      columns: [{ name: 'schema_name', type: 'varchar' }],
      stats: { state: 'FINISHED' },
    };
    
    mockClient.query.mockResolvedValue(mockResult);
    
    const result = await tool.execute();
    
    expect(result.databases).toEqual([]);
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'information_schema',
      expect.any(Number),
      0
    );
  });

  it('should handle query errors', async () => {
    const error = new Error('Connection failed');
    mockClient.query.mockRejectedValue(error);
    
    await expect(tool.execute()).rejects.toThrow('Failed to list databases: Connection failed');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'Connection failed',
      'information_schema',
      expect.any(Number)
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockClient.query.mockRejectedValue('String error');
    
    await expect(tool.execute()).rejects.toThrow('Failed to list databases: Unknown error');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      expect.any(String),
      'Unknown error',
      'information_schema',
      expect.any(Number)
    );
  });
});