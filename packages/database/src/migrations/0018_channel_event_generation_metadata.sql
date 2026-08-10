ALTER TABLE "channel_events" ADD COLUMN "provider" varchar(255);--> statement-breakpoint
ALTER TABLE "channel_events" ADD COLUMN "model" varchar(255);--> statement-breakpoint
ALTER TABLE "channel_events" ADD COLUMN "duration_ms" integer;
