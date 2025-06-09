import { describe, it, expect } from 'vitest';
import { QueryValidator } from '../../src/security/query-validator';

describe('QueryValidator', () => {
  describe('Read-only mode (default)', () => {
    const validator = new QueryValidator(false);

    it('should allow SELECT queries', () => {
      const result = validator.validate('SELECT * FROM users');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('SELECT');
      expect(result.error).toBeUndefined();
    });

    it('should allow SELECT with WITH clause', () => {
      const result = validator.validate(`
        WITH user_counts AS (
          SELECT COUNT(*) as cnt FROM users
        )
        SELECT * FROM user_counts
      `);
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('SELECT');
    });

    it('should allow SHOW queries', () => {
      const result = validator.validate('SHOW TABLES');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('SHOW');
    });

    it('should allow DESCRIBE queries', () => {
      const result = validator.validate('DESCRIBE users');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('DESCRIBE');
    });

    it('should allow DESC queries', () => {
      const result = validator.validate('DESC users');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('DESCRIBE');
    });

    it('should block UPDATE queries', () => {
      const result = validator.validate('UPDATE users SET active = true');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('UPDATE');
      expect(result.error).toContain('UPDATE operations are not allowed');
    });

    it('should block DELETE queries', () => {
      const result = validator.validate('DELETE FROM users WHERE id = 1');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('DELETE');
      expect(result.error).toContain('DELETE operations are not allowed');
    });

    it('should block INSERT queries', () => {
      const result = validator.validate('INSERT INTO users (name) VALUES ("test")');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('INSERT');
      expect(result.error).toContain('INSERT operations are not allowed');
    });

    it('should block CREATE queries', () => {
      const result = validator.validate('CREATE TABLE test (id INT)');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('CREATE');
      expect(result.error).toContain('CREATE operations are not allowed');
    });

    it('should block DROP queries', () => {
      const result = validator.validate('DROP TABLE users');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('DROP');
      expect(result.error).toContain('DROP operations are not allowed');
    });

    it('should block ALTER queries', () => {
      const result = validator.validate('ALTER TABLE users ADD COLUMN age INT');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('ALTER');
      expect(result.error).toContain('ALTER operations are not allowed');
    });

    it('should block MERGE queries', () => {
      const result = validator.validate('MERGE INTO users USING ...');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('MERGE');
      expect(result.error).toContain('MERGE operations are not allowed');
    });

    it('should block WITH clauses containing write operations', () => {
      const result = validator.validate(`
        WITH deleted AS (
          DELETE FROM users WHERE active = false RETURNING *
        )
        SELECT * FROM deleted
      `);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('WITH clauses containing write operations');
    });

    it('should handle empty queries', () => {
      const result = validator.validate('');
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('UNKNOWN');
      expect(result.error).toContain('non-empty string');
    });

    it('should handle null queries', () => {
      const result = validator.validate(null as any);
      expect(result.isValid).toBe(false);
      expect(result.queryType).toBe('UNKNOWN');
      expect(result.error).toContain('non-empty string');
    });

    it('should handle queries with leading/trailing whitespace', () => {
      const result = validator.validate('  \n  SELECT * FROM users  \n  ');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('SELECT');
    });
  });

  describe('Update mode (enable_updates=true)', () => {
    const validator = new QueryValidator(true);

    it('should allow UPDATE queries', () => {
      const result = validator.validate('UPDATE users SET active = true');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('UPDATE');
    });

    it('should allow DELETE queries', () => {
      const result = validator.validate('DELETE FROM users WHERE id = 1');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('DELETE');
    });

    it('should allow INSERT queries', () => {
      const result = validator.validate('INSERT INTO users (name) VALUES ("test")');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('INSERT');
    });

    it('should allow CREATE queries', () => {
      const result = validator.validate('CREATE TABLE test (id INT)');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('CREATE');
    });

    it('should allow DROP queries', () => {
      const result = validator.validate('DROP TABLE users');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('DROP');
    });

    it('should allow ALTER queries', () => {
      const result = validator.validate('ALTER TABLE users ADD COLUMN age INT');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('ALTER');
    });

    it('should still allow SELECT queries', () => {
      const result = validator.validate('SELECT * FROM users');
      expect(result.isValid).toBe(true);
      expect(result.queryType).toBe('SELECT');
    });
  });

  describe('Query type detection', () => {
    const validator = new QueryValidator();

    it('should detect query type regardless of case', () => {
      expect(validator.validate('select * from users').queryType).toBe('SELECT');
      expect(validator.validate('SELECT * FROM users').queryType).toBe('SELECT');
      expect(validator.validate('SeLeCt * FrOm users').queryType).toBe('SELECT');
    });

    it('should handle queries with comments', () => {
      const result = validator.validate('-- This is a comment\nSELECT * FROM users');
      expect(result.queryType).toBe('SELECT');
    });

    it('should detect UNKNOWN for invalid queries', () => {
      const result = validator.validate('INVALID QUERY SYNTAX');
      expect(result.queryType).toBe('UNKNOWN');
    });
  });

  describe('Helper methods', () => {
    const validator = new QueryValidator();

    it('should correctly identify read-only query types', () => {
      expect(validator.isReadOnly('SELECT')).toBe(true);
      expect(validator.isReadOnly('SHOW')).toBe(true);
      expect(validator.isReadOnly('DESCRIBE')).toBe(true);
      expect(validator.isReadOnly('UPDATE')).toBe(false);
      expect(validator.isReadOnly('DELETE')).toBe(false);
    });

    it('should correctly identify write query types', () => {
      expect(validator.isWriteOperation('UPDATE')).toBe(true);
      expect(validator.isWriteOperation('DELETE')).toBe(true);
      expect(validator.isWriteOperation('INSERT')).toBe(true);
      expect(validator.isWriteOperation('CREATE')).toBe(true);
      expect(validator.isWriteOperation('DROP')).toBe(true);
      expect(validator.isWriteOperation('ALTER')).toBe(true);
      expect(validator.isWriteOperation('MERGE')).toBe(true);
      expect(validator.isWriteOperation('SELECT')).toBe(false);
      expect(validator.isWriteOperation('SHOW')).toBe(false);
    });
  });
});