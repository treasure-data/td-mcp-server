import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/index.ts',
        'vitest.config.ts',
        'tests/integration/**',
      ],
    },
    // Increase timeout for integration tests
    testTimeout: 30000,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});