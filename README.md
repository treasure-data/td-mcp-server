# Treasure Data MCP Server

MCP (Model Context Protocol) server for Treasure Data, enabling AI assistants to query and interact with Treasure Data through a secure, controlled interface.

## 🚀 Public Preview

This MCP server is currently in a public preview. We're excited for you to try it out and welcome your feedback to help us improve the service.

**Please note:** During this preview period, use of the server is free. However, we plan to introduce a usage-based pricing model in the future, which will be based on the number of queries issued. We will provide ample notice and detailed pricing information before any charges are implemented.

Your feedback during this phase is invaluable and will help us shape the future of this tool. Thank you for being an early adopter!

## Features

- 🔍 Query databases, tables, and schemas through information_schema
- 📊 Execute SQL queries with automatic result limiting for LLM contexts
- 🔒 Security-first design with read-only mode by default
- 🌍 Multi-site support (US, JP, EU, AP regions)
- 🚀 Zero-install execution via npx
- 🎯 CDP (Customer Data Platform) integration for segment and activation management (Experimental)
- 🔄 Workflow monitoring and control - view execution status, logs, and retry failed workflows
- 📝 Comprehensive audit logging for all operations

## Prerequisites

### Node.js Installation

This MCP server requires Node.js version 18.0.0 or higher. If you don't have Node.js installed:

1. **Download Node.js** from [nodejs.org](https://nodejs.org/)
   - Choose the LTS (Long Term Support) version
   - The installer includes `npm` and `npx`

2. **Verify installation** by running:
```bash
node --version  # Should show v18.0.0 or higher
npx --version   # Included with npm 5.2+
```

3. **Alternative installation methods:**
   - **macOS**: `brew install node` (using Homebrew)
   - **Windows**: Use the installer from nodejs.org or `winget install OpenJS.NodeJS`
   - **Linux**: Use your distribution's package manager or [NodeSource repositories](https://github.com/nodesource/distributions)

## Installation

### Using npx (recommended)

No installation needed! Configure your MCP tool to run `@treasuredata/mcp-server` directly via `npx`:

```bash
npx @treasuredata/mcp-server
```

> **What is npx?** npx is a package runner that comes with npm 5.2+. It downloads and runs packages without installing them globally, ensuring you always use the latest version.

### Global installation

If you prefer a traditional installation:

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
- `TD_ENABLE_UPDATES` (optional): Enable write operations (execute tool) - `false` (default), `true`
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
- `database` (string, optional): Database name. If omitted, uses the current database context (TD_DATABASE or last used database)

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
- `database` (string, optional): Database name. If omitted, uses the current database context (TD_DATABASE or last used database)
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
- `sql` (string, required): SQL query to execute
- `limit` (number, optional): Max rows (default: 40, max: 10000)

**Performance Tip:** For tables with a `time` column, use `td_interval()` or `td_time_range()` to limit the time range:
- `td_interval(time, '-30d/now')` - Last 30 days
- `td_interval(time, '-7d/now')` - Last 7 days
- `td_interval(time, '-1d')` - Yesterday only
- `td_interval(time, '-1h/now')` - Last hour
- `td_time_range(time, '2024-01-01', '2024-01-31')` - Specific date range

**Example:**
```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT method, COUNT(*) as count FROM www_access GROUP BY method",
    "limit": 10
  }
}
```

**Example with time range:**
```json
{
  "name": "query",
  "arguments": {
    "sql": "SELECT method, COUNT(*) as count FROM www_access WHERE td_interval(time, '-7d/now') GROUP BY method",
    "limit": 10
  }
}
```

### 5. execute
Execute write operations (UPDATE, INSERT, DELETE, etc.) - requires `TD_ENABLE_UPDATES=true`.

**Parameters:**
- `sql` (string, required): SQL statement to execute

**Example:**
```json
{
  "name": "execute",
  "arguments": {
    "sql": "INSERT INTO events (timestamp, event_type) VALUES (NOW(), 'test')"
  }
}
```

### 6. use_database
Switch the current database context for subsequent queries.

**Parameters:**
- `database` (string, required): Database to switch to

**Example:**
```json
{
  "name": "use_database",
  "arguments": {
    "database": "production_logs"
  }
}
```

After switching, all queries will use the new database by default unless explicitly specified.

### 7. current_database
Get the current database context being used for queries.

**Parameters:**
None

**Example:**
```json
{
  "name": "current_database",
  "arguments": {}
}
```

**Response:**
```json
{
  "currentDatabase": "sample_datasets",
  "description": "The current database context used for queries"
}
```

### CDP Tools (Customer Data Platform) - EXPERIMENTAL

**Note:** CDP tools are currently experimental and may not cover all use cases. Additional functionality will be added based on user feedback.

The following tools are available for interacting with Treasure Data's Customer Data Platform (CDP):

### 8. list_parent_segments
List all parent segments in your CDP account.

**Parameters:**
None

**Example:**
```json
{
  "name": "list_parent_segments",
  "arguments": {}
}
```

### 9. get_parent_segment
Get details of a specific parent segment.

**Parameters:**
- `parent_segment_id` (integer, required): The ID of the parent segment

**Example:**
```json
{
  "name": "get_parent_segment",
  "arguments": {
    "parent_segment_id": 12345
  }
}
```

### 10. list_segments
List all segments under a specific parent segment.

**Parameters:**
- `parent_segment_id` (integer, required): The ID of the parent segment

**Example:**
```json
{
  "name": "list_segments",
  "arguments": {
    "parent_segment_id": 12345
  }
}
```

### 11. list_activations
List all activations (syndications) for a specific segment.

**Parameters:**
- `parent_segment_id` (integer, required): The ID of the parent segment
- `segment_id` (integer, required): The ID of the segment

**Example:**
```json
{
  "name": "list_activations",
  "arguments": {
    "parent_segment_id": 12345,
    "segment_id": 67890
  }
}
```

### 12. get_segment
Get detailed information about a specific segment, including its rules and metadata.

**Parameters:**
- `parent_segment_id` (integer, required): The parent segment ID
- `segment_id` (integer, required): The segment ID

**Example:**
```json
{
  "name": "get_segment",
  "arguments": {
    "parent_segment_id": 287197,
    "segment_id": 1536120
  }
}
```

### 13. parent_segment_sql
Get the SQL statement for a parent segment.

**Parameters:**
- `parent_segment_id` (integer, required): The parent segment ID

**Example:**
```json
{
  "name": "parent_segment_sql",
  "arguments": {
    "parent_segment_id": 287197
  }
}
```

**Response Example:**
```sql
select
  a.*
from "cdp_audience_287197"."customers" a
```

### 14. segment_sql
Get the SQL statement for a segment with filtering conditions applied to the parent segment.

**Parameters:**
- `parent_segment_id` (integer, required): The parent segment ID
- `segment_id` (integer, required): The segment ID

**Example:**
```json
{
  "name": "segment_sql",
  "arguments": {
    "parent_segment_id": 287197,
    "segment_id": 1536120
  }
}
```

**Response Example:**
```sql
select
  a.*
from "cdp_audience_287197"."customers" a
where (
  (position('Male' in a."gender") > 0)
)
```

### Workflow Tools (Experimental) - Monitor and Control Digdag Workflows

> **Note**: These workflow tools are experimental and provide detailed access to workflow sessions, attempts, and tasks. They are subject to change in future releases.

The following tools are available for monitoring and controlling Digdag workflows. These tools integrate with Treasure Data's workflow engine based on [Digdag](https://docs.digdag.io/api/):

### 15. list_projects
List all workflow projects.

**Parameters:**
- `limit` (number, optional): Maximum results (default: 100)
- `last_id` (string, optional): Pagination cursor

**Example:**
```json
{
  "name": "list_projects",
  "arguments": {
    "limit": 50
  }
}
```

### 16. list_workflows
List workflows, optionally filtered by project name.

**Parameters:**
- `project_name` (string, optional): Project name to filter by
- `limit` (number, optional): Maximum results (default: 100)
- `last_id` (string, optional): Pagination cursor

**Examples:**
```json
// List all workflows
{
  "name": "list_workflows",
  "arguments": {
    "limit": 50
  }
}

// List workflows in a specific project
{
  "name": "list_workflows",
  "arguments": {
    "project_name": "my_project",
    "limit": 50
  }
}
```

### 17. list_sessions
List workflow execution sessions with filtering options.

**Parameters:**
- `project_name` (string, optional): Filter by project name
- `workflow_name` (string, optional): Filter by workflow name
- `status` (string, optional): Filter by status (`running`, `success`, `error`, `killed`, `planned`)
- `from_time` (string, optional): Start time (ISO 8601)
- `to_time` (string, optional): End time (ISO 8601)
- `limit` (number, optional): Maximum results (default: 100)
- `last_id` (string, optional): Pagination cursor

**Example:**
```json
{
  "name": "list_sessions",
  "arguments": {
    "status": "error",
    "from_time": "2024-01-01T00:00:00Z",
    "limit": 20
  }
}
```

### 18. get_session_attempts
Get all attempts for a specific session.

**Parameters:**
- `session_id` (string, required): Session ID

**Example:**
```json
{
  "name": "get_session_attempts",
  "arguments": {
    "session_id": "12345"
  }
}
```

### 19. get_attempt_tasks
List all tasks within an attempt with their execution status.

**Parameters:**
- `attempt_id` (string, required): Attempt ID
- `include_subtasks` (boolean, optional): Include subtasks (default: true)

**Example:**
```json
{
  "name": "get_attempt_tasks",
  "arguments": {
    "attempt_id": "67890",
    "include_subtasks": false
  }
}
```

### 20. get_task_logs
Retrieve logs for a specific task within an attempt.

**Parameters:**
- `attempt_id` (string, required): Attempt ID
- `task_name` (string, required): Task name (e.g., "+main+task1")
- `offset` (number, optional): Log offset in bytes
- `limit` (number, optional): Maximum bytes to retrieve (default: 1MB)

**Example:**
```json
{
  "name": "get_task_logs",
  "arguments": {
    "attempt_id": "67890",
    "task_name": "+main+process_data",
    "limit": 5000
  }
}
```

### 21. kill_attempt
Request cancellation of a running attempt.

**Parameters:**
- `attempt_id` (string, required): Attempt ID
- `reason` (string, optional): Reason for cancellation

**Example:**
```json
{
  "name": "kill_attempt",
  "arguments": {
    "attempt_id": "67890",
    "reason": "Stopping for maintenance"
  }
}
```

### 22. retry_session
Retry a session from the beginning or a specific task.

**Parameters:**
- `session_id` (string, required): Session ID
- `from_task` (string, optional): Task name to retry from
- `retry_params` (object, optional): Override parameters for retry

**Example:**
```json
{
  "name": "retry_session",
  "arguments": {
    "session_id": "12345",
    "from_task": "+main+failed_task"
  }
}
```

### 23. retry_attempt
Retry a specific attempt with resume capabilities.

**Parameters:**
- `attempt_id` (string, required): Attempt ID to retry
- `resume_from` (string, optional): Task name to resume from (skip successful tasks)
- `retry_params` (object, optional): Override parameters for retry
- `force` (boolean, optional): Force retry even if attempt is running (default: false)

**Example:**
```json
{
  "name": "retry_attempt",
  "arguments": {
    "attempt_id": "67890",
    "resume_from": "+main+failed_task",
    "retry_params": {
      "batch_size": 1000
    }
  }
}
```

## Security

- **Read-only by default**: Write operations (execute tool) require explicit configuration with `TD_ENABLE_UPDATES=true`
- **Query validation**: All queries are validated before execution
- **Audit logging**: All operations are logged for security monitoring
- **Row limiting**: Automatic LIMIT injection for SELECT queries to prevent large responses
- **Workflow control operations**: kill_attempt, retry_session, and retry_attempt are enabled by default as they are safe operations that don't modify data directly

## Basic Prompt for Using td-mcp-server

When interacting with an AI assistant that has td-mcp-server configured, you can use prompts like these to effectively work with your Treasure Data:

### Initial Setup Prompt
```
You have access to Treasure Data through the td-mcp-server. You can:
- List databases and tables
- Describe table schemas
- Execute SQL queries on the data
- Switch between databases using use_database
- Check current database context using current_database
- Work with CDP segments and activations (experimental)
- Generate SQL queries for CDP audiences and segments
- Monitor and control Digdag workflows
- View workflow execution status and logs
- Retry failed workflows and attempts

Start by listing available databases to understand what data is available.
```

### Common Task Prompts

**Data Exploration:**
```
Please help me explore the data in Treasure Data:
1. First, list all available databases
2. For the database "sample_datasets", show me all tables
3. Describe the schema of the "www_access" table
4. Show me a sample of 5 rows from this table
```

**Data Analysis:**
```
Analyze the web access logs in the www_access table:
1. What are the top 10 most accessed URLs?
2. Show the distribution of HTTP methods used
3. Find the busiest hours of the day (use td_interval for recent data)
4. Identify any potential anomalies or interesting patterns
```

**Time-based Queries:**
```
For the www_access table, analyze the last 7 days of data:
- Use td_interval(time, '-7d/now') in your WHERE clause
- Show daily traffic trends
- Compare weekday vs weekend patterns
- Identify peak usage times
```

**CDP Segment Analysis:**
```
Help me understand my CDP segments:
1. List all parent segments (audiences) available
2. For parent segment ID 287197, show all child segments
3. Get the SQL query that defines this parent segment
4. For segment 1536120, show the SQL with filtering conditions applied
5. Explain what filtering rules are being applied in this segment
```

**Workflow Monitoring:**
```
Help me monitor my Digdag workflows:
1. List all workflow projects available
2. List all workflows in project "my_etl_project"
3. Show me all failed sessions from the last 24 hours
4. For session ID 12345, show all attempts and their status
5. Get the error logs for the failed tasks in attempt 67890
6. Retry the failed session from the task that failed
```

**Workflow Troubleshooting:**
```
I have a failed workflow execution. Please help me:
1. List recent error sessions for project "data_pipeline"
2. For the most recent failed session, show me the attempts
3. List all tasks in the failed attempt and identify which ones failed
4. Show me the error logs for the failed tasks
5. Suggest how to retry this workflow
```

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

### Working with Multiple Databases

**User:** "I need to work with the production_logs database instead of sample_datasets"

**Assistant:** I'll switch to the production_logs database for you.

[Uses use_database tool]

Now switched to production_logs database. All subsequent queries will use this database by default unless you specify otherwise.

### Complex Analysis Example

**User:** "Can you analyze user behavior patterns in our access logs for the past month?"

**Assistant:** I'll analyze the user behavior patterns from your access logs. Let me break this down into several queries:

1. First, let me check the table structure:
[Describes table to understand available columns]

2. Now I'll analyze the overall traffic pattern for the past month:
```sql
SELECT
  DATE(time) as date,
  COUNT(*) as daily_requests,
  COUNT(DISTINCT host) as unique_visitors
FROM www_access
WHERE td_interval(time, '-30d/now')
GROUP BY DATE(time)
ORDER BY date
```

3. Let me identify the most popular pages:
```sql
SELECT
  path,
  COUNT(*) as visits,
  COUNT(DISTINCT host) as unique_visitors
FROM www_access
WHERE td_interval(time, '-30d/now')
GROUP BY path
ORDER BY visits DESC
LIMIT 20
```

[Continues with analysis and insights...]

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

Apache License 2.0

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For issues and feature requests, please visit: https://github.com/treasure-data/td-mcp-server/issues