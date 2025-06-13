# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Run TypeScript directly with tsx (hot reload)
- `npm run build` - Compile TypeScript to dist/
- `npm start` - Run compiled code from dist/

### Testing
- `npm test` - Run all tests with Vitest
- `npm test tests/config.test.ts` - Run specific test file
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run only unit tests (excludes integration)
- `npm run test:integration` - Run integration tests (requires TD_API_KEY_DEVELOPMENT_AWS)

### Code Quality
- `npm run lint` - Check ESLint rules
- `npm run format` - Auto-format with Prettier
- `npm run typecheck` - Type-check without building

## Architecture Overview

This is an MCP (Model Context Protocol) server that exposes Treasure Data functionality to AI assistants. The architecture follows a security-first, modular design:

### Core Components

1. **MCP Server** (`src/index.ts`) - Entry point that registers tools with the MCP SDK
2. **Configuration** (`src/config.ts`) - Validates and manages all server settings with environment variable support
3. **Trino Client** (`src/client/`) - Wraps trino-client for TD-specific authentication using X-Trino-User header
4. **CDP Client** (`src/client/cdp/`) - HTTP client for TD Customer Data Platform API using TD1 authentication
5. **Security Layer** (`src/security/`) - Validates SQL queries and maintains audit logs
6. **MCP Tools** (`src/tools/`) - Individual tool implementations for database operations
7. **CDP Tools** (`src/tools/cdp/`) - Tools for interacting with CDP segments and activations

### Key Design Patterns

1. **Read-Only by Default**: The `query` tool only allows SELECT/SHOW/DESCRIBE. Write operations require explicit `enable_updates=true` and use the separate `execute` tool.

2. **Automatic LIMIT Injection**: SELECT queries without LIMIT get `LIMIT 40` appended automatically, optimized for LLM context windows.

3. **Multi-Site Architecture**: Each TD region (us01, jp01, eu01, ap02, ap03, dev) has different Presto endpoints configured in `src/client/endpoints.ts`.

4. **Configuration Validation**: All config is validated on startup with descriptive errors. API keys are masked in logs using `maskApiKey()`.

## Critical Implementation Details

### Authentication
- TD API key goes in the X-Trino-User header (trino-client sets this via `user` property)
- No password needed for Trino connection
- Catalog name is always 'td'
- For integration tests, use TD_API_KEY_DEVELOPMENT_AWS with site: 'dev'

### Information Schema Queries
The MCP tools use specific information_schema queries:
- List databases: `SELECT schema_name FROM td.information_schema.schemata WHERE catalog_name = 'td'`
- List tables: `SELECT table_name FROM td.information_schema.tables WHERE table_catalog = 'td' AND table_schema = ?`
- Describe table: `SELECT column_name, data_type, is_nullable FROM td.information_schema.columns WHERE ...`

### Error Handling
- ConfigurationError for invalid settings
- Trino errors should be caught and wrapped with user-friendly messages
- All errors must mask sensitive data before returning to user

### CDP Integration (Experimental)
The CDP (Customer Data Platform) integration is currently experimental and provides basic access to segments and activations:
- **Authentication**: Uses the same TD API key with `TD1` prefix in Authorization header
- **Endpoints**: CDP endpoints follow the same site pattern (e.g., `api-cdp.treasuredata.com` for us01)
- **Response Format**: CDP API returns JSON:API formatted responses that need special handling
- **Tools Available**:
  - `list_parent_segments`: Lists all parent segments
  - `get_parent_segment`: Gets details of a specific parent segment
  - `list_segments`: Lists segments under a parent
  - `list_activations`: Lists activations (syndications) for a segment
  - `get_segment`: Gets detailed information about a specific segment (requires audience_id and segment_id)
  - `audience_sql`: Gets the base SQL statement for an audience (parent segment)
  - `segment_sql`: Gets the SQL statement for a segment with filtering conditions applied (requires audience_id and segment_id)
- **Note**: Current implementation is read-only. Write operations (create/update/delete segments) and other advanced features are not yet implemented.

## Testing Requirements

When implementing new features:
1. Add tests to match existing patterns in `tests/`
2. Mock external dependencies (Trino client) using `vi.mock()`
3. Ensure error cases are covered
4. Run `npm run test:coverage` to verify coverage
5. Use Vitest's `describe`, `it`, `expect`, `beforeEach`, `vi` imports
6. For MCP tools requiring API access, add an integration test

## Git Workflow
- use squash commits for merging pr
- for release, create a new pr and after merging it, add a release tag
- Release notes will be generated upon pushing a new release tag