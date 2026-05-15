import { pgTable, uuid, varchar, text } from 'drizzle-orm/pg-core'

import { timestamps } from './_helpers'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  username: text('username').unique(),
  email: text('email').unique(),
  password: varchar('password', { length: 64 }),
  userId: varchar('user_id', { length: 32 }).notNull().unique(),
  avatar: text('avatar'),
  phone: text('phone').unique(),
  role: text('role'),

  ...timestamps,
})

export type User = typeof users.$inferInsert;
export type UserItem = typeof users.$inferSelect;

export type UserWithoutPassword = Omit<User, 'password'>
