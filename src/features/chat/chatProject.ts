import { getDesktopApi } from '@/types/desktop'

import type { PendingChatProject } from './chatLocalStorage'

/** 新会话优先保留显式选择，否则使用本机默认项目。 */
export async function resolveNewChatProject(project: PendingChatProject | null): Promise<PendingChatProject | null> {
  const api = getDesktopApi()
  if (!api || project?.rootPath) return project
  if (project) {
    const projects = await api.listProjects()
    return projects.find((item) => item.name === project.name) ?? project
  }
  return (await api.getDefaultProject?.()) ?? null
}
