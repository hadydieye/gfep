import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';

// Mêmes base de test, globalSetup et variables que `npm test`, limité aux specs e2e
export default defineConfig({
  ...baseConfig,
  test: { ...baseConfig.test, include: ['test/**/*.e2e-spec.ts'] },
});
