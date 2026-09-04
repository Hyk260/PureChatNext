ALTER TABLE "channel_events" ADD COLUMN "platform_payload" jsonb;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD COLUMN "thread_type" varchar(255);