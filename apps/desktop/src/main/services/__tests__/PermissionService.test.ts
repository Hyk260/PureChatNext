import { describe, expect, it, vi } from 'vitest'

import { PermissionService } from '../PermissionService'

describe('PermissionService', () => {
  it('requires confirmation before granting full access and reuses that topic grant', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    const service = new PermissionService(confirm)

    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.stringContaining('topic-a') })
    )
    expect(service.hasFullAccess('topic-a')).toBe(true)
    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('does not grant full access when confirmation is declined', async () => {
    const service = new PermissionService(async () => false)

    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: false })
    expect(service.hasFullAccess('topic-a')).toBe(false)
  })

  it('does not transfer a draft grant to another topic', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    const service = new PermissionService(confirm)

    await service.requestFullAccess('draft')
    expect(await service.requestFullAccess('topic-b')).toEqual({ granted: true })
    expect(service.hasFullAccess('topic-b')).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
