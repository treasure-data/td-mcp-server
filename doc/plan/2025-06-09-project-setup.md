# Treasure Data MCP Server - Project Setup Plan

## Overview
This document outlines the step-by-step implementation plan for setting up the Treasure Data MCP Server project.

## Progress Summary
- **Phase 1.1**: ✅ Completed (2025-06-09)
  - Project initialization with TypeScript, ESLint, Prettier, and ~~Jest~~ Vitest
  - Created project structure and configuration files
  - Installed all core and development dependencies
- **Phase 1.2**: ✅ Completed (2025-06-09)
  - Configuration module with full validation
  - Environment variable and args support
  - Security features (API key masking)
  - 100% test coverage
- **Phase 1.3**: ✅ Completed (2025-06-09)
  - Trino client wrapper with TD authentication
  - Site-specific endpoint configuration
  - Query execution with error handling
  - Utility methods for database operations
  - Comprehensive unit tests with mocked client

## Phase 1: Core Implementation

### 1. Project Initialization
- [x] Initialize npm project with TypeScript
- [x] Install core dependencies:
  - `@modelcontextprotocol/sdk`
  - `trino-client` (Trino JS client)
  - `typescript`, `@types/node`
  - Development tools: `prettier`, `eslint`, `jest`
- [x] Configure TypeScript with strict mode
- [x] Set up ESLint and Prettier
- [x] Create initial project structure

### 2. Configuration Module
- [x] Create `src/config.ts` for configuration management
- [x] Define configuration interface:
  ```typescript
  interface Config {
    td_api_key: string;
    site: 'us01' | 'jp01' | 'eu01' | 'ap02' | 'ap03' | 'dev';
    enable_updates?: boolean;
    llm_api_base?: string;
    default_project_name?: string;
    default_agent_id?: string;
  }
  ```
  ✅ Created in `src/types.ts`
- [x] Implement configuration validation
- [x] Support environment variable overrides
- [x] Create comprehensive test suite with 100% coverage

### 3. Trino Client Wrapper
- [ ] Create `src/client/endpoints.ts` with site mappings:
  ```typescript
  const ENDPOINTS = {
    us01: 'https://api-presto.treasuredata.com',
    jp01: 'https://api-presto.treasuredata.co.jp',
    eu01: 'https://api-presto.eu01.treasuredata.com',
    ap02: 'https://api-presto.ap02.treasuredata.com',
    ap03: 'https://api-presto.ap03.treasuredata.com',
    dev: 'https://api-development-presto.treasuredata.com'
  };
  ```
- [ ] Create `src/client/trino.ts` wrapper:
  - Configure authentication with TD API key
  - Set up connection pooling
  - Implement query execution with proper error handling
  - Add query timeout configuration

### 4. Security Module
- [ ] Create `src/security/query-validator.ts`:
  - Implement SQL query parsing
  - Detect and block write operations in read-only mode
  - Validate query types (SELECT, SHOW, DESCRIBE)
- [ ] Create `src/security/audit-logger.ts`:
  - Log all queries with timestamps
  - Track operation types and user context
  - Implement log rotation if needed

### 5. MCP Tools Implementation

#### 5.1 list_databases Tool
- [ ] Create `src/tools/list-databases.ts`
- [ ] Query: `SELECT schema_name FROM td.information_schema.schemata WHERE catalog_name = 'td' ORDER BY schema_name`
- [ ] Return formatted list of database names
- [ ] Add error handling for connection failures

#### 5.2 list_tables Tool
- [ ] Create `src/tools/list-tables.ts`
- [ ] Accept database parameter
- [ ] Query: `SELECT table_name FROM td.information_schema.tables WHERE table_catalog = 'td' AND table_schema = ? ORDER BY table_name`
- [ ] Validate database exists before querying

#### 5.3 describe_table Tool
- [ ] Create `src/tools/describe-table.ts`
- [ ] Accept database and table parameters
- [ ] Query: `SELECT column_name, data_type, is_nullable FROM td.information_schema.columns WHERE table_catalog = 'td' AND table_schema = ? AND table_name = ? ORDER BY ordinal_position`
- [ ] Format response with column details

#### 5.4 query Tool (Read-only)
- [ ] Create `src/tools/query.ts`
- [ ] Implement query validation (only SELECT, SHOW, DESCRIBE)
- [ ] Add automatic LIMIT injection:
  ```typescript
  function injectLimit(sql: string, limit: number = 40): string {
    // Check if query already has LIMIT
    // If not, append LIMIT clause
  }
  ```
- [ ] Parse and format query results
- [ ] Handle large result sets gracefully

#### 5.5 execute Tool (Write operations)
- [ ] Create `src/tools/execute.ts`
- [ ] Check if `enable_updates` is true
- [ ] Support UPDATE, DELETE, INSERT, CREATE, DROP, ALTER
- [ ] Return affected rows count
- [ ] Implement transaction support if needed

### 6. MCP Server Setup
- [ ] Create `src/index.ts` as main entry point
- [ ] Initialize MCP server with all tools
- [ ] Set up proper error handling and logging
- [ ] Implement graceful shutdown

### 7. Testing
- [x] Set up ~~Jest~~ Vitest testing framework
- [x] Create unit tests for:
  - Configuration validation
  - Query validation
  - Each MCP tool (pending)
  - Security features (pending)
- [x] Create unit tests with mock Trino responses
- [ ] Create integration tests with real Trino connection:
  - Use site: 'dev' for testing
  - Use TD_API_KEY_DEVELOPMENT_AWS environment variable
  - Test actual database operations
- [x] Add CI/CD pipeline configuration with GitHub Actions

### 8. Documentation
- [x] Create comprehensive README.md:
  - Installation instructions
  - Configuration options
  - Usage examples
  - Security considerations
- [ ] Add JSDoc comments to all public APIs
- [ ] Create example configurations

### 9. NPX Packaging
- [x] Configure package.json for npx execution:
  ```json
  {
    "name": "@treasuredata/mcp-server",
    "bin": {
      "td-mcp-server": "./dist/index.js"
    }
  }
  ```
  ✅ Configured in `package.json`
- [ ] Add shebang to entry point
- [ ] Test npx execution locally
- [ ] Prepare for npm publication

### 10. Publishing
- [ ] Set up npm organization (@treasuredata)
- [x] Configure package metadata ✅
- [x] Add LICENSE file (MIT) ✅
- [ ] Publish initial version to npm
- [ ] Test installation and execution

## Phase 2: Future Enhancements

### 1. Chat Tool Implementation
- [ ] Create `src/tools/chat.ts`
- [ ] Implement LLM API client
- [ ] Handle SSE streaming responses
- [ ] Manage chat sessions
- [ ] Parse tool calls from agent responses

### 2. Advanced Features
- [ ] Query result caching
- [ ] Query optimization suggestions
- [ ] Schema change detection
- [ ] Performance metrics collection
- [ ] Multi-query transaction support

## Success Criteria
- [ ] All MCP tools functional with TD API
- [ ] Security features working (read-only by default)
- [ ] NPX execution successful
- [ ] Comprehensive test coverage (>80%)
- [ ] Documentation complete
- [ ] Published to npm registry

## Timeline Estimate
- Phase 1: 2-3 weeks
  - Phase 1.1 (Project Initialization): ✅ Completed in 1 day
  - Phase 1.2 (Configuration Module): ✅ Completed in 1 day
  - Phase 1.3 (Trino Client Wrapper): ✅ Completed in 1 day
  - Phase 1.4-1.10: In progress
- Phase 2: 1-2 weeks (future)

## Dependencies and Risks
- Dependency on Trino JS client compatibility
- TD API stability and rate limits
- MCP SDK updates and compatibility
- Security review requirements