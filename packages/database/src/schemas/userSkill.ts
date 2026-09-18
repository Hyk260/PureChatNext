import { index, integer, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

import { idGenerator } from '../utils/idGenerator'
import { timestamps, varchar255 } from './_helpers'
import { users } from './user'

export const userSkills = pgTable(
  'user_skills',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('userSkills'))
      .primaryKey(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    identifier: varchar255('identifier').notNull(),
    name: varchar255('name').notNull(),
    description: text('description'),
    version: varchar('version', { length: 64 }),
    icon: text('icon'),
    homepage: text('homepage'),
    githubOwner: varchar255('github_owner').notNull(),
    githubRepo: varchar255('github_repo').notNull(),
    githubBranch: varchar255('github_branch').notNull(),
    githubPath: text('github_path'),
    fileCount: integer('file_count').notNull(),
    totalSize: integer('total_size').notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('user_skills_user_id_identifier_unique').on(t.userId, t.identifier),
    index('user_skills_user_id_idx').on(t.userId),
  ]
)

export type NewUserSkill = typeof userSkills.$inferInsert
export type UserSkillItem = typeof userSkills.$inferSelect

export const userSkillFiles = pgTable(
  'user_skill_files',
  {
    id: text('id')
      .$defaultFn(() => idGenerator('userSkillFiles'))
      .primaryKey(),
    skillId: text('skill_id')
      .references(() => userSkills.id, { onDelete: 'cascade' })
      .notNull(),
    path: text('path').notNull(),
    s3Key: text('s3_key').notNull(),
    size: integer('size').notNull(),
    fileType: varchar('file_type', { length: 255 }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('user_skill_files_skill_id_path_unique').on(t.skillId, t.path),
    index('user_skill_files_skill_id_idx').on(t.skillId),
  ]
)

export type NewUserSkillFile = typeof userSkillFiles.$inferInsert
export type UserSkillFileItem = typeof userSkillFiles.$inferSelect
