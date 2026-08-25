---
title: PureChatNext 文档
description: PureChatNext 的快速开始、开发指南与自托管文档入口。
---

# PureChatNext 文档

这里收录 PureChatNext 的公开中文文档。请按读者任务进入对应分类：

正式文档站：<https://docs.purechat.cn>。本目录仍是 GitHub 阅读与文档站构建共用的唯一内容源。

- [快速开始](./getting-started/quick-start.md)：安装依赖、准备环境并启动本地开发。
- [开发指南](./development/README.md)：数据库、质量检查和前端样式约定。
- [自托管指南](./self-hosting/README.md)：配置、部署、基础设施和消息渠道。

## 文档维护规则

- `docs/` 根目录除本索引外不新增文档；公开文档只放在 `getting-started/`、`development/` 和 `self-hosting/`。
- 按读者任务和稳定领域分类，不按临时项目、负责人或时间阶段分类。
- 同一目录直属文档达到 9 个时，应按子领域继续拆分；目录深度通常不超过 3 层。
- 文件名使用 kebab-case；当前只维护中文，不添加 locale 后缀。
- 每篇公开 Markdown 必须在文件开头声明 `title` 与 `description` frontmatter，正文继续保留一个一级标题。
- 每个公开内容目录使用 `meta.json` 固定站点导航顺序；新增、移动文档时同步维护最近一级配置。
- 新文档必须从本索引或所属分类的 `README.md` 可达，并使用相对链接引用其他仓库文件。
- 移动或重命名文档时，全仓更新 Markdown、源码注释、脚本提示和产品页面中的旧路径。
- `docs/private/` 存放本地内部资料，已被 Git 忽略，不属于公开文档，也不得进入公开文档站构建输入。
- 提交前运行 `pnpm lint:docs`、`pnpm lint:md` 和 `pnpm build:docs`。

## 新增文档检查清单

1. 确认目标读者和所属分类。
2. 添加 `title`、`description` frontmatter，并使用一个清晰的一级标题说明主题。
3. 将文档加入最近一级分类索引和 `meta.json` 导航。
4. 检查相对链接和示例命令。
5. 运行内容检查和文档站构建。
