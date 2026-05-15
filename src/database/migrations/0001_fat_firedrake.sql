ALTER TABLE "users" RENAME COLUMN "login_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_login_id_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_user_id_unique" UNIQUE("user_id");