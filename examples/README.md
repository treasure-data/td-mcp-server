# TD MCP Server Configuration Examples

This directory contains example configurations for various MCP clients.

## Files

### claude-desktop-config.json
Basic configuration for Claude Desktop using npx to run the server.

### development-config.json
Configuration for local development with console logging enabled.

### multi-region-config.json
Example of connecting to multiple TD regions simultaneously.

## Usage

1. Copy the appropriate configuration file
2. Replace placeholder values:
   - `your_td_api_key_here` - Your actual Treasure Data API key
   - `/path/to/td-mcp-server` - Path to your local installation
   - `TD_SITE` - Your TD region (us01, jp01, eu01, ap02, ap03, dev)

3. For Claude Desktop:
   - Place the configuration in `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
   - Or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

## Security Notes

- Never commit configurations with real API keys
- Use environment variables for sensitive data when possible
- Enable `TD_ENABLE_UPDATES` only when necessary
- Consider using read-only API keys for general querying