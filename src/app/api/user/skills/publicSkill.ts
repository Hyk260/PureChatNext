import type { UserSkillItem } from '@pure/database/schemas/userSkill'

export const toPublicUserSkill = (skill: UserSkillItem) => ({
  createdAt: skill.createdAt,
  description: skill.description,
  fileCount: skill.fileCount,
  homepage: skill.homepage,
  icon: skill.icon,
  id: skill.id,
  identifier: skill.identifier,
  name: skill.name,
  totalSize: skill.totalSize,
  updatedAt: skill.updatedAt,
  version: skill.version,
})
