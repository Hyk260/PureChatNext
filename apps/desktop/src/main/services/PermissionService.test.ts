import { describe, expect, it, vi } from 'vitest'

import { PermissionService } from './PermissionService'

describe('PermissionService', () => {
  it('keeps denied grants unchanged and reuses an approved grant', async () => {
    const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const service = new PermissionService(confirm)

    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: false })
    expect(service.hasFullAccess('topic-a')).toBe(false)
    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('transfers the draft grant to the first topic', async () => {
    const service = new PermissionService(vi.fn().mockResolvedValue(true))
    await service.requestFullAccess('draft')
    expect(await service.requestFullAccess('topic-b')).toEqual({ granted: true })
    expect(service.hasFullAccess('topic-b')).toBe(true)
  })
})
