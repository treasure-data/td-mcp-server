#!/usr/bin/env node

import { TDMcpServer } from './server';

// Main entry point
async function main(): Promise<void> {
  try {
    const server = new TDMcpServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});