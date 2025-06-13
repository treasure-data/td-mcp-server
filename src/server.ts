import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config';
import { TDTrinoClient } from './client/trino';
import { QueryValidator } from './security/query-validator';
import { AuditLogger } from './security/audit-logger';
import { ListDatabasesTool } from './tools/list-databases';
import { ListTablesTool } from './tools/list-tables';
import { DescribeTableTool } from './tools/describe-table';
import { QueryTool } from './tools/query';
import { ExecuteTool } from './tools/execute';
import { 
  listParentSegmentsTool,
  getParentSegmentTool,
  listSegmentsTool,
  listActivationsTool,
  audienceSql,
  segmentSql,
  getSegment
} from './tools/cdp';

/**
 * Treasure Data MCP Server implementation
 * Provides tools for querying and managing Treasure Data through the Model Context Protocol
 */
export class TDMcpServer {
  private server: Server;
  private trinoClient: TDTrinoClient | null = null;
  private currentDatabase: string;
  private queryValidator: QueryValidator;
  private auditLogger: AuditLogger;
  private config: ReturnType<typeof loadConfig>;

  constructor() {
    this.server = new Server(
      {
        name: 'td-mcp-server',
        version: '0.2.2',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Load configuration
    this.config = loadConfig();
    
    // Initialize current database
    this.currentDatabase = this.config.database || 'information_schema';
    
    // Initialize security components
    this.queryValidator = new QueryValidator(this.config.enable_updates);
    this.auditLogger = new AuditLogger({ 
      logToConsole: process.env.TD_MCP_LOG_TO_CONSOLE === 'true' 
    });

    this.setupHandlers();
  }

  private async ensureClient(): Promise<TDTrinoClient> {
    if (!this.trinoClient) {
      this.trinoClient = new TDTrinoClient({
        ...this.config,
        database: this.currentDatabase
      });
    }
    return this.trinoClient;
  }

  /**
   * Switch to a different database context
   * @param database The database to switch to
   */
  async switchDatabase(database: string): Promise<void> {
    // Create new client with new database
    const newClient = new TDTrinoClient({
      ...this.config,
      database: database
    });

    // Test connection with new client
    const connected = await newClient.testConnection();
    if (!connected) {
      throw new Error(`Failed to connect with database '${database}'`);
    }

    // Replace the client and update current database
    const oldClient = this.trinoClient;
    this.trinoClient = newClient;
    this.currentDatabase = database;

    // Clean up old client
    if (oldClient) {
      oldClient.destroy();
    }
  }

  /**
   * Get the current database context
   */
  getCurrentDatabase(): string {
    return this.currentDatabase;
  }

  /**
   * Get the Trino client instance
   */
  getClient(): TDTrinoClient {
    if (!this.trinoClient) {
      throw new Error('Client not initialized');
    }
    return this.trinoClient;
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_databases',
          description: 'List all available databases in Treasure Data',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_tables',
          description: 'List all tables in a specific database',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: `The database name (optional if TD_DATABASE is configured)`,
              },
            },
            required: [],
          },
        },
        {
          name: 'describe_table',
          description: 'Get column information for a specific table',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: 'The database name (optional if TD_DATABASE is configured)',
              },
              table: {
                type: 'string',
                description: 'The table name',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'query',
          description: 'Execute a read-only SQL query (SELECT, SHOW, DESCRIBE) using Trino SQL dialect with Treasure Data UDFs. For better performance on large tables, use td_interval(time, \'-30d/now\') to limit the time range.',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SQL query to execute using Trino SQL dialect. Supports Treasure Data UDFs like td_interval() and td_time_range(). For tables with time column, consider using these UDFs in WHERE clause to improve performance. Examples: td_interval(time, \'-30d/now\') for last 30 days, td_interval(time, \'-7d/now\') for last 7 days, td_interval(time, \'-1d\') for yesterday, td_interval(time, \'-1h/now\') for last hour, td_time_range(time, \'2024-01-01\', \'2024-01-31\') for specific date range.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of rows to return (default: 40)',
                minimum: 1,
                maximum: 10000,
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'execute',
          description: 'Execute write operations (UPDATE, DELETE, INSERT, etc.) when enable_updates=true',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SQL statement to execute',
              },
            },
            required: ['sql'],
          },
        },
        {
          name: 'use_database',
          description: 'Switch the current database context for subsequent queries',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: 'The database to switch to',
              },
            },
            required: ['database'],
          },
        },
        {
          name: 'current_database',
          description: 'Get the current database context being used for queries',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        // CDP Tools
        {
          name: listParentSegmentsTool.name,
          description: listParentSegmentsTool.description,
          inputSchema: listParentSegmentsTool.schema.input,
        },
        {
          name: getParentSegmentTool.name,
          description: getParentSegmentTool.description,
          inputSchema: getParentSegmentTool.schema.input,
        },
        {
          name: listSegmentsTool.name,
          description: listSegmentsTool.description,
          inputSchema: listSegmentsTool.schema.input,
        },
        {
          name: listActivationsTool.name,
          description: listActivationsTool.description,
          inputSchema: listActivationsTool.schema.input,
        },
        {
          name: audienceSql.name,
          description: audienceSql.description,
          inputSchema: audienceSql.inputSchema,
        },
        {
          name: segmentSql.name,
          description: segmentSql.description,
          inputSchema: segmentSql.inputSchema,
        },
        {
          name: getSegment.name,
          description: getSegment.description,
          inputSchema: getSegment.inputSchema,
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const client = await this.ensureClient();

        switch (name) {
          case 'list_databases': {
            const tool = new ListDatabasesTool(client, this.auditLogger);
            const result = await tool.execute();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'list_tables': {
            const database = (args?.database as string | undefined) || this.currentDatabase;
            const tool = new ListTablesTool(client, this.auditLogger);
            const result = await tool.execute(database);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'describe_table': {
            const database = (args?.database as string | undefined) || this.currentDatabase;
            if (!args || typeof args.table !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Table parameter is required'
              );
            }
            const tool = new DescribeTableTool(client, this.auditLogger);
            const result = await tool.execute(database, args.table);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'query': {
            if (!args || typeof args.sql !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'SQL parameter is required'
              );
            }
            const limit = typeof args.limit === 'number' ? args.limit : 40;
            const tool = new QueryTool(client, this.auditLogger, this.queryValidator);
            const result = await tool.execute(args.sql, limit);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'execute': {
            if (!args || typeof args.sql !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'SQL parameter is required'
              );
            }
            const tool = new ExecuteTool(
              client,
              this.auditLogger,
              this.queryValidator,
              this.config.enable_updates || false
            );
            const result = await tool.execute(args.sql);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'use_database': {
            if (!args || typeof args.database !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Database parameter is required'
              );
            }
            
            const previousDatabase = this.currentDatabase;
            try {
              await this.switchDatabase(args.database);
              
              // Note: Audit logging for use_database could be added here
              // if AuditLogger is extended to support non-query operations
              
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: true,
                      message: `Switched database from '${previousDatabase}' to '${args.database}'`,
                      previousDatabase,
                      currentDatabase: args.database,
                    }, null, 2),
                  },
                ],
              };
            } catch (error) {
              // Note: Audit logging for failures could be added here
              throw error;
            }
          }

          case 'current_database': {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    currentDatabase: this.currentDatabase,
                    description: 'The current database context used for queries'
                  }, null, 2),
                },
              ],
            };
          }

          // CDP Tools
          case listParentSegmentsTool.name: {
            const result = await listParentSegmentsTool.handler(args || {}, {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case getParentSegmentTool.name: {
            const result = await getParentSegmentTool.handler(args || {}, {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case listSegmentsTool.name: {
            const result = await listSegmentsTool.handler(args || {}, {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case listActivationsTool.name: {
            const result = await listActivationsTool.handler(args || {}, {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case audienceSql.name: {
            const result = await audienceSql.execute(args as any || {});
            return result;
          }

          case segmentSql.name: {
            const result = await segmentSql.execute(args as any || {});
            return result;
          }

          case getSegment.name: {
            const result = await getSegment.execute(args as any || {});
            return result;
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Tool execution error: ${errorMessage}`);
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  private setupErrorHandling(): void {
    process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  private async shutdown(): Promise<void> {
    if (this.trinoClient) {
      // Log final statistics
      const stats = this.auditLogger.getStats();
      console.error('Session statistics:', stats);
    }
  }

  /**
   * Starts the MCP server and begins listening for requests
   * @throws {Error} If server fails to start
   */
  async run(): Promise<void> {
    this.setupErrorHandling();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TD MCP Server started');
  }
}