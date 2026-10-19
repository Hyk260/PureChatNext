---
title: 桌面版发布到腾讯云 COS
description: 配置 GitHub Actions 仓库变量与密钥，并将公开的 PureChatNext 桌面版 Release 同步到腾讯云 COS。
---

# 桌面版发布到腾讯云 COS

工作流 [Sync desktop release to COS](https://github.com/Hyk260/PureChatNext/actions/workflows/desktop-cos-sync.yml) 将已公开的稳定版 GitHub Release 资产上传到腾讯云 COS 的 `desktop/` 目录，并清理所选平台的旧版本。它不会在同步时构建桌面安装包。

## 配置 GitHub Actions

打开仓库的 **Settings → Secrets and variables → Actions**。工作流没有绑定 GitHub Environment，因此添加仓库级配置即可。

### Secrets

切换到 **Secrets** 标签，点击 **New repository secret**，添加腾讯云 API 密钥：

| 名称 | 值 |
| --- | --- |
| `S3_ACCESS_KEY_ID` | 腾讯云 SecretId |
| `S3_SECRET_ACCESS_KEY` | 腾讯云 SecretKey |

### Variables

切换到 **Variables** 标签，点击 **New repository variable**，添加：

| 名称 | 值 |
| --- | --- |
| `S3_BUCKET` | COS 桶名，必须带 APPID 后缀，例如 `purechat-1250000000` |
| `S3_ENDPOINT` | COS 地域 API 地址，例如 `https://cos.ap-shanghai.myqcloud.com` |
| `S3_REGION` | COS 地域，例如 `ap-shanghai`，必须与 Endpoint 中的地域一致 |
| `S3_PUBLIC_DOMAIN` | 可选。浏览器下载用的 HTTPS 公共域名，例如 `https://downloads.example.com` |
| `PURECHAT_DESKTOP_UPDATE_URL` | 必填。客户端更新地址，路径必须是公共域名下的 `desktop/`，例如 `https://downloads.example.com/desktop/` |

`S3_ENDPOINT` 必须是 COS 地域 API 地址，不能填 CDN 或自定义下载域名。设置了 `S3_PUBLIC_DOMAIN` 时，`PURECHAT_DESKTOP_UPDATE_URL` 的主机名应与其一致，路径为 `/desktop/`。未设置 `S3_PUBLIC_DOMAIN` 时，工作流使用 COS 桶默认域名作为公共地址，此时更新地址示例为 `https://purechat-1250000000.cos.ap-shanghai.myqcloud.com/desktop/`。客户端需要能匿名读取更新文件。

`S3_ENABLE_PATH_STYLE` 和 `S3_SET_ACL` 已由工作流固定为 `0`，无需配置。发布检查也要求 HTTPS 的 COS 地域 Endpoint、正确的桶名和相同的地域。

## 手动运行同步

1. 确保桌面发行工作流已生成稳定版 Release 草稿，并检查安装包和更新清单。
2. 在 GitHub 发布该 Release。发布正式版会自动触发 COS 同步；预发布版本不会自动同步。
3. 也可以在 Actions 中打开 **Sync desktop release to COS**，点击 **Run workflow**，填写已公开的稳定版标签（例如 `v0.3.0`），选择平台。
4. 首次运行保持 `dry_run=true`，确认日志中的文件和清理范围后，再次运行并关闭 dry run，执行上传和旧版本清理。

工作流仅接受 `vX.Y.Z` 格式的已发布稳定版。dry run 会校验资产并读取远端状态，但不会上传或删除对象。正式运行会处理所选平台的发行资产和更新清单；选择 `all` 时同时处理 Windows 与 macOS。

## 故障排查

- `Missing PURECHAT_DESKTOP_UPDATE_URL repository variable`：检查仓库级 Variables 中是否已添加 `PURECHAT_DESKTOP_UPDATE_URL`。
- `桌面发布缺少 ...`：检查对应 Secret 或 Variable 的名称和值是否正确。
- `S3_REGION 与 Endpoint 地域一致`：确认 `S3_REGION` 与 `S3_ENDPOINT` 中的地域一致，例如 `ap-shanghai`。
- 客户端下载更新返回 403：检查 COS 桶或自定义域名是否允许客户端公开读取 `desktop/` 下的更新文件。
