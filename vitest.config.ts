import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Component tests use jsdom via per-file docblock: // @vitest-environment jsdom
  },
});
