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

export class TDMcpServer {
  private server: Server;
  private trinoClient: TDTrinoClient | null = null;
  private queryValidator: QueryValidator;
  private auditLogger: AuditLogger;
  private config: ReturnType<typeof loadConfig>;

  constructor() {
    this.server = new Server(
      {
        name: 'td-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Load configuration
    this.config = loadConfig();
    
    // Initialize security components
    this.queryValidator = new QueryValidator(this.config.enable_updates);
    this.auditLogger = new AuditLogger({ 
      logToConsole: process.env.TD_MCP_LOG_TO_CONSOLE === 'true' 
    });

    this.setupHandlers();
  }

  private async ensureClient(): Promise<TDTrinoClient> {
    if (!this.trinoClient) {
      this.trinoClient = new TDTrinoClient(this.config);
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
                description: 'The database name',
              },
            },
            required: ['database'],
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
                description: 'The database name',
              },
              table: {
                type: 'string',
                description: 'The table name',
              },
            },
            required: ['database', 'table'],
          },
        },
        {
          name: 'query',
          description: 'Execute a read-only SQL query (SELECT, SHOW, DESCRIBE)',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: 'The database to query',
              },
              sql: {
                type: 'string',
                description: 'The SQL query to execute',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of rows to return (default: 40)',
                minimum: 1,
                maximum: 10000,
              },
            },
            required: ['database', 'sql'],
          },
        },
        {
          name: 'execute',
          description: 'Execute write operations (UPDATE, DELETE, INSERT, etc.) when enable_updates=true',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: 'The database to execute against',
              },
              sql: {
                type: 'string',
                description: 'The SQL statement to execute',
              },
            },
            required: ['database', 'sql'],
          },
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
            if (!args || typeof args.database !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Database parameter is required'
              );
            }
            const tool = new ListTablesTool(client, this.auditLogger);
            const result = await tool.execute(args.database);
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
            if (!args || typeof args.database !== 'string' || typeof args.table !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Database and table parameters are required'
              );
            }
            const tool = new DescribeTableTool(client, this.auditLogger);
            const result = await tool.execute(args.database, args.table);
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
            if (!args || typeof args.database !== 'string' || typeof args.sql !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Database and sql parameters are required'
              );
            }
            const limit = typeof args.limit === 'number' ? args.limit : 40;
            const tool = new QueryTool(client, this.auditLogger, this.queryValidator);
            const result = await tool.execute(args.database, args.sql, limit);
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
            if (!args || typeof args.database !== 'string' || typeof args.sql !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Database and sql parameters are required'
              );
            }
            const tool = new ExecuteTool(
              client,
              this.auditLogger,
              this.queryValidator,
              this.config.enable_updates || false
            );
            const result = await tool.execute(args.database, args.sql);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
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

  async run(): Promise<void> {
    this.setupErrorHandling();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TD MCP Server started');
  }
}