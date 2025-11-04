import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 64 }),
  login_id: varchar("login_id", { length: 32 }).notNull().unique(),
  nick_name: varchar("nick_name", { length: 64 }),
  avatar_url: text("avatar_url"),
  phone: varchar("phone", { length: 20 }).unique(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type User = InferSelectModel<typeof user>;