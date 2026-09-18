export type SkillFileTreeNode = {
  children?: SkillFileTreeNode[]
  name: string
  path: string
}

const HIDDEN_SKILL_FILE_NAMES = new Set(['copying', 'licence', 'license', 'license.md', 'license.txt'])

export const isHiddenSkillFile = (path: string) => {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  return HIDDEN_SKILL_FILE_NAMES.has(name)
}

export const buildFileTree = (paths: string[]): SkillFileTreeNode[] => {
  const root: SkillFileTreeNode[] = []
  const folders = new Map<string, SkillFileTreeNode>()

  const childrenOf = (dirPath: string): SkillFileTreeNode[] => {
    if (!dirPath) return root

    const existing = folders.get(dirPath)
    if (existing?.children) return existing.children

    const slash = dirPath.lastIndexOf('/')
    const parentPath = slash === -1 ? '' : dirPath.slice(0, slash)
    const name = slash === -1 ? dirPath : dirPath.slice(slash + 1)
    const node: SkillFileTreeNode = { children: [], name, path: dirPath }
    folders.set(dirPath, node)
    childrenOf(parentPath).push(node)
    return node.children!
  }

  for (const filePath of [...paths].sort()) {
    const slash = filePath.lastIndexOf('/')
    const dirPath = slash === -1 ? '' : filePath.slice(0, slash)
    const name = slash === -1 ? filePath : filePath.slice(slash + 1)
    if (isHiddenSkillFile(name)) continue
    childrenOf(dirPath).push({ name, path: filePath })
  }

  return root
}
