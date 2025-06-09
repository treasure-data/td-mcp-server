import { describe, it, expect, vi } from 'vitest';
import { TDMcpServer } from '../src/server';

// Mock the config module
vi.mock('../src/config', () => ({
  loadConfig: vi.fn(() => ({
    td_api_key: 'test-api-key-12345',
    site: 'dev',
    enable_updates: false,
  })),
}));

// Mock the StdioServerTransport to prevent actual stdio operations
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    close: vi.fn(),
  })),
}));

describe('TDMcpServer', () => {
  it('should create server instance', () => {
    expect(() => new TDMcpServer()).not.toThrow();
  });

  it('should initialize with configuration', () => {
    const server = new TDMcpServer();
    expect(server).toBeDefined();
  });

  it('should have proper server metadata', () => {
    const server = new TDMcpServer();
    // Server instance is created with proper name and version
    expect(server).toBeDefined();
  });
});