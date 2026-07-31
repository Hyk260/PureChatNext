import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Enforce: `import type { Foo }` + `import { Bar }` from 'pkg'（含 packages/**）
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Prefer type-only imports; autofix to top-level `import type`
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
      // Disallow inline `import { type Foo }` — use top-level `import type { Foo }`
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      // Allow coexisting `import type` + value import from the same module
      'import/no-duplicates': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Vitest / package tests often use `any` fixtures
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])

export default eslintConfig
