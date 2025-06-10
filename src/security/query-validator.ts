export type QueryType =
  | 'SELECT'
  | 'SHOW'
  | 'DESCRIBE'
  | 'UPDATE'
  | 'DELETE'
  | 'INSERT'
  | 'CREATE'
  | 'DROP'
  | 'ALTER'
  | 'MERGE'
  | 'UNKNOWN';

export interface ValidationResult {
  isValid: boolean;
  queryType: QueryType;
  error?: string;
}

// Regular expressions for different query types
const QUERY_PATTERNS: Record<QueryType, RegExp> = {
  SELECT: /^\s*(WITH\s+.+?\s+)?SELECT\s+/is,
  SHOW: /^\s*SHOW\s+/i,
  DESCRIBE: /^\s*(DESCRIBE|DESC)\s+/i,
  UPDATE: /^\s*UPDATE\s+/i,
  DELETE: /^\s*DELETE\s+/i,
  INSERT: /^\s*INSERT\s+/i,
  CREATE: /^\s*CREATE\s+/i,
  DROP: /^\s*DROP\s+/i,
  ALTER: /^\s*ALTER\s+/i,
  MERGE: /^\s*MERGE\s+/i,
  UNKNOWN: /^/,
};

// Read-only query types
const READ_ONLY_TYPES: Set<QueryType> = new Set(['SELECT', 'SHOW', 'DESCRIBE']);

// Write query types
const WRITE_TYPES: Set<QueryType> = new Set([
  'UPDATE',
  'DELETE',
  'INSERT',
  'CREATE',
  'DROP',
  'ALTER',
  'MERGE',
]);

/**
 * Validates SQL queries for security and permission constraints
 */
export class QueryValidator {
  private readonly enableUpdates: boolean;

  constructor(enableUpdates: boolean = false) {
    this.enableUpdates = enableUpdates;
  }

  /**
   * Validates a SQL query based on the current security settings
   * @param sql - SQL query to validate
   * @returns Validation result with query type and any errors
   */
  validate(sql: string): ValidationResult {
    if (!sql || typeof sql !== 'string') {
      return {
        isValid: false,
        queryType: 'UNKNOWN',
        error: 'Query must be a non-empty string',
      };
    }

    const queryType = this.detectQueryType(sql);

    // Check if query type is allowed
    if (!this.enableUpdates && WRITE_TYPES.has(queryType)) {
      return {
        isValid: false,
        queryType,
        error: `${queryType} operations are not allowed. Set enable_updates=true to allow write operations.`,
      };
    }

    // Additional validation for WITH clauses in SELECT queries
    if (queryType === 'SELECT' && sql.match(/^\s*WITH\s+/i)) {
      // Check if the WITH clause contains any write operations
      // We need to extract the CTE content properly, handling nested parentheses
      const withMatch = sql.match(/^\s*WITH\s+(\w+)\s+AS\s*\(/i);
      if (withMatch && withMatch[0]) {
        // Find the matching closing parenthesis for the CTE
        let parenCount = 0;
        let startIdx = withMatch[0].length;
        let endIdx = startIdx;

        for (let i = startIdx; i < sql.length; i++) {
          if (sql[i] === '(') parenCount++;
          else if (sql[i] === ')') {
            if (parenCount === 0) {
              endIdx = i;
              break;
            }
            parenCount--;
          }
        }

        if (endIdx > startIdx) {
          const cteContent = sql.substring(startIdx, endIdx);
          if (this.containsWriteOperations(cteContent)) {
            return {
              isValid: false,
              queryType,
              error: 'WITH clauses containing write operations are not allowed in read-only mode',
            };
          }
        }
      }
    }

    return {
      isValid: true,
      queryType,
    };
  }

  /**
   * Detects the type of SQL query
   */
  private detectQueryType(sql: string): QueryType {
    // Remove single-line comments
    const sqlWithoutComments = sql.replace(/--.*$/gm, '');
    const trimmedSql = sqlWithoutComments.trim();

    for (const [type, pattern] of Object.entries(QUERY_PATTERNS)) {
      if (type !== 'UNKNOWN' && pattern.test(trimmedSql)) {
        return type as QueryType;
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Checks if a SQL fragment contains write operations
   */
  private containsWriteOperations(sql: string): boolean {
    for (const type of WRITE_TYPES) {
      if (QUERY_PATTERNS[type].test(sql)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if a query type is read-only
   * @param queryType - Type of query to check
   * @returns true if the query type is read-only
   */
  isReadOnly(queryType: QueryType): boolean {
    return READ_ONLY_TYPES.has(queryType);
  }

  /**
   * Checks if a query type is a write operation
   * @param queryType - Type of query to check
   * @returns true if the query type is a write operation
   */
  isWriteOperation(queryType: QueryType): boolean {
    return WRITE_TYPES.has(queryType);
  }
}
