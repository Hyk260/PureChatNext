# Debug 包使用指南

本项目使用 [debug](https:/github.com/debug-js/debug) 包进行调试日志记录。使用此规则来确保团队成员统一调试日志格式。

## 基本用法

1. 导入 debug 包：

```typescript
import debug from 'debug';
```

2. 创建一个命名空间的日志记录器：

```typescript
// 格式: [模块]:[子模块]
const log = debug('[模块名]:[子模块名]');
```

3. 使用日志记录器：

```typescript
log('简单消息');
log('带变量的消息: %O', object);
log('格式化数字: %d', number);
```

## 命名空间约定

- **代理相关**: `proxy:[模块]`
  - 示例: `proxy:default`, `proxy:auth`, `proxy:cors`
- **数据库相关**: `db:[模块]`
  - 示例: `db:user`, `db:chat`, `db:connection`
- **认证相关**: `auth:[模块]`
  - 示例: `auth:jwt`, `auth:session`, `auth:middleware`

## 格式说明符

| 说明符 | 用途 | 示例 |
|--------|------|------|
| `%O` | 对象展开（推荐用于复杂对象，带缩进） | `log('用户信息: %O', user)` |
| `%o` | 对象（紧凑格式） | `log('配置: %o', config)` |
| `%s` | 字符串 | `log('路径: %s', pathname)` |
| `%d` | 数字（整数/浮点数） | `log('耗时: %dms', duration)` |
| `%j` | JSON 字符串 | `log('数据: %j', data)` |
| `%%` | 百分号字面量 | `log('成功率: %d%%', 95)` |

## 启用调试

要在开发时启用调试输出，需设置环境变量：

### 在浏览器中

在控制台执行：
```javascript
// 启用所有日志
localStorage.debug = '*';

// 启用特定模块
localStorage.debug = 'proxy:*';

// 启用多个模块（逗号分隔）
localStorage.debug = 'proxy:*, auth:*';

// 禁用日志
localStorage.debug = '';
```

### 在 Node.js 环境中

```bash
# 启用所有日志
DEBUG=* pnpm dev

# 启用特定模块
DEBUG=proxy:* pnpm dev

# 启用多个模块
DEBUG=proxy:*,auth:* pnpm dev

# 通过 .env 文件配置
echo "DEBUG=proxy:*" >> .env
```
