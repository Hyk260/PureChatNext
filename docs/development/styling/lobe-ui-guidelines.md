---
title: Lobe UI 组件规范
description: PureChatNext 使用 @lobehub/ui 的组件选择、表单、反馈、主题和样式约定。
---

# Lobe UI 组件规范

本仓库以 `@lobehub/ui` 作为业务 UI 组件库。新增或迁移组件时优先直接使用它的公开 API；`@pure/ui` 用于项目定制组件和稳定的项目能力。不要为 Lobe UI 组件增加只转发 props 的薄封装，也不要在业务层重新引入 antd。

## 查阅组件文档

开始实现前，按以下顺序核对当前 API：

1. 阅读 [llms.txt](https://ui.lobehub.com/llms.txt) 了解文档索引，再阅读 [skills.md](https://ui.lobehub.com/skills.md) 中的开发约定。
2. 从文档索引打开目标组件的具体文档，确认导入方式、属性、事件和样式槽位。
3. 核对仓库安装的 `@lobehub/ui` 版本及 `node_modules/@lobehub/ui` 对应声明；类型与文档版本不一致时，以已安装版本为实现边界，并记录需要澄清的差异。
4. 编写后运行相关类型检查与交互测试，不根据 antd 或其他组件库的 API 推断 Lobe UI 行为。

## 组件选择与导入

- 公开组件和类型从 `@lobehub/ui` 根入口导入；表单状态管理组件从 `@lobehub/ui/form` 导入；中文资源从 `@lobehub/ui/i18n` 导入。
- 不从包的 `es/` 内部路径导入实现文件。用本地定制组件解决产品语义与业务复用，用 Lobe UI 公开组件完成通用展示和交互。
- 选用组件前确认键盘操作、焦点顺序、ref、受控值与事件回调签名。保留文件选择、IME 编辑器等确实依赖原生 DOM 行为的控件。
- 表格、分页、日期范围、验证码、抽屉、图片预览、进度和反馈均使用当前安装版本的 Lobe UI 组件及其语义化槽位。

## 表单

- 使用 `useForm`、`Form` 和 `Form.Field`（或公开的 `FormField`）统一表单状态、schema 校验和字段绑定。
- 以 Zod 或其他 Standard Schema 定义校验；字段依赖通过 `deps` 表达，例如确认密码依赖密码字段。
- 多步骤表单共享同一个 form 实例，切换步骤时显式切换 schema，并由实例的提交回调按当前步骤选择业务 handler。
- 管理员等条件表单在打开时重置对应字段并切换 schema；发请求时显式挑选 API 所需字段，不直接提交整个表单 store。
- 自定义 Checkbox 等事件值与 form store 不一致时，在 `Form.Field` 的 `render` 或 `getValue` 中显式转换。

```tsx
import { Form, useForm } from '@lobehub/ui/form'

const form = useForm({
  initialValues: { email: '' },
  schema: emailSchema,
  onSubmit: handleSubmit,
})

return (
  <Form form={form} layout='vertical'>
    <Form.Field label='邮箱' name='email' required>
      <Input type='email' />
    </Form.Field>
    <Button htmlType='submit' type='primary'>提交</Button>
  </Form>
)
```

## 消息与弹窗

- 轻量成功、错误和状态提示使用 `toast`，由全局 `ToastHost` 承载。
- 需要确认的操作使用 `confirmModal`；自定义内容或错误详情使用 `createModal`。全局 `ModalHost` 由主题入口挂载。
- 异步确认失败时保留弹窗并向用户展示错误；不要吞掉错误后让界面误报成功。
- 不新增静态反馈桥接、第二套 Host 或依赖上下文的 antd `App`。

```tsx
import { confirmModal, toast } from '@lobehub/ui'

const removeItem = () =>
  confirmModal({
    title: '删除项目？',
    onOk: async () => {
      await removeFromServer()
      toast.success('项目已删除')
    },
  })
```

## 主题与样式

- `src/layout/ThemeProviders.tsx` 是主题入口；保留中文资源、主题持久化、自定义主色、系统外观适配和全高布局。
- 使用 Lobe UI 的语义 token 与 `classNames` / `styles` 公共槽位定制组件。需要后代选择器、复杂动画或动态几何值时，从 `@lobehub/ui` 使用 `createStaticStyles`。
- 组件布局、间距和简单响应式优先使用 Tailwind；参考 [Tailwind 样式规范](./tailwind-guidelines.md)。依赖 Lobe UI 稳定类名时使用 `lobe-*` 公共类，不使用未文档化内部结构选择器。
- 不写 `.ant-*` 选择器、动态 `ant` 前缀、antd token 变量或旧 Provider 样式覆盖。

## 验收

迁移完成后，生产源码、测试、文档、依赖与构建产物不得重新引入 `antd`、`antd-style` 或 `@ant-design/*`。新组件行为应通过实际 Lobe UI 交互验证；表单、日期和表格还需验证数据转换、分页、排序和错误状态。
