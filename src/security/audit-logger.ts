import { QueryType } from './query-validator';

export interface QueryAuditEntry {
  timestamp: Date;
  queryType: QueryType;
  database?: string;
  query: string;
  success: boolean;
  error?: string;
  duration?: number;
  rowCount?: number;
}

export interface AuditLoggerOptions {
  enabled?: boolean;
  logToConsole?: boolean;
  maxQueryLength?: number;
}

/**
 * Logs and tracks all database operations for security auditing
 */
export class AuditLogger {
  private readonly options: Required<AuditLoggerOptions>;
  private logs: QueryAuditEntry[] = [];

  constructor(options: AuditLoggerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      logToConsole: options.logToConsole ?? false,
      maxQueryLength: options.maxQueryLength ?? 1000,
    };
  }

  /**
   * Logs a query execution
   * @param entry - Audit entry without timestamp (added automatically)
   */
  logQuery(entry: Omit<QueryAuditEntry, 'timestamp'>): void {
    if (!this.options.enabled) {
      return;
    }

    const auditEntry: QueryAuditEntry = {
      ...entry,
      timestamp: new Date(),
      // Truncate long queries
      query: this.truncateQuery(entry.query),
    };

    this.logs.push(auditEntry);

    if (this.options.logToConsole) {
      this.writeToConsole(auditEntry);
    }
  }

  /**
   * Logs a successful query execution
   * @param queryType - Type of query executed
   * @param query - SQL query text
   * @param database - Database name (optional)
   * @param duration - Execution duration in milliseconds (optional)
   * @param rowCount - Number of rows returned/affected (optional)
   */
  logSuccess(
    queryType: QueryType,
    query: string,
    database?: string,
    duration?: number,
    rowCount?: number
  ): void {
    this.logQuery({
      queryType,
      query,
      database,
      success: true,
      duration,
      rowCount,
    });
  }

  /**
   * Logs a failed query execution
   * @param queryType - Type of query attempted
   * @param query - SQL query text
   * @param error - Error message
   * @param database - Database name (optional)
   * @param duration - Execution duration in milliseconds (optional)
   */
  logFailure(
    queryType: QueryType,
    query: string,
    error: string,
    database?: string,
    duration?: number
  ): void {
    this.logQuery({
      queryType,
      query,
      database,
      success: false,
      error,
      duration,
    });
  }

  /**
   * Gets all audit logs
   * @returns Read-only array of all audit entries
   */
  getLogs(): ReadonlyArray<QueryAuditEntry> {
    return [...this.logs];
  }

  /**
   * Gets logs filtered by criteria
   * @param filter - Filter criteria object
   * @returns Filtered array of audit entries
   */
  getFilteredLogs(filter: {
    startTime?: Date;
    endTime?: Date;
    queryType?: QueryType;
    success?: boolean;
    database?: string;
  }): QueryAuditEntry[] {
    return this.logs.filter((log) => {
      if (filter.startTime && log.timestamp < filter.startTime) return false;
      if (filter.endTime && log.timestamp > filter.endTime) return false;
      if (filter.queryType && log.queryType !== filter.queryType) return false;
      if (filter.success !== undefined && log.success !== filter.success) return false;
      if (filter.database && log.database !== filter.database) return false;
      return true;
    });
  }

  /**
   * Clears all logs from memory
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Gets audit statistics
   * @returns Statistics object with query counts and performance metrics
   */
  getStats(): {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    queryTypeBreakdown: Record<QueryType, number>;
    averageDuration: number;
  } {
    const stats = {
      totalQueries: this.logs.length,
      successfulQueries: 0,
      failedQueries: 0,
      queryTypeBreakdown: {} as Record<QueryType, number>,
      averageDuration: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const log of this.logs) {
      if (log.success) {
        stats.successfulQueries++;
      } else {
        stats.failedQueries++;
      }

      stats.queryTypeBreakdown[log.queryType] = (stats.queryTypeBreakdown[log.queryType] || 0) + 1;

      if (log.duration !== undefined) {
        totalDuration += log.duration;
        durationCount++;
      }
    }

    stats.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    return stats;
  }

  /**
   * Truncates a query to the maximum length
   */
  private truncateQuery(query: string): string {
    if (query.length <= this.options.maxQueryLength) {
      return query;
    }
    return query.substring(0, this.options.maxQueryLength) + '...';
  }

  /**
   * Writes an audit entry to the console
   */
  private writeToConsole(entry: QueryAuditEntry): void {
    const status = entry.success ? '✓' : '✗';
    const duration = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
    const database = entry.database ? `[${entry.database}]` : '';
    const rowCount = entry.rowCount !== undefined ? ` -> ${entry.rowCount} rows` : '';
    
    console.log(
      `[${entry.timestamp.toISOString()}] ${status} ${entry.queryType} ${database}${duration}${rowCount}`
    );
    
    if (!entry.success && entry.error) {
      console.error(`  Error: ${entry.error}`);
    }
  }
}