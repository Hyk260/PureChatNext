import { beforeEach, describe, expect, it, vi } from 'vitest'

const confirmModal = vi.fn()

vi.mock('@pure/ui', () => ({
  confirmModal: (...args: unknown[]) => confirmModal(...args),
}))

import { confirmUninstallSkill, deleteUserSkill } from './uninstallSkill'

describe('confirmUninstallSkill', () => {
  beforeEach(() => {
    confirmModal.mockReset()
  })

  it('opens a danger confirm with uninstall copy', () => {
    const onOk = vi.fn()
    confirmUninstallSkill(onOk)
    expect(confirmModal).toHaveBeenCalledWith({
      cancelText: '取消',
      content: '卸载后将删除本地副本，可稍后从社区重新安装。',
      okButtonProps: { danger: true },
      okText: '卸载',
      onOk,
      title: '卸载这个技能？',
    })
  })
})

describe('deleteUserSkill', () => {
  it('DELETEs the skill and throws on failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await deleteUserSkill('skill-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/user/skills/skill-1', { method: 'DELETE' })

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    await expect(deleteUserSkill('skill-1')).rejects.toThrow('delete')
  })
})
