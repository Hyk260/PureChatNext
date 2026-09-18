import { confirmModal } from '@pure/ui'

export async function deleteUserSkill(skillId: string) {
  const response = await fetch(`/api/user/skills/${encodeURIComponent(skillId)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('delete')
}

export function confirmUninstallSkill(onOk: () => void | Promise<void>) {
  confirmModal({
    cancelText: '取消',
    content: '卸载后将删除本地副本，可稍后从社区重新安装。',
    okButtonProps: { danger: true },
    okText: '卸载',
    title: '卸载这个技能？',
    onOk,
  })
}
