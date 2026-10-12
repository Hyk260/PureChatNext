import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import type { DesktopUpdateInstallationSupport } from '@/types/desktopUpdater'

const execFileAsync = promisify(execFile)
// Apple Developer ID requirements: TN3127, with the Apple trust anchor and certificate OIDs.
const DEVELOPER_ID_REQUIREMENT = '= anchor apple generic ' +
  'and certificate 1[field.1.2.840.113635.100.6.2.6] exists ' +
  'and certificate leaf[field.1.2.840.113635.100.6.1.13] exists'
type RunCodesign = (file: string, args: string[], options: { timeout: number; maxBuffer: number }) =>
  Promise<{ stdout: string; stderr: string }>

/** Check the running application's signing eligibility; Squirrel still verifies each update. */
export async function checkUpdateInstallationSupport(
  { isPackaged, platform, executablePath = process.execPath, onError }: {
    isPackaged: boolean
    platform: NodeJS.Platform
    executablePath?: string
    onError?: (error: unknown) => void
  },
  runCodesign: RunCodesign = execFileAsync
): Promise<DesktopUpdateInstallationSupport> {
  if (!isPackaged) return {
    supported: false, signature: 'development', message: '开发版本仅支持下载更新，不能安装。',
  }
  if (platform === 'win32') return {
    supported: true, signature: 'not-required', message: '当前应用支持安装更新，更新包仍需通过安装时校验。',
  }
  if (platform !== 'darwin') return {
    supported: false, signature: 'unsupported', message: '当前平台暂不支持自动安装更新。',
  }
  const bundlePath = path.resolve(path.dirname(executablePath), '../..')
  const options = { timeout: 15_000, maxBuffer: 64 * 1024 }
  try {
    const { stdout, stderr } = await runCodesign('/usr/bin/codesign', ['-dv', '--verbose=4', bundlePath], options)
    const details = stdout + stderr
    if (/\badhoc\b|Signature=adhoc/i.test(details)) return {
      supported: false, signature: 'ad-hoc',
      message: '当前应用使用 ad-hoc 签名，仅支持下载更新。请手动安装正式签名版本后再使用自动升级。',
    }
    await runCodesign('/usr/bin/codesign', ['--verify', '--deep', '--strict', '-R', DEVELOPER_ID_REQUIREMENT, bundlePath], options)
    return {
      supported: true, signature: 'valid',
      message: '当前应用签名校验通过。更新包仍需通过与当前应用签名身份兼容的原生校验。',
    }
  } catch (error) {
    onError?.(error)
    const details = error instanceof Error ? error.message : String(error)
    const unsigned = /not signed|unsigned/i.test(details)
    return {
      supported: false, signature: unsigned ? 'unsigned' : 'unknown',
      message: unsigned ? '当前应用未签名，仅支持下载更新，不能自动安装。' : '当前应用签名校验未通过或无法完成，不能自动安装更新。',
    }
  }
}
