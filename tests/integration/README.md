# Integration Tests

**Note: This directory is for internal Treasure Data development only.**

This directory contains integration tests that connect to a real Treasure Data environment.

## Prerequisites

To run integration tests, you need:

1. Access to Treasure Data development environment
2. Set the `TD_API_KEY_DEVELOPMENT_AWS` environment variable with a valid API key for the dev site

## Running Integration Tests

```bash
# Set the API key
export TD_API_KEY_DEVELOPMENT_AWS="your-dev-api-key"

# Run integration tests
npm run test:integration
```

## Test Coverage

The integration tests cover:

- **Connection validation**: Testing successful and failed connections
- **Database operations**: Listing databases and tables (uses `sample_datasets` database)
- **Schema inspection**: Describing table structures for `www_access` and `nasdaq` tables
- **Query execution**: Running various SELECT queries against sample data
- **Error handling**: Ensuring errors are handled gracefully

## Important Notes

- Integration tests are automatically skipped if `TD_API_KEY_DEVELOPMENT_AWS` is not set
- These tests connect to the TD dev environment (`api-development-presto.treasuredata.com`)
- Tests use read-only operations and do not modify any data
- The timeout is increased to 30 seconds to account for network latency

## CI/CD

Integration tests are not run in the standard CI pipeline to avoid requiring secrets in GitHub Actions. They should be run locally before major releases.