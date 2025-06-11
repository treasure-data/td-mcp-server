## Goals
- Create an official OSS MCP server for using Treasure Data, so that marketing team can quickly create an AI demo integrated with TD.
- Provide two methods for simplicity
	- query
	- chat

## Key Design Decisions
- **MCP-optimized row limits**: Default to 40 rows per query since MCP is designed for context windows, not bulk data transfer
- **Security by default**: Read-only mode unless explicitly enabled for updates
- **Multi-site support**: Configurable endpoints for all TD regions

## Tech Stack
- TypeScript
- Node.js
- Trino (Presto) API Client https://github.com/trinodb/trino-js-client
- TypeScript MCP server SDK https://github.com/modelcontextprotocol/typescript-sdk
- npx
- GitHub Actions for CI/CD
- Use Claude Code for development

## Details

- query
    - Use [api-presto.treasuredata.com](http://api-presto.treasuredata.com) REST API (Presto/Trino API). This supports listing databases/tables/schema through information_schema catalog
	    - Use X-Trino-User: (TD_API_KEY) header for the authentication. In trino-js-client, setting user = (TD_API_KEY) will automatically set the X-Trino-User header. password can be empty.
	    - User need to set TD_API_KEY in the mcp server configuration
    - Depending on the site, we need to use a different endpoints. us01, jp01, eu01, ap02, ap03
	    - us01: api-presto.treasuredata.com
	    - jp01: api-presto.treasuredata.co.jp
	    - eu01: api-presto.eu01.treasuredata.com
	    - ap02: api-presto.ap02.treasuredata.com
	    - ap03: api-presto.ap03.treasuredata.com
	- catalog name: td
	- list of schemas (databases), list of tables can be retrieved queries against information_schema. This need to be instructed in the MCP function definition
- chat
    - Access to TD LLM API to issue a chat request and get a response.
    - Implement this in the next phase.

## Implementation Plan

### Architecture Overview
- **MCP Server**: TypeScript server using the MCP SDK that exposes Treasure Data functionality as tools
- **Trino Client**: Wrapper around trino-js-client configured for TD endpoints with API key authentication
- **Configuration**: JSON-based server args for API key and site selection
- **Packaging**: NPX-compatible package for easy installation and usage

### Project Structure
```
td-mcp-server/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── config.ts         # Configuration management
│   ├── client/
│   │   ├── trino.ts      # Trino client wrapper
│   │   └── endpoints.ts  # TD site endpoint mappings
│   ├── tools/
│   │   ├── list-databases.ts
│   │   ├── list-tables.ts
│   │   ├── describe-table.ts
│   │   ├── query.ts         # Read-only queries
│   │   └── execute.ts       # Update/modification statements
│   ├── security/
│   │   ├── query-validator.ts  # SQL query validation
│   │   └── audit-logger.ts     # Query audit logging
│   └── types.ts          # TypeScript interfaces
├── tests/
├── package.json
├── tsconfig.json
├── README.md
└── .gitignore
```

### MCP Tools Specification

#### 1. list_databases
- **Description**: List all databases in Treasure Data
- **Parameters**: None
- **Query**: `SELECT schema_name FROM td.information_schema.schemata WHERE catalog_name = 'td' ORDER BY schema_name`
- **Returns**: Array of database names

#### 2. list_tables
- **Description**: List all tables in a specific database
- **Parameters**:
  - `database` (string, required): Database name
- **Query**: `SELECT table_name FROM td.information_schema.tables WHERE table_catalog = 'td' AND table_schema = :database ORDER BY table_name`
- **Returns**: Array of table names

#### 3. describe_table
- **Description**: Get schema information for a table
- **Parameters**:
  - `database` (string, required): Database name
  - `table` (string, required): Table name
- **Query**: `SELECT column_name, data_type, is_nullable FROM td.information_schema.columns WHERE table_catalog = 'td' AND table_schema = :database AND table_name = :table ORDER BY ordinal_position`
- **Returns**: Array of column definitions

#### 4. query
- **Description**: Execute a read-only SQL query on Treasure Data (SELECT, SHOW, DESCRIBE only)
- **Parameters**:
  - `sql` (string, required): SQL query to execute (must be SELECT, SHOW, or DESCRIBE)
  - `database` (string, optional): Default database context
  - `limit` (number, optional): Maximum rows to return (default: 40, max: 10000)
- **Returns**: Query results with schema and data
- **Security**: Only allows SELECT, SHOW, DESCRIBE, and read-only WITH clauses. All other operations are rejected.
- **Row Limiting**:
  - Automatically appends `LIMIT 40` to SELECT queries without an existing LIMIT clause
  - Users can override with the `limit` parameter or include their own LIMIT in the SQL
  - This ensures MCP responses remain manageable and performant

#### 5. execute
- **Description**: Execute update/modification SQL statements on Treasure Data (requires enable_updates configuration)
- **Parameters**:
  - `sql` (string, required): SQL statement to execute (UPDATE, DELETE, INSERT, CREATE, DROP, ALTER)
  - `database` (string, optional): Default database context
- **Returns**: Execution result with affected rows count or success status
- **Security**:
  - Only available when `enable_updates` is set to `true` in configuration
  - Returns an error if called when updates are disabled
  - All operations are audit logged
- **Supported Operations**: UPDATE, DELETE, INSERT, MERGE, CREATE TABLE/DATABASE, DROP TABLE/DATABASE, ALTER TABLE

### Configuration Format
```json
{
  "td_api_key": "YOUR_API_KEY",
  "site": "us01",  // Options: us01, jp01, eu01, ap02, ap03
  "enable_updates": false  // Default: false. Set to true to allow UPDATE/DELETE/INSERT operations
}
```

### Security Features
- **Read-only by default**: The server operates in read-only mode unless explicitly configured otherwise
- **Query validation**: All queries are validated before execution to ensure they comply with the configured permissions
- **Blocked operations when `enable_updates` is false**:
  - UPDATE, DELETE, INSERT, MERGE
  - CREATE TABLE, DROP TABLE, ALTER TABLE
  - CREATE DATABASE, DROP DATABASE
  - Any DDL operations
- **Allowed operations in read-only mode**:
  - SELECT queries
  - SHOW commands
  - DESCRIBE/DESC commands
  - WITH clauses (CTEs) that don't modify data
- **Audit logging**: All queries are logged with timestamps and operation types for security monitoring

### NPX Support and Usage

The MCP server will be distributed as an npm package that can be run directly via npx without installation:

```bash
# Run the server with npx (no installation required)
npx @treasuredata/mcp-server

# Or install globally
npm install -g @treasuredata/mcp-server
```

#### MCP Client Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "treasuredata": {
      "command": "npx",
      "args": ["@treasuredata/mcp-server"],
      "env": {
        "TD_API_KEY": "your_api_key",
        "TD_SITE": "us01",
        "TD_ENABLE_UPDATES": "false"
      }
    }
  }
}
```

### Implementation Phases

#### Phase 1: Core Query Functionality
1. Project setup with TypeScript and MCP SDK
2. Trino client implementation with TD authentication
3. Basic MCP tools for database/table listing and querying
4. Error handling and validation
5. NPX packaging and distribution
6. Publish to npm registry as @treasuredata/mcp-server

#### Phase 2: Enhanced Features (Future)
1. Chat tool integration with TD LLM API
2. Query optimization suggestions
3. Result caching and pagination
4. Advanced schema exploration tools

