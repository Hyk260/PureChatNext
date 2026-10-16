import { describe, expect, it } from 'vitest'

import { PermissionService } from '../PermissionService'

describe('PermissionService', () => {
  it('records the confirmed full-access grant and reuses it', async () => {
    const service = new PermissionService()

    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
    expect(service.hasFullAccess('topic-a')).toBe(true)
    expect(await service.requestFullAccess('topic-a')).toEqual({ granted: true })
  })

  it('transfers the draft grant to the first topic', async () => {
    const service = new PermissionService()
    await service.requestFullAccess('draft')
    expect(await service.requestFullAccess('topic-b')).toEqual({ granted: true })
    expect(service.hasFullAccess('topic-b')).toBe(true)
  })
})
