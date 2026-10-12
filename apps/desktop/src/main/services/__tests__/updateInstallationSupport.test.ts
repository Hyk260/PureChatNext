// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { checkUpdateInstallationSupport } from '../updateInstallationSupport'

const context = { isPackaged: true, platform: 'darwin' as const, executablePath: '/Applications/PureChat.app/Contents/MacOS/PureChat' }
const signed = 'Authority=Developer ID Application: Test (ABC1234567)\nTeamIdentifier=ABC1234567\n'

describe('update installation signing eligibility', () => {
  it('blocks development installation without running codesign', async () => {
    const run = vi.fn()
    expect(await checkUpdateInstallationSupport({ ...context, isPackaged: false }, run)).toMatchObject({ supported: false, signature: 'development' })
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects ad-hoc signatures even though they are valid local signatures', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: '', stderr: 'CodeDirectory flags=0x10002(adhoc,runtime)\nSignature=adhoc' })
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: false, signature: 'ad-hoc' })
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('requires a successful strict verification against Apple Developer ID requirements', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: '', stderr: signed })
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: true, signature: 'valid' })
    expect(run).toHaveBeenLastCalledWith('/usr/bin/codesign', [
      '--verify', '--deep', '--strict', '-R',
      '= anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists',
      '/Applications/PureChat.app',
    ], { timeout: 15000, maxBuffer: 65536 })
    run.mockRejectedValueOnce(new Error('codesign unavailable'))
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: false, signature: 'unknown' })
  })

  it('fails closed when a declared Developer ID signature is invalid', async () => {
    const run = vi.fn().mockResolvedValueOnce({ stdout: '', stderr: signed }).mockRejectedValueOnce(new Error('a sealed resource is missing or invalid'))
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: false, signature: 'unknown' })
  })

  it('distinguishes unsigned builds and unrecognized signing identities', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('code object is not signed at all'))
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: false, signature: 'unsigned' })
    run.mockResolvedValueOnce({ stdout: '', stderr: 'Authority=Apple Development: Test\nTeamIdentifier=ABC1234567' })
      .mockRejectedValueOnce(new Error('code failed to satisfy specified code requirement(s)'))
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: false, signature: 'unknown' })
  })

  it('uses native certificate verification even when the authority display name is unavailable', async () => {
    const run = vi.fn().mockResolvedValueOnce({ stdout: '', stderr: 'Authority=(unavailable)\nTeamIdentifier=ABC1234567' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
    expect(await checkUpdateInstallationSupport(context, run)).toMatchObject({ supported: true, signature: 'valid' })
  })

  it('leaves Windows native installation checks intact and rejects unsupported platforms', async () => {
    const run = vi.fn()
    expect(await checkUpdateInstallationSupport({ ...context, platform: 'win32' }, run)).toMatchObject({ supported: true, signature: 'not-required' })
    expect(await checkUpdateInstallationSupport({ ...context, platform: 'linux' }, run)).toMatchObject({ supported: false, signature: 'unsupported' })
    expect(run).not.toHaveBeenCalled()
  })
})
