ALTER TABLE "chat_topics" ADD COLUMN "favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_topics" ADD COLUMN "project_name" text;