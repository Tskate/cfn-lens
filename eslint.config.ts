import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// TODO: package.json aliases `typescript` to TS 6 because TS 7.0 has no JS API for typescript-eslint.
// Switch to a plain `typescript@^7` once typescript-eslint supports TS >= 7.1 (typescript-eslint#10940).
export default defineConfig([
  globalIgnores(['**/dist', '**/coverage']),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
      // Several tsconfig.json files exist in the monorepo; pin the root so typescript-eslint doesn't guess.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
]);
