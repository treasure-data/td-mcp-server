# Release v0.2.0

## 🎉 New Features

### CDP (Customer Data Platform) Support (Experimental)
- Added 4 new MCP tools for CDP operations:
  - `list_parent_segments`: List all parent segments in your CDP account
  - `get_parent_segment`: Get details of a specific parent segment
  - `list_segments`: List segments under a parent segment
  - `list_activations`: List activations (syndications) for a segment
- CDP client with TD1 authentication and multi-site support
- Comprehensive tests including integration tests against dev environment
- Note: CDP tools are marked as experimental and currently support read-only operations

## 🐛 Bug Fixes
- Hide 'dev' site from error messages to avoid exposing internal environments

## 🔧 Improvements
- CDP tools now return structured JSON data for consistency with other tools
- All tools follow the same JSON output pattern for better programmatic consumption

## 📚 Documentation
- Added CDP documentation to README with usage examples
- Updated CLAUDE.md with CDP integration details
- Marked CDP features as experimental with notes about limitations

## 🔐 Security
- CDP API keys are properly masked in error messages
- CDP operations are included in audit logging

## Technical Details
- CDP endpoints follow the same site pattern as Trino endpoints
- Uses existing TD_API_KEY and TD_SITE configuration
- No additional environment variables required