import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/** SPA / client UI must not pull server env modules (keys stay on Next BFF). */
const spaClientFiles = [
  'src/spa/**/*.{ts,tsx}',
  'src/features/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/services/**/*.{ts,tsx}',
  'src/utils/**/*.{ts,tsx}',
  'src/routes/**/*.{ts,tsx}',
  'src/layout/**/*.{ts,tsx}',
  'src/initialize.ts',
  'src/libs/better-auth/client/**/*.{ts,tsx}',
]

const serverEnvImportMessage =
  '禁止在 SPA/客户端代码中导入服务端 env（@/envs、@pure/env）。公开配置走 window.__SERVER_CONFIG__ 或 API。'

const supabaseClientImportMessage =
  '禁止在 SPA/客户端代码中导入 @/libs/supabase（其依赖 serverDB，含 DATABASE_URL 等）。'

const serverEnvModules = [
  '@/envs/app',
  '@/envs/auth',
  '@/envs/email',
  '@/envs/file',
  '@/envs/im',
  '@/envs/llm',
  '@/envs/redis',
  '@/envs/serverDB',
  '@/envs/tools',
  '@/envs/analytics',
  '@pure/env/app',
  '@pure/env/auth',
  '@pure/env/email',
  '@pure/env/file',
  '@pure/env/im',
  '@pure/env/llm',
  '@pure/env/redis',
  '@pure/env/serverDB',
  '@pure/env/tools',
  '@pure/env/analytics',
]

const restrictedServerEnvPaths = serverEnvModules.map((name) => ({
  name,
  message: serverEnvImportMessage,
}))

/** components：允许 Analytics 读 @/envs/analytics（Next layout）；其余 server env 仍禁止。 */
const restrictedServerEnvPathsExceptAnalytics = serverEnvModules
  .filter((name) => !name.endsWith('/analytics'))
  .map((name) => ({
    name,
    message: serverEnvImportMessage,
  }))

const restrictedSupabasePaths = [
  { name: '@/libs/supabase', message: supabaseClientImportMessage },
  { name: '@/libs/supabase/client', message: supabaseClientImportMessage },
  { name: '@/libs/supabase/server', message: supabaseClientImportMessage },
]

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
  // SPA 入口与业务 UI：禁止全部服务端 env / supabase 客户端
  {
    files: spaClientFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...restrictedServerEnvPaths, ...restrictedSupabasePaths],
          patterns: [
            {
              group: ['@/envs/*', '@pure/env/*'],
              message: serverEnvImportMessage,
            },
            {
              group: ['@/libs/supabase', '@/libs/supabase/*'],
              message: supabaseClientImportMessage,
            },
          ],
        },
      ],
    },
  },
  // 通用 components：禁止 server env（Analytics 除外，见下一组）
  {
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: ['src/components/Analytics/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...restrictedServerEnvPaths, ...restrictedSupabasePaths],
          patterns: [
            {
              group: ['@/envs/*', '@pure/env/*'],
              message: serverEnvImportMessage,
            },
            {
              group: ['@/libs/supabase', '@/libs/supabase/*'],
              message: supabaseClientImportMessage,
            },
          ],
        },
      ],
    },
  },
  // Analytics：允许 @/envs/analytics，仍禁止其它 server env
  {
    files: ['src/components/Analytics/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...restrictedServerEnvPathsExceptAnalytics, ...restrictedSupabasePaths],
        },
      ],
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
