# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Run TypeScript directly with tsx (hot reload)
- `npm run build` - Compile TypeScript to dist/
- `npm start` - Run compiled code from dist/

### Testing
- `npm test` - Run all tests
- `npm test -- tests/config.test.ts` - Run specific test file
- `npm test -- --coverage` - Run tests with coverage report

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
4. **Security Layer** (`src/security/`) - Validates SQL queries and maintains audit logs
5. **MCP Tools** (`src/tools/`) - Individual tool implementations for database operations

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

### Information Schema Queries
The MCP tools use specific information_schema queries:
- List databases: `SELECT schema_name FROM td.information_schema.schemata WHERE catalog_name = 'td'`
- List tables: `SELECT table_name FROM td.information_schema.tables WHERE table_catalog = 'td' AND table_schema = ?`
- Describe table: `SELECT column_name, data_type, is_nullable FROM td.information_schema.columns WHERE ...`

### Error Handling
- ConfigurationError for invalid settings
- Trino errors should be caught and wrapped with user-friendly messages
- All errors must mask sensitive data before returning to user

## Current Implementation Status

✅ Completed:
- Project setup with TypeScript strict mode
- Configuration module with 100% test coverage
- NPX packaging configuration

⏳ In Progress:
- Trino client wrapper implementation
- MCP tool implementations
- Security module for query validation

## Testing Requirements

When implementing new features:
1. Add tests to match existing patterns in `tests/`
2. Mock external dependencies (Trino client)
3. Ensure error cases are covered
4. Run `npm test -- --coverage` to verify coverage

## Future Features

Phase 2 will add chat functionality using TD LLM API:
- SSE streaming for responses
- Session management for conversations
- Tool call parsing from agent responses