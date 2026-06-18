import { defineConfig } from 'vitest/config'

// Standalone Vitest config (kept separate from vite.config.ts so the app build
// is untouched). Node environment is enough for the store/logic unit tests;
// switch to 'jsdom' per-file via a docblock when adding component tests.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
})
