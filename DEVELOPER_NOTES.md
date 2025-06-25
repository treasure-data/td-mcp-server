# Developer Notes

## Testing with VS Code MCP Servers

This MCP server can be tested with VS Code's MCP support. Here's how to set it up and test it:

### Prerequisites

1. Ensure you have VS Code with MCP support
2. Build the MCP server:
   ```bash
   npm run build
   ```

### Configuration

1. Add the TD MCP server to your VS Code settings. Open VS Code settings (JSON) and add:

   ```json
   {
     "mcp": {
       "servers": {
         "td": {
           "type": "stdio",
           "command": "node",
           "args": ["/path/to/td-mcp-server/dist/index.js"],
           "env": {
             "TD_API_KEY": "your-td-api-key-here",
             "TD_SITE": "dev",  // or us01, jp01, eu01, ap02, ap03
             "TD_DATABASE": "sample_datasets"  // optional
           }
         }
       }
     }
   }
   ```

   Replace `/path/to/td-mcp-server` with the actual path to this project.

   For the published package, you can use npx directly:

   ```json
   {
     "mcp": {
       "servers": {
         "td": {
           "type": "stdio",
           "command": "npx",
           "args": ["@treasuredata/mcp-server"],
           "env": {
             "TD_API_KEY": "your-td-api-key-here",
             "TD_SITE": "us01",  // or jp01, eu01, ap02, ap03
             "TD_DATABASE": "sample_datasets"  // optional
           }
         }
       }
     }
   }
   ```

2. Alternatively, for development testing, you can use the TypeScript source directly:

   ```json
   {
     "mcp": {
       "servers": {
         "td": {
           "type": "stdio",
           "command": "npx",
           "args": ["tsx", "/path/to/td-mcp-server/src/index.ts"],
           "env": {
             "TD_API_KEY": "your-td-api-key-here",
             "TD_SITE": "dev",
             "TD_DATABASE": "sample_datasets"  // optional
           }
         }
       }
     }
   }
   ```

### Testing the MCP Server

1. Open VS Code
2. Use the `@td` prefix to interact with Treasure Data via the MCP server:

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

1. Check VS Code's Output panel to see logs

2. Common issues:
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

## Release Process

This project uses GitHub Actions for automated releases. Follow these steps to create a new release:

### 1. Determine Version Number

Follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes and dependency updates

### 2. Create Release

1. **Update version in package.json**:
   ```bash
   # Create a new branch
   git checkout -b release-vX.Y.Z
   
   # Update version in package.json
   npm version patch  # or minor/major
   ```

2. **Create and merge release PR**:
   ```bash
   # Commit the version change
   git add package.json
   git commit -m "Release vX.Y.Z"
   
   # Push branch and create PR
   git push origin release-vX.Y.Z
   gh pr create --title "Release vX.Y.Z" --body "Bump version to X.Y.Z"
   
   # After review, merge the PR (using squash merge)
   gh pr merge --squash
   ```

3. **Create and push release tag**:
   ```bash
   # Switch back to main and pull latest
   git checkout main
   git pull origin main
   
   # Create and push tag
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

### 3. Automated Release

Once the tag is pushed:
- GitHub Actions workflow (`.github/workflows/release.yml`) automatically triggers
- Creates a GitHub release with auto-generated release notes
- Release notes include all PRs merged since the last release

### 4. Verify Release

1. Check the [Actions tab](https://github.com/treasure-data/td-mcp-server/actions) for workflow status
2. Once complete, view the release at [Releases page](https://github.com/treasure-data/td-mcp-server/releases)
3. Release notes will include all merged PRs with their titles

### Release Guidelines

- Use descriptive PR titles as they become release notes
- All PRs should be squash-merged to keep history clean
- Tag format must be `vX.Y.Z` to trigger the workflow
- The release workflow only runs on tags, not on branch pushes