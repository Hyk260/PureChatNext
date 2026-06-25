# @pure/web-crawler

PureChatNext 内置的网页抓取模块，用于智能提取网页内容并转换为 Markdown 格式。

## 📝 简介

`@pure/web-crawler` 是 PureChatNext 的核心组件，负责网页内容的智能抓取与处理。它能够从各类网页中提取有价值的内容，过滤掉干扰元素，并生成结构化的 Markdown 文本。

## 🛠️ 核心功能

- **智能内容提取**：基于 Mozilla Readability 算法识别主要内容
- **多级抓取策略**：支持多种抓取实现，包括基础抓取、Jina、Search1API 和 Browserless 渲染抓取
- **自定义 URL 规则**：通过灵活的规则系统处理特定网站的抓取逻辑

## 🤝 参与共建

网页结构多样复杂，我们欢迎社区贡献特定网站的抓取规则。您可以通过以下方式参与改进：

```typescript
// 示例：处理特定网站
const url = [
  // ... 其他 url 匹配规则
  {
    // URL 匹配模式，仅支持正则表达式
    urlPattern: 'https://example.com/articles/(.*)',

    // 可选：URL 转换，用于重定向到更易抓取的版本
    urlTransform: 'https://example.com/print/$1',

    // 可选：指定抓取实现方式，支持 'naive'、'jina'、'search1api' 和 'browserless' 四种
    impls: ['naive', 'jina', 'search1api', 'browserless'],

    // 可选：内容过滤配置
    filterOptions: {
      // 是否启用 Readability 算法，用于过滤干扰元素
      enableReadability: true,
      // 是否转换为纯文本
      pureText: false,
    },
  },
];
```
