/** @type {import('remark-cli').Options} */
export default {
  plugins: [
    'remark-preset-lint-recommended',
    // 统一中文文档格式：保留原 proseWrap，不强制改写
    ['remark-lint-maximum-line-length', false],
  ],
  settings: {
    // 与 Prettier 的 proseWrap: 'preserve' 保持一致
    commonmark: true,
    gfm: true,
  },
  ignoreName: '.remarkignore',
}
