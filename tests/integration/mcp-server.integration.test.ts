import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe.skip('TD MCP Server Integration Tests', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  
  const TD_API_KEY = process.env.TD_API_KEY_DEVELOPMENT_AWS;
  
  beforeAll(async () => {
    if (!TD_API_KEY) {
      throw new Error('TD_API_KEY_DEVELOPMENT_AWS environment variable is required for integration tests');
    }

    // Start the MCP server
    serverProcess = spawn('node', ['dist/index.js'], {
      env: {
        ...process.env,
        TD_API_KEY,
        TD_SITE: 'dev',
        TD_ENABLE_UPDATES: 'false',
      },
    });

    // Create MCP client
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      env: {
        TD_API_KEY,
        TD_SITE: 'dev',
        TD_ENABLE_UPDATES: 'false',
      },
    });

    client = new Client({
      name: 'td-mcp-test-client',
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    await client.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should list available tools', async () => {
    const tools = await client.listTools();
    
    expect(tools.tools).toHaveLength(5);
    const toolNames = tools.tools.map(t => t.name);
    expect(toolNames).toContain('list_databases');
    expect(toolNames).toContain('list_tables');
    expect(toolNames).toContain('describe_table');
    expect(toolNames).toContain('query');
    expect(toolNames).toContain('execute');
  });

  it('should list databases', async () => {
    const result = await client.callTool({
      name: 'list_databases',
      arguments: {},
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    
    const data = JSON.parse(result.content[0].text);
    expect(data.databases).toBeInstanceOf(Array);
    expect(data.databases).toContain('sample_datasets');
  });

  it('should list tables in sample_datasets', async () => {
    const result = await client.callTool({
      name: 'list_tables',
      arguments: { database: 'sample_datasets' },
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.tables).toBeInstanceOf(Array);
    expect(data.tables).toContain('www_access');
    expect(data.tables).toContain('nasdaq');
  });

  it('should describe a table', async () => {
    const result = await client.callTool({
      name: 'describe_table',
      arguments: { 
        database: 'sample_datasets',
        table: 'www_access'
      },
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.columns).toBeInstanceOf(Array);
    expect(data.columns.length).toBeGreaterThan(0);
    
    const columnNames = data.columns.map((c: any) => c.column_name);
    expect(columnNames).toContain('time');
    expect(columnNames).toContain('method');
    expect(columnNames).toContain('path');
  });

  it('should execute a query', async () => {
    const result = await client.callTool({
      name: 'query',
      arguments: { 
        database: 'sample_datasets',
        sql: 'SELECT COUNT(*) as count FROM www_access',
        limit: 1
      },
    });

    const data = JSON.parse(result.content[0].text);
    expect(data.columns).toHaveLength(1);
    expect(data.columns[0].name).toBe('count');
    expect(data.rows).toHaveLength(1);
    expect(data.rowCount).toBe(1);
    expect(data.truncated).toBe(false);
  });

  it('should reject write operations by default', async () => {
    await expect(
      client.callTool({
        name: 'execute',
        arguments: { 
          database: 'sample_datasets',
          sql: 'DELETE FROM www_access WHERE 1=1'
        },
      })
    ).rejects.toThrow();
  });

  it('should handle invalid tool calls', async () => {
    await expect(
      client.callTool({
        name: 'nonexistent_tool',
        arguments: {},
      })
    ).rejects.toThrow();
  });

  it('should handle missing required parameters', async () => {
    await expect(
      client.callTool({
        name: 'list_tables',
        arguments: {}, // Missing database parameter
      })
    ).rejects.toThrow();
  });
});