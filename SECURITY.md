# 安全政策

## 支持范围

安全修复优先覆盖 `main` 分支和最新正式 Release。旧 Vue3 版 PureChat 不在当前安全支持范围内。

## 报告漏洞

请优先使用 GitHub 仓库的 **Security → Report a vulnerability** 私密报告功能：

<https://github.com/Hyk260/PureChatNext/security/advisories/new>

如果该入口暂不可用，请通过 GitHub 个人主页联系维护者，先说明“PureChatNext 安全报告”，不要在公开 Issue、Discussion 或社群中发送漏洞细节。

报告建议包含：

- 受影响版本、部署方式和组件；
- 可复现步骤、影响范围与必要的概念验证；
- 已采取的临时缓解措施；
- 不包含真实用户数据、生产密钥或第三方隐私信息的日志。

维护者会尽量在 7 天内确认报告，并在完成评估后同步修复计划。请在修复发布前避免公开披露。

## 部署者责任

- 不提交 `.env`、数据库连接串、OAuth Secret、模型 API Key 和微信 / QQ 渠道凭证。
- 生产环境使用高强度独立密钥，并限制 `ALLOWED_ORIGINS`、数据库、Redis 与对象存储网络访问。
- 及时升级依赖和镜像，启用备份、日志脱敏、额度告警及供应商预算上限。
- 自托管运营者负责其用户数据、合规说明、访问控制和事件响应。
