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
        "TD_ENABLE_UPDATES": "false"
      }
    }
  }
}
```

### Configuration Options

- `TD_API_KEY` (required): Your Treasure Data API key
- `TD_SITE` (optional): Region endpoint - `us01` (default), `jp01`, `eu01`, `ap02`, `ap03`, `dev`
- `TD_ENABLE_UPDATES` (optional): Enable write operations - `false` (default), `true`

## Available Tools

### 1. list_databases
List all databases in your Treasure Data account.

### 2. list_tables
List all tables in a specific database.
- Parameters: `database` (string)

### 3. describe_table
Get schema information for a specific table.
- Parameters: `database` (string), `table` (string)

### 4. query
Execute read-only SQL queries (SELECT, SHOW, DESCRIBE).
- Parameters: 
  - `sql` (string): SQL query
  - `database` (string, optional): Default database
  - `limit` (number, optional): Max rows (default: 40, max: 10000)

### 5. execute
Execute write operations (UPDATE, INSERT, DELETE, etc.) - requires `TD_ENABLE_UPDATES=true`.
- Parameters:
  - `sql` (string): SQL statement
  - `database` (string, optional): Default database

## Security

- **Read-only by default**: Write operations require explicit configuration
- **Query validation**: All queries are validated before execution
- **Audit logging**: All operations are logged for security monitoring
- **Row limiting**: Automatic LIMIT injection for SELECT queries to prevent large responses

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Developer Notes

For information on testing this MCP server with GitHub Copilot Chat agent mode, see [DEVELOPER_NOTES.md](DEVELOPER_NOTES.md).

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues and feature requests, please visit: https://github.com/treasure-data/td-mcp-server/issues