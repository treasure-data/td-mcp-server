import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryTool } from '../../src/tools/query';
import { TDTrinoClient } from '../../src/client/trino';
import { AuditLogger } from '../../src/security/audit-logger';
import { QueryValidator } from '../../src/security/query-validator';

describe('QueryTool', () => {
  let tool: QueryTool;
  let mockClient: any;
  let mockAuditLogger: any;
  let mockQueryValidator: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
    };
    
    mockAuditLogger = {
      logSuccess: vi.fn(),
      logFailure: vi.fn(),
    };
    
    mockQueryValidator = {
      validate: vi.fn(),
    };
    
    tool = new QueryTool(
      mockClient as TDTrinoClient,
      mockAuditLogger as AuditLogger,
      mockQueryValidator as QueryValidator
    );
  });

  it('should execute query successfully', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    mockClient.query.mockResolvedValue({
      data: [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ],
      columns: [
        { name: 'id', type: 'bigint' },
        { name: 'name', type: 'varchar' },
        { name: 'age', type: 'integer' },
      ],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'SELECT * FROM users');
    
    expect(result).toEqual({
      columns: [
        { name: 'id', type: 'bigint' },
        { name: 'name', type: 'varchar' },
        { name: 'age', type: 'integer' },
      ],
      rows: [
        [1, 'Alice', 30],
        [2, 'Bob', 25],
      ],
      rowCount: 2,
      truncated: false,
    });
    
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users LIMIT 40',
      'mydb'
    );
    expect(mockAuditLogger.logSuccess).toHaveBeenCalled();
  });

  it('should inject custom limit', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    mockClient.query.mockResolvedValue({
      data: [],
      columns: [],
      stats: { state: 'FINISHED' },
    });
    
    await tool.execute('mydb', 'SELECT * FROM users', 100);
    
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users LIMIT 100',
      'mydb'
    );
  });

  it('should not inject limit if query already has one', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    mockClient.query.mockResolvedValue({
      data: [],
      columns: [],
      stats: { state: 'FINISHED' },
    });
    
    await tool.execute('mydb', 'SELECT * FROM users LIMIT 10');
    
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users LIMIT 10',
      'mydb'
    );
  });

  it('should handle queries with trailing semicolon', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    mockClient.query.mockResolvedValue({
      data: [],
      columns: [],
      stats: { state: 'FINISHED' },
    });
    
    await tool.execute('mydb', 'SELECT * FROM users;');
    
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM users LIMIT 40',
      'mydb'
    );
  });

  it('should indicate truncation when hitting limit', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    // Return exactly the limit number of rows
    const data = Array(40).fill(null).map((_, i) => ({ id: i }));
    
    mockClient.query.mockResolvedValue({
      data,
      columns: [{ name: 'id', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'SELECT * FROM large_table', 40);
    
    expect(result.truncated).toBe(true);
    expect(result.rowCount).toBe(40);
  });

  it('should not indicate truncation for explicit limit', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    // Return exactly 10 rows (the explicit limit)
    const data = Array(10).fill(null).map((_, i) => ({ id: i }));
    
    mockClient.query.mockResolvedValue({
      data,
      columns: [{ name: 'id', type: 'integer' }],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'SELECT * FROM large_table LIMIT 10');
    
    expect(result.truncated).toBe(false);
  });

  it('should validate database parameter', async () => {
    await expect(tool.execute('', 'SELECT 1')).rejects.toThrow('Database parameter is required');
    await expect(tool.execute(null as any, 'SELECT 1')).rejects.toThrow('Database parameter is required');
  });

  it('should validate SQL parameter', async () => {
    await expect(tool.execute('mydb', '')).rejects.toThrow('SQL parameter is required');
    await expect(tool.execute('mydb', null as any)).rejects.toThrow('SQL parameter is required');
  });

  it('should validate limit parameter', async () => {
    await expect(tool.execute('mydb', 'SELECT 1', 0)).rejects.toThrow('Limit must be between 1 and 10000');
    await expect(tool.execute('mydb', 'SELECT 1', 10001)).rejects.toThrow('Limit must be between 1 and 10000');
  });

  it('should reject invalid queries', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: false,
      queryType: 'UPDATE',
      error: 'UPDATE operations are not allowed',
    });
    
    await expect(tool.execute('mydb', 'UPDATE users SET x = 1')).rejects.toThrow(
      'Query validation failed: UPDATE operations are not allowed'
    );
    
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('should handle query execution errors', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SELECT',
    });
    
    const error = new Error('Syntax error');
    mockClient.query.mockRejectedValue(error);
    
    await expect(tool.execute('mydb', 'SELECT * FROM users')).rejects.toThrow(
      'Query execution failed: Syntax error'
    );
    
    expect(mockAuditLogger.logFailure).toHaveBeenCalledWith(
      'SELECT',
      'SELECT * FROM users LIMIT 40',
      'Syntax error',
      'mydb',
      expect.any(Number)
    );
  });

  it('should handle SHOW queries', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'SHOW',
    });
    
    mockClient.query.mockResolvedValue({
      data: [{ Table: 'users' }, { Table: 'orders' }],
      columns: [{ name: 'Table', type: 'varchar' }],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'SHOW TABLES');
    
    expect(result.rows).toEqual([['users'], ['orders']]);
    expect(mockAuditLogger.logSuccess).toHaveBeenCalledWith(
      'SHOW',
      expect.any(String),
      'mydb',
      expect.any(Number),
      2
    );
  });

  it('should handle DESCRIBE queries', async () => {
    mockQueryValidator.validate.mockReturnValue({
      isValid: true,
      queryType: 'DESCRIBE',
    });
    
    mockClient.query.mockResolvedValue({
      data: [
        { Column: 'id', Type: 'bigint', Null: 'NO' },
        { Column: 'name', Type: 'varchar', Null: 'YES' },
      ],
      columns: [
        { name: 'Column', type: 'varchar' },
        { name: 'Type', type: 'varchar' },
        { name: 'Null', type: 'varchar' },
      ],
      stats: { state: 'FINISHED' },
    });
    
    const result = await tool.execute('mydb', 'DESCRIBE users');
    
    expect(result.rows).toEqual([
      ['id', 'bigint', 'NO'],
      ['name', 'varchar', 'YES'],
    ]);
  });
});