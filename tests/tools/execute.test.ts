import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecuteTool } from '../../src/tools/execute';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';
import { QueryValidator } from '../../src/security/query-validator';

describe('ExecuteTool', () => {
  let tool: ExecuteTool;
  let toolWithUpdatesDisabled: ExecuteTool;
  let mockClient: any;
  let mockAuditLogger: any;
  let mockQueryValidator: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      execute: vi.fn(),
    };
    
    mockAuditLogger = {
      logSuccess: vi.fn(),
      logFailure: vi.fn(),
    };
    
    mockQueryValidator = {
      validate: vi.fn(),
      isReadOnly: vi.fn(),
    };
    
    tool = new ExecuteTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger,
      mockQueryValidator as QueryValidator,
      true // enable_updates = true
    );
    
    toolWithUpdatesDisabled = new ExecuteTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger,
      mockQueryValidator as QueryValidator,
      false // enable_updates = false
    );
  });

  it('should execute UPDATE query successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'UPDATE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 5,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'UPDATE users SET active = true WHERE id > 10');
    
    expect(result).toEqual({
      affectedRows: 5,
      message: 'UPDATE operation completed. Affected rows: 5',
    });
    
    expect(mockClient.execute).toHaveBeenCalledWith(
      'UPDATE users SET active = true WHERE id > 10',
      'mydb'
    );
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'UPDATE',
      expect.any(String),
      'mydb',
      expect.any(Number),
      5
    );
  });

  it('should execute INSERT query successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'INSERT',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 1,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'INSERT INTO users (name) VALUES ("test")');
    
    expect(result.affectedRows).toBe(1);
    expect(result.message).toContain('INSERT operation completed');
  });

  it('should execute DELETE query successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'DELETE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 10,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'DELETE FROM users WHERE inactive = true');
    
    expect(result.affectedRows).toBe(10);
    expect(result.message).toBe('DELETE operation completed. Affected rows: 10');
  });

  it('should execute CREATE TABLE successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'CREATE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 0,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'CREATE TABLE test (id INT)');
    
    expect(result.affectedRows).toBe(0);
    expect(result.message).toBe('CREATE operation completed successfully');
  });

  it('should execute DROP TABLE successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'DROP',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 0,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'DROP TABLE old_table');
    
    expect(result.message).toBe('DROP operation completed successfully');
  });

  it('should execute ALTER TABLE successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'ALTER',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: 0,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'ALTER TABLE users ADD COLUMN age INT');
    
    expect(result.message).toBe('ALTER operation completed successfully');
  });

  it('should throw error when updates are disabled', async () => {
    await expect(
      toolWithUpdatesDisabled.execute('mydb', 'UPDATE users SET x = 1')
    ).rejects.toThrow('Write operations are disabled. Set enable_updates=true in configuration to allow write operations.');
    
    expect(mockClient.execute).not.toHaveBeenCalled();
  });

  it('should reject read-only operations', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(true);
    
    await expect(
      tool.execute('mydb', 'SELECT * FROM users')
    ).rejects.toThrow('Use the query tool for read-only operations (SELECT)');
    
    expect(mockClient.execute).not.toHaveBeenCalled();
  });

  it('should validate database parameter', async () => {
    await expect(tool.execute('', 'UPDATE users SET x = 1')).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(null as any, 'UPDATE users SET x = 1')).rejects.toThrow('Database parameter is required');
  });

  it('should validate SQL parameter', async () => {
    await expect(tool.execute('mydb', '')).rejects.toThrow('SQL parameter is required');
    await expect(tool.execute('mydb', null as any)).rejects.toThrow('SQL parameter is required');
  });

  it('should reject invalid queries', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: false,
      queryType: 'UNKNOWN',
      error: 'Invalid SQL syntax',
    });
    
    await expect(
      tool.execute('mydb', 'INVALID SQL')
    ).rejects.toThrow('Query validation failed: Invalid SQL syntax');
    
    expect(mockClient.execute).not.toHaveBeenCalled();
  });

  it('should handle query execution errors', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'UPDATE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    const error = new Error('Permission denied');
    mockClient.execute.mockRejectedValue(error);
    
    await expect(
      tool.execute('mydb', 'UPDATE users SET admin = true')
    ).rejects.toThrow('Execute operation failed: Permission denied');
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'UPDATE',
      'UPDATE users SET admin = true',
      'Permission denied',
      'mydb',
      expect.any(Number)
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'UPDATE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockRejectedValue('String error');
    
    await expect(
      tool.execute('mydb', 'UPDATE users SET x = 1')
    ).rejects.toThrow('Execute operation failed: Unknown error');
  });

  it('should handle missing stats gracefully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'UPDATE',
    });
    mockQueryValidator.isReadOnly.mockReturnValue(false);
    
    mockClient.execute.mockResolvedValue({
      affectedRows: undefined,
      success: true,
    });
    
    const result = await tool.execute('mydb', 'UPDATE users SET x = 1');
    
    expect(result.affectedRows).toBeUndefined();
    expect(result.message).toBe('UPDATE operation completed successfully');
  });
});