import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/e2e/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'cli/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.type.ts', 'src/**/index.ts'],
    },
  },
});
