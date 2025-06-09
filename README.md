# Treasure Data MCP Server

MCP (Model Context Protocol) server for Treasure Data, enabling AI assistants to query and interact with Treasure Data through a secure, controlled interface.

## Features

- 🔍 Query databases, tables, and schemas through information_schema
- 📊 Execute SQL queries with automatic result limiting for LLM contexts
- 🔒 Security-first design with read-only mode by default
- 🌍 Multi-site support (US, JP, EU, AP regions)
- 🚀 Zero-install execution via npx

## Installation

### Using npx (recommended)

```bash
npx @treasuredata/mcp-server
```

### Global installation

```bash
npm install -g @treasuredata/mcp-server
```

## Configuration

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
        "TD_ENABLE_UPDATES": "false",
        "TD_DATABASE": "sample_datasets"
      }
    }
  }
}
```

### Configuration Options

- `TD_API_KEY` (required): Your Treasure Data API key
- `TD_SITE` (optional): Region endpoint - `us01` (default), `jp01`, `eu01`, `ap02`, `ap03`, `dev`
- `TD_ENABLE_UPDATES` (optional): Enable write operations - `false` (default), `true`
- `TD_DATABASE` (optional): Default database for queries (e.g., `sample_datasets`)

## Available Tools

### 1. list_databases
List all databases in your Treasure Data account.

**Example:**
```json
{
  "name": "list_databases",
  "arguments": {}
}
```

### 2. list_tables
List all tables in a specific database.

**Parameters:**
- `database` (string, required): Database name

**Example:**
```json
{
  "name": "list_tables",
  "arguments": {
    "database": "sample_datasets"
  }
}
```

**With default database configured:**
```json
{
  "name": "list_tables",
  "arguments": {}
}
```

### 3. describe_table
Get schema information for a specific table.

**Parameters:**
- `database` (string, required): Database name
- `table` (string, required): Table name

**Example:**
```json
{
  "name": "describe_table",
  "arguments": {
    "database": "sample_datasets",
    "table": "www_access"
  }
}
```

**With default database configured:**
```json
{
  "name": "describe_table",
  "arguments": {
    "table": "www_access"
  }
}
```

### 4. query
Execute read-only SQL queries (SELECT, SHOW, DESCRIBE).

**Parameters:**
- `database` (string, required): Database to query
- `sql` (string, required): SQL query to execute
- `limit` (number, optional): Max rows (default: 40, max: 10000)

**Example:**
```json
{
  "name": "query",
  "arguments": {
    "database": "sample_datasets",
    "sql": "SELECT method, COUNT(*) as count FROM www_access GROUP BY method",
    "limit": 10
  }
}
```

**With default database configured:**
```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT method, COUNT(*) as count FROM www_access GROUP BY method",
    "limit": 10
  }
}
```

### 5. execute
Execute write operations (UPDATE, INSERT, DELETE, etc.) - requires `TD_ENABLE_UPDATES=true`.

**Parameters:**
- `database` (string, required): Database to execute against
- `sql` (string, required): SQL statement to execute

**Example:**
```json
{
  "name": "execute",
  "arguments": {
    "database": "my_database",
    "sql": "INSERT INTO events (timestamp, event_type) VALUES (NOW(), 'test')"
  }
}
```

## Security

- **Read-only by default**: Write operations require explicit configuration
- **Query validation**: All queries are validated before execution
- **Audit logging**: All operations are logged for security monitoring
- **Row limiting**: Automatic LIMIT injection for SELECT queries to prevent large responses

## Usage Examples

### With Claude Desktop

1. Ask Claude to analyze your data:
   ```
   Can you show me what databases I have access to in Treasure Data?
   ```

2. Query specific data:
   ```
   Show me the top 10 most frequent HTTP methods in the www_access table
   ```

3. Get table schemas:
   ```
   What columns are in the nasdaq table in sample_datasets?
   ```

### Example Conversations

**User:** "What's the total number of records in the www_access table?"

**Assistant:** I'll query the www_access table to get the total record count.

```sql
SELECT COUNT(*) as total_records FROM www_access
```

[Executes query and returns results]

The www_access table contains 5,000 total records.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run integration tests (requires TD_API_KEY_DEVELOPMENT_AWS)
npm run test:integration

# Development mode
npm run dev
```

### Example Configurations

See the `examples/` directory for sample configurations:
- `claude-desktop-config.json` - Basic Claude Desktop setup
- `development-config.json` - Local development with logging
- `multi-region-config.json` - Multi-region setup

## Developer Notes

For information on testing this MCP server with GitHub Copilot Chat agent mode, see [DEVELOPER_NOTES.md](DEVELOPER_NOTES.md).

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues and feature requests, please visit: https://github.com/treasure-data/td-mcp-server/issues