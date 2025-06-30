# Workflow MCP Functions Design

Date: 2025-06-30

## Overview
This document outlines the proposed MCP functions for monitoring workflow execution states and retrieving failure data from Digdag workflows in Treasure Data.

## References
- [Digdag REST API Documentation](https://docs.digdag.io/api/)

## Proposed MCP Tools

### 1. list_workflows
Lists all workflows in a project with their current status.

**Parameters:**
- `project_name` (required): Name of the project
- `limit` (optional): Maximum number of workflows to return (default: 100)
- `last_id` (optional): Pagination cursor for next page

**Returns:**
```json
{
  "workflows": [
    {
      "id": "123",
      "name": "daily_etl_pipeline",
      "project": "data_processing",
      "revision": "abc123",
      "timezone": "UTC",
      "last_session_time": "2024-01-20T10:00:00Z",
      "last_session_status": "success"
    }
  ],
  "next_page_id": "456"
}
```

### 2. list_sessions
Lists workflow execution sessions (attempts) with filtering options.

**Parameters:**
- `project_name` (optional): Filter by project name
- `workflow_name` (optional): Filter by workflow name
- `status` (optional): Filter by status (running, success, error, killed, planned)
- `from_time` (optional): Start time (ISO 8601)
- `to_time` (optional): End time (ISO 8601)
- `limit` (optional): Maximum results (default: 100)
- `last_id` (optional): Pagination cursor

**Returns:**
```json
{
  "sessions": [
    {
      "id": "789",
      "project": "data_processing",
      "workflow": "daily_etl_pipeline",
      "session_uuid": "uuid-123",
      "session_time": "2024-01-20T10:00:00Z",
      "finish_time": "2024-01-20T10:30:00Z",
      "status": "error",
      "params": {},
      "attempt": {
        "id": "999",
        "status": "error",
        "done": true,
        "success": false,
        "cancel_requested": false,
        "created_at": "2024-01-20T10:00:00Z",
        "finished_at": "2024-01-20T10:30:00Z"
      }
    }
  ],
  "next_page_id": "890"
}
```

### 3. get_session_attempts
Gets detailed information about all attempts for a specific session.

**Parameters:**
- `session_id` (required): Session ID

**Returns:**
```json
{
  "attempts": [
    {
      "id": "999",
      "index": 1,
      "status": "error",
      "state_params": {},
      "done": true,
      "success": false,
      "cancel_requested": false,
      "created_at": "2024-01-20T10:00:00Z",
      "finished_at": "2024-01-20T10:30:00Z",
      "retry_attempt_name": "retry-1"
    }
  ]
}
```

### 4. get_attempt_tasks
Lists all tasks within an attempt with their execution status.

**Parameters:**
- `attempt_id` (required): Attempt ID
- `include_subtasks` (optional): Include subtasks (default: true)

**Returns:**
```json
{
  "tasks": [
    {
      "id": "111",
      "full_name": "+main+extract_data",
      "parent_id": null,
      "config": {},
      "upstream_ids": [],
      "state": "error",
      "export_params": {},
      "store_params": {},
      "state_params": {},
      "updated_at": "2024-01-20T10:15:00Z",
      "retry_at": null,
      "started_at": "2024-01-20T10:10:00Z",
      "error": {
        "message": "Connection timeout",
        "type": "ConfigError",
        "stack_trace": "..."
      }
    }
  ]
}
```

### 5. get_task_logs
Retrieves logs for a specific task.

**Parameters:**
- `attempt_id` (required): Attempt ID
- `task_name` (required): Full task name (e.g., "+main+extract_data")
- `offset` (optional): Byte offset for pagination
- `limit` (optional): Maximum bytes to return (default: 1MB)

**Returns:**
```json
{
  "logs": "2024-01-20 10:10:00 +0000 [INFO] Starting data extraction...\n2024-01-20 10:15:00 +0000 [ERROR] Connection timeout to database\n",
  "next_offset": 2048,
  "has_more": true
}
```

### 6. get_attempt_logs
Retrieves aggregated logs for an entire attempt.

**Parameters:**
- `attempt_id` (required): Attempt ID
- `task_filter` (optional): Filter by task name pattern
- `level_filter` (optional): Filter by log level (ERROR, WARN, INFO, DEBUG)
- `offset` (optional): Byte offset for pagination
- `limit` (optional): Maximum bytes to return (default: 1MB)

**Returns:**
```json
{
  "logs": [
    {
      "task": "+main+extract_data",
      "timestamp": "2024-01-20T10:15:00Z",
      "level": "ERROR",
      "message": "Connection timeout to database",
      "context": {
        "attempt_id": "999",
        "session_id": "789"
      }
    }
  ],
  "next_offset": 4096,
  "has_more": true
}
```

### 7. kill_attempt
Requests cancellation of a running attempt.

**Parameters:**
- `attempt_id` (required): Attempt ID
- `reason` (optional): Reason for cancellation

**Returns:**
```json
{
  "success": true,
  "message": "Cancellation requested for attempt 999"
}
```

### 8. retry_session
Retries a failed session from the beginning or a specific task.

**Parameters:**
- `session_id` (required): Session ID
- `from_task` (optional): Task name to retry from
- `retry_params` (optional): Override parameters for retry

**Returns:**
```json
{
  "attempt_id": "1000",
  "message": "Retry attempt created"
}
```

### 9. retry_attempt
Retries a specific failed attempt, useful for retrying individual attempt failures.

**Parameters:**
- `attempt_id` (required): Attempt ID to retry
- `resume_from` (optional): Task name to resume from (skip successful tasks)
- `retry_params` (optional): Override parameters for retry
- `force` (optional): Force retry even if attempt is running (default: false)

**Returns:**
```json
{
  "new_attempt_id": "1001",
  "session_id": "789",
  "message": "Retry attempt created",
  "resumed_from": "+main+transform_data"
}
```

## Implementation Notes

### Endpoint Resolution
Example implementation for transforming API endpoints to workflow endpoints:

```typescript
function getWorkflowEndpoint(apiEndpoint: string): string {
  const regex = /^api(-(?:staging|development))?(-[a-z0-9]+)?\.(connect\.)?((?:eu01|ap02|ap03)\.)?treasuredata\.(com|co\.jp)$/i;
  const match = apiEndpoint.match(regex);
  
  if (!match) {
    throw new Error(`Invalid API endpoint format: ${apiEndpoint}`);
  }
  
  const [, envPrefix, suffix, connectDomain, regionPrefix, tld] = match;
  
  return `https://api${envPrefix || ''}-workflow${suffix || ''}.${connectDomain || ''}${regionPrefix || ''}treasuredata.${tld}`;
}

// Examples:
// getWorkflowEndpoint('api.treasuredata.com') → 'https://api-workflow.treasuredata.com'
// getWorkflowEndpoint('api-development.connect.treasuredata.com') → 'https://api-development-workflow.connect.treasuredata.com'
// getWorkflowEndpoint('api.eu01.treasuredata.com') → 'https://api-workflow.eu01.treasuredata.com'
```

### Authentication
- Use the same TD API key authentication mechanism
- Add Authorization header: `TD1 ${apiKey}`

### Error Handling
- Handle common HTTP errors (401, 403, 404, 429, 500)
- Provide meaningful error messages for workflow-specific errors
- Mask sensitive information in error responses

### Configuration
- Workflow API endpoints follow the pattern based on the base API URL:
  ```
  Input: api.treasuredata.com → https://api-workflow.treasuredata.com
  Input: api.treasuredata.co.jp → https://api-workflow.treasuredata.co.jp
  Input: api.eu01.treasuredata.com → https://api-workflow.eu01.treasuredata.com
  Input: api.ap02.treasuredata.com → https://api-workflow.ap02.treasuredata.com
  Input: api.ap03.treasuredata.com → https://api-workflow.ap03.treasuredata.com
  Input: api-development.connect.treasuredata.com → https://api-development-workflow.connect.treasuredata.com
  Input: api-staging.connect.treasuredata.com → https://api-staging-workflow.connect.treasuredata.com
  Input: api-development-<suffix>.connect.treasuredata.com → https://api-development-workflow-<suffix>.connect.treasuredata.com
  Input: api-staging-<suffix>.connect.treasuredata.com → https://api-staging-workflow-<suffix>.connect.treasuredata.com
  ```
- Endpoint transformation logic:
  1. Extract components from base API URL using regex: `/\Aapi(-(?:staging|development))?(-[a-z0-9]+)?\.(connect\.)?((?:eu01|ap02|ap03)\.)?treasuredata\.(com|co\.jp)\z/i`
  2. Transform to workflow endpoint: `https://api#{$1}-workflow#{$2}.#{$3}#{$4}treasuredata.#{$5}`
  3. Where:
     - `$1` = staging/development prefix (optional)
     - `$2` = additional suffix (optional, e.g., -suffix)
     - `$3` = connect subdomain (optional)
     - `$4` = region prefix (optional: eu01, ap02, ap03)
     - `$5` = TLD (com or co.jp)
- Add new environment variables:
  - `TD_WORKFLOW_LOG_LIMIT` (optional, default 1MB)
  - `TD_WORKFLOW_LIST_LIMIT` (optional, default 100)
- Endpoint selection based on existing `TD_SITE` configuration

### Security Considerations
- Validate all input parameters
- Implement rate limiting for log retrieval
- Add audit logging for all workflow operations
- All workflow control operations (kill/retry) are enabled by default as they are safe:
  - `retry_session` and `retry_attempt` create new attempts rather than modifying existing ones
  - `kill_attempt` sends a cancellation request, doesn't forcefully terminate
  - These operations don't directly modify or delete data

### Testing
- Mock workflow API responses for unit tests
- Add integration tests with real workflow endpoints
- Test pagination and filtering capabilities
- Verify error handling for various failure scenarios

## Usage Examples

```typescript
// List running workflows
const running = await list_sessions({ 
  status: 'running',
  project_name: 'production_etl'
});

// Get failure details for a session
const attempts = await get_session_attempts({ 
  session_id: '789' 
});

const failedTasks = await get_attempt_tasks({ 
  attempt_id: attempts[0].id 
});

// Retrieve error logs
const logs = await get_task_logs({
  attempt_id: attempts[0].id,
  task_name: failedTasks.find(t => t.state === 'error').full_name
});

// Retry failed workflow
const retry = await retry_session({
  session_id: '789',
  from_task: '+main+transform_data'
});
```

## Future Enhancements
- Workflow definition retrieval and editing
- Scheduled workflow management
- Workflow metrics and statistics
- Real-time log streaming via WebSocket
- Workflow dependency visualization data