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

### COS 上传权限

超过 2 MiB 的安装包使用分块上传，每次只将一块读入内存后发送。COS 确认该块上传成功后，日志才会累计已上传字节数，并报告本次上传的耗时和平均速度；临时失败只重试当前块，最多 3 次。每次请求总限时为 5 分钟，连续 2 分钟没有网络活动仍会触发 socket 超时。较小文件使用固定长度的普通上传。2 MiB 分块符合 [COS Upload Part](https://cloud.tencent.cn/document/product/436/7750) 的大小要求，减小了慢链路上单次超时需要重传的数据量。

除了原有的读取、上传和清理对象权限，发布密钥还需要 `cos:InitiateMultipartUpload`、`cos:UploadPart`、`cos:CompleteMultipartUpload` 和 `cos:AbortMultipartUpload` 权限。最后一项用于失败时清理未完成的分块。权限说明见[腾讯云上传对象文档](https://cloud.tencent.cn/document/product/436/65820)。

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
- 旧脚本停在 `上传请求流已处理 ... 65536/... bytes`：这是本地文件流预读日志，不能说明 COS 已收到数据。将修复合入默认分支后重新同步，最新日志应显示 `上传 COS 分块` 和 `COS 已确认上传`；工作流固定检出默认分支的脚本，无需重新构建同版本安装包。
- 初始化、上传或合并分块返回 `AccessDenied`：检查密钥是否具有上述分块上传权限，且授权资源包含 `desktop/*`。
- 分块反复报 `AbortError: Request aborted`，并带有 `cause=TimeoutError`：该次请求触发了总超时。结合日志中的耗时和成功分块的速度检查 runner 到 COS 的链路；HTTP 状态码、网络错误码和服务端 requestId 会在可用时一起打印。若仍持续超时，优先考虑与 COS 同地域的自托管 runner；不要将 CDN 下载域名填入 `S3_ENDPOINT`。
- 已看到 `COS 已确认上传`，但文件列表里没有安装包：分块需要全部上传并合并后才形成完整对象。失败时脚本会尝试清理未完成的分块，重跑只复用已完成且校验通过的文件。
- 提示 `.desktop-publish-locks/windows.json` 或 `mac.json` 已存在：先确认没有发布任务仍在运行，再在 COS 控制台清理对应残留锁；不要在任务上传过程中删除锁。
