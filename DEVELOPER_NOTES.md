# Developer Notes

## Testing with GitHub Copilot Chat Agent Mode

This MCP server can be tested with GitHub Copilot Chat's agent mode. Here's how to set it up and test it:

### Prerequisites

1. Ensure you have GitHub Copilot Chat installed in VS Code
2. Build the MCP server:
   ```bash
   npm run build
   ```

### Configuration

1. Add the TD MCP server to your VS Code settings. Open VS Code settings (JSON) and add:

   ```json
   {
     "github.copilot.chat.agentExtensions": {
       "td": {
         "command": "node",
         "args": ["/path/to/td-mcp-server/dist/index.js"],
         "env": {
           "TD_API_KEY": "your-td-api-key-here",
           "TD_SITE": "dev"  // or us01, jp01, eu01, ap02, ap03
         }
       }
     }
   }
   ```

   Replace `/path/to/td-mcp-server` with the actual path to this project.

2. Alternatively, for development testing, you can use the TypeScript source directly:

   ```json
   {
     "github.copilot.chat.agentExtensions": {
       "td": {
         "command": "npx",
         "args": ["tsx", "/path/to/td-mcp-server/src/index.ts"],
         "env": {
           "TD_API_KEY": "your-td-api-key-here",
           "TD_SITE": "dev"
         }
       }
     }
   }
   ```

### Testing the Agent

1. Open GitHub Copilot Chat in VS Code
2. Use the `@td` agent to interact with Treasure Data:

   ```
   @td list all databases
   ```

   ```
   @td show tables in sample_datasets
   ```

   ```
   @td describe the www_access table in sample_datasets
   ```

   ```
   @td query sample_datasets: SELECT COUNT(*) FROM www_access
   ```

### Available Commands

The MCP server exposes these tools that can be invoked through natural language:

1. **list_databases** - Lists all available databases
   - Example: "@td show me all databases"

2. **list_tables** - Lists tables in a specific database
   - Example: "@td what tables are in sample_datasets?"

3. **describe_table** - Shows column information for a table
   - Example: "@td describe the schema of nasdaq table in sample_datasets"

4. **query** - Executes read-only SQL queries (SELECT, SHOW, DESCRIBE)
   - Example: "@td run this query in sample_datasets: SELECT symbol, COUNT(*) as count FROM nasdaq GROUP BY symbol ORDER BY count DESC LIMIT 10"
   - Note: Queries are automatically limited to 40 rows by default

5. **execute** - Executes write operations (UPDATE, DELETE, INSERT, etc.)
   - Only available when `TD_ENABLE_UPDATES=true` is set
   - Example: "@td execute in mydb: INSERT INTO logs VALUES (...)"

### Debugging

1. Enable console logging to see what's happening:
   ```json
   "env": {
     "TD_API_KEY": "your-td-api-key-here",
     "TD_SITE": "dev",
     "TD_MCP_LOG_TO_CONSOLE": "true"
   }
   ```

2. Check VS Code's Output panel and select "GitHub Copilot Chat" to see logs

3. Common issues:
   - **Authentication errors**: Verify your TD_API_KEY is correct
   - **Connection errors**: Check your TD_SITE setting
   - **Permission errors**: Ensure your API key has access to the requested databases
   - **Empty results**: The table or database might not exist

### Security Notes

- By default, only read operations are allowed
- To enable write operations, set `TD_ENABLE_UPDATES=true` in the environment
- All queries are logged with the audit logger
- Be careful with your API key - don't commit it to version control

### Development Tips

1. For rapid development, use the tsx runner directly:
   ```bash
   TD_API_KEY=your-key npx tsx src/index.ts
   ```

2. Run tests before committing:
   ```bash
   npm test
   ```

3. Run integration tests against the dev environment:
   ```bash
   TD_API_KEY_DEVELOPMENT_AWS=your-dev-key npm run test:integration
   ```

4. The server implements proper error handling and graceful shutdown, so you can safely Ctrl+C to stop it during testing.