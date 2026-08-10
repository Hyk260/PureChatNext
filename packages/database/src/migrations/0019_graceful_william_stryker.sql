CREATE TABLE "channel_event_files" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"session_id" text NOT NULL,
	"conversation_version" integer NOT NULL,
	"file_id" text NOT NULL,
	"source_file_id" text,
	"direction" varchar(255) NOT NULL,
	"operation_hash" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"summary" text,
	"metadata" jsonb,
	"delivery_status" varchar(255) DEFAULT 'pending' NOT NULL,
	"delivery_error" text,
	"sent_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_event_files" ADD CONSTRAINT "channel_event_files_event_id_channel_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."channel_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_event_files" ADD CONSTRAINT "channel_event_files_session_id_channel_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."channel_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_event_files" ADD CONSTRAINT "channel_event_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_event_files" ADD CONSTRAINT "channel_event_files_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_event_files_event_direction_operation_unique" ON "channel_event_files" USING btree ("event_id","direction","operation_hash");--> statement-breakpoint
CREATE INDEX "channel_event_files_event_idx" ON "channel_event_files" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "channel_event_files_session_version_idx" ON "channel_event_files" USING btree ("session_id","conversation_version","created_at");--> statement-breakpoint
CREATE INDEX "channel_event_files_file_idx" ON "channel_event_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "channel_event_files_source_file_idx" ON "channel_event_files" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "channel_event_files_delivery_idx" ON "channel_event_files" USING btree ("event_id","delivery_status");
--> statement-breakpoint
ALTER TABLE "channel_event_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "channel_event_files" FROM "anon";
	END IF;

	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "channel_event_files" FROM "authenticated";
	END IF;
END
$$;
