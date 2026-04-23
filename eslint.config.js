import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude/worktrees/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // F-23: Enforce consistent import ordering
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      // Allow _-prefixed variables for intentional destructuring omission
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // Phase 23 / D-07 additions:
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'smart'], // D-18: 'smart' permits `== null` idiom
      // Phase 23 / D-17: `no-explicit-any` is inherited from
      // tseslint.configs.recommended but D-07 prohibits adding aggressive
      // rules. 526 existing violations; disabled project-wide per D-17.
      // Backlog tracked in DEFERRED-LINT.md (repo root).
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Context files legitimately export hooks + providers together
  {
    files: ['src/context/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Phase 20 / D-04, T-20-13: jsonwebtoken must only be imported by the
  // centralized JWT modules. Direct verify imports elsewhere risk
  // algorithm-confusion CVEs (CVE-2022-23529). Tests are exempt because
  // tests/jwtUtil.test.ts and friends legitimately construct fixture tokens
  // with raw jwt.sign for negative-path coverage.
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['server/jwtUtil.ts', 'server/keycloakJwt.ts', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'jsonwebtoken',
          message: 'Import sign/verify helpers from server/jwtUtil.js (HS256) or server/keycloakJwt.js (RS256) instead. Direct jsonwebtoken use risks algorithm-confusion CVEs.',
        }],
      }],
    },
  },
])
