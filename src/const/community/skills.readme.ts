import readmes from './skills.readme.data.json'

/** 已提交的技能说明。`pnpm skills:sync` 的说明草稿在 scripts/community/generated/，确认后整份拷回。 */
export const getCommunitySkillReadmeSnapshot = (identifier: string) =>
  (readmes as Record<string, string>)[identifier]
