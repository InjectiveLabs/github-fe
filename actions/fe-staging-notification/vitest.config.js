import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js'], // Entry point is hard to unit test
      thresholds: {
        // Lower thresholds since HTTP-dependent functions in slack.js 
        // (searchExistingMessage, updateMessage, postMessage, etc.)
        // require integration tests, not unit tests
        statements: 50,
        branches: 50,
        functions: 65,
        lines: 50,
      },
    },
  },
});
