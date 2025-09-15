import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuditLogger } from '../../src/security/audit-logger';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new AuditLogger();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Basic logging', () => {
    it('should log successful queries', () => {
      logger.logSuccess('SELECT', 'SELECT * FROM users', 'mydb', 150, 10);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        queryType: 'SELECT',
        query: 'SELECT * FROM users',
        database: 'mydb',
        success: true,
        duration: 150,
        rowCount: 10,
      });
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should log failed queries', () => {
      logger.logFailure('UPDATE', 'UPDATE users SET x = 1', 'Syntax error', 'mydb', 50);
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        queryType: 'UPDATE',
        query: 'UPDATE users SET x = 1',
        database: 'mydb',
        success: false,
        error: 'Syntax error',
        duration: 50,
      });
    });

    it('should truncate long queries', () => {
      const longQuery = 'SELECT ' + 'x'.repeat(2000);
      logger = new AuditLogger({ maxQueryLength: 50 });
      logger.logSuccess('SELECT', longQuery);
      
      const logs = logger.getLogs();
      expect(logs[0].query).toHaveLength(53); // 50 + '...'
      expect(logs[0].query.endsWith('...')).toBe(true);
    });

    it('should not log when disabled', () => {
      logger = new AuditLogger({ enabled: false });
      logger.logSuccess('SELECT', 'SELECT 1');
      
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('Console logging', () => {
    it('should log to console when enabled', () => {
      logger = new AuditLogger({ logToConsole: true });
      logger.logSuccess('SELECT', 'SELECT 1', 'mydb', 100, 1);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logMessage = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('✓ SELECT [mydb] (100ms) -> 1 rows');
    });

    it('should log errors to console', () => {
      logger = new AuditLogger({ logToConsole: true });
      logger.logFailure('UPDATE', 'UPDATE x', 'Permission denied');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      const messages = consoleErrorSpy.mock.calls.map(call => call[0] as string);
      expect(messages.some(m => m.includes('Permission denied'))).toBe(true);
    });

    it('should not log to console when disabled', () => {
      logger = new AuditLogger({ logToConsole: false });
      logger.logSuccess('SELECT', 'SELECT 1');
      
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Filtering logs', () => {
    beforeEach(() => {
      // Add various logs
      const now = new Date();
      logger.logSuccess('SELECT', 'SELECT 1', 'db1', 100, 1);
      logger.logSuccess('UPDATE', 'UPDATE users', 'db2', 200, 5);
      logger.logFailure('DELETE', 'DELETE FROM x', 'Error', 'db1', 50);
      logger.logSuccess('SELECT', 'SELECT 2', 'db2', 150, 2);
    });

    it('should filter by query type', () => {
      const selectLogs = logger.getFilteredLogs({ queryType: 'SELECT' });
      expect(selectLogs).toHaveLength(2);
      expect(selectLogs.every(log => log.queryType === 'SELECT')).toBe(true);
    });

    it('should filter by success status', () => {
      const failedLogs = logger.getFilteredLogs({ success: false });
      expect(failedLogs).toHaveLength(1);
      expect(failedLogs[0].queryType).toBe('DELETE');
    });

    it('should filter by database', () => {
      const db1Logs = logger.getFilteredLogs({ database: 'db1' });
      expect(db1Logs).toHaveLength(2);
      expect(db1Logs.every(log => log.database === 'db1')).toBe(true);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      const future = new Date(now.getTime() + 60000); // 1 minute later
      
      const logsInRange = logger.getFilteredLogs({ 
        startTime: past, 
        endTime: future 
      });
      expect(logsInRange).toHaveLength(4);
      
      const logsOutOfRange = logger.getFilteredLogs({ 
        startTime: future 
      });
      expect(logsOutOfRange).toHaveLength(0);
    });

    it('should combine multiple filters', () => {
      const filtered = logger.getFilteredLogs({ 
        queryType: 'SELECT',
        database: 'db2',
        success: true
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].query).toBe('SELECT 2');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      logger.logSuccess('SELECT', 'SELECT 1', 'db1', 100, 1);
      logger.logSuccess('SELECT', 'SELECT 2', 'db1', 200, 2);
      logger.logSuccess('UPDATE', 'UPDATE users', 'db2', 300, 5);
      logger.logFailure('DELETE', 'DELETE FROM x', 'Error', 'db1', 50);
      logger.logSuccess('SELECT', 'SELECT 3', 'db2'); // No duration
    });

    it('should calculate correct statistics', () => {
      const stats = logger.getStats();
      
      expect(stats.totalQueries).toBe(5);
      expect(stats.successfulQueries).toBe(4);
      expect(stats.failedQueries).toBe(1);
      expect(stats.queryTypeBreakdown).toEqual({
        SELECT: 3,
        UPDATE: 1,
        DELETE: 1,
      });
      expect(stats.averageDuration).toBe((100 + 200 + 300 + 50) / 4);
    });

    it('should handle empty logs', () => {
      logger.clearLogs();
      const stats = logger.getStats();
      
      expect(stats.totalQueries).toBe(0);
      expect(stats.successfulQueries).toBe(0);
      expect(stats.failedQueries).toBe(0);
      expect(stats.queryTypeBreakdown).toEqual({});
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('Log management', () => {
    it('should clear logs', () => {
      logger.logSuccess('SELECT', 'SELECT 1');
      logger.logSuccess('UPDATE', 'UPDATE users');
      expect(logger.getLogs()).toHaveLength(2);
      
      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should return a copy of logs', () => {
      logger.logSuccess('SELECT', 'SELECT 1');
      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();
      
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });
});
