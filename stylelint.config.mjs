/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard', 'stylelint-config-tailwindcss'],
  rules: {
    // Tailwind 4 的 `@tailwind` / `@apply` / `@theme` / `@utility` / `@variant` 等指令
    // 由 stylelint-config-tailwindcss 处理；额外关闭 standard 中的 at-rule-no-unknown 兜底
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'config',
          'plugin',
          'utility',
          'variant',
          'custom-variant',
          'reference',
          'source',
          'theme',
          'layer',
        ],
      },
    ],
    // 项目 CSS Modules 使用 camelCase 类名（如 .notFoundPage）与 antd token 变量
    // （如 --colorText），关闭 kebab-case 强制
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    // 全局样式存在少量层叠与同优先级覆盖
    'no-descending-specificity': null,
    // 入口文件可能仅含 `@tailwind` 指令
    'no-empty-source': null,
  },
  ignoreFiles: [
    'node_modules/**',
    '.next/**',
    'dist/**',
    'public/_spa/**',
    'coverage/**',
    '**/*.snap',
    'src/app/spa/spaHtmlTemplate.generated.ts',
  ],
}
