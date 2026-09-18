import readmes from './skills.readme.data.json'

/** Catalog SKILL.md captured by `pnpm skills:sync`. Server-only. */
export const getCommunitySkillReadmeSnapshot = (identifier: string) =>
  (readmes as Record<string, string>)[identifier]
