CREATE TABLE "channel_events" (
	"id" text PRIMARY KEY NOT NULL,
	"binding_id" text NOT NULL,
	"session_id" text NOT NULL,
	"platform_message_id" varchar(255) NOT NULL,
	"external_user_id" varchar(255) NOT NULL,
	"conversation_version" integer NOT NULL,
	"message_kind" varchar(255) DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"encrypted_context_token" text NOT NULL,
	"status" varchar(255) DEFAULT 'pending' NOT NULL,
	"response_text" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" varchar(255),
	"lease_expires_at" timestamp with time zone,
	"sent_chunk_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(255),
	"last_error_message" text,
	"completed_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"binding_id" text NOT NULL,
	"external_user_id" varchar(255) NOT NULL,
	"active_agent_id" text,
	"conversation_version" integer DEFAULT 1 NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "poll_cursor" text;--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "runtime_status" varchar(255) DEFAULT 'stopped' NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "last_error_code" varchar(255);--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "last_error_message" text;--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "poll_lease_owner" varchar(255);--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "poll_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_binding_id_channel_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."channel_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_events" ADD CONSTRAINT "channel_events_session_id_channel_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."channel_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sessions" ADD CONSTRAINT "channel_sessions_binding_id_channel_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."channel_bindings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_events_binding_message_unique" ON "channel_events" USING btree ("binding_id","platform_message_id");--> statement-breakpoint
CREATE INDEX "channel_events_queue_idx" ON "channel_events" USING btree ("status","available_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "channel_events_history_idx" ON "channel_events" USING btree ("session_id","conversation_version","completed_at");--> statement-breakpoint
CREATE INDEX "channel_events_binding_status_idx" ON "channel_events" USING btree ("binding_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_sessions_binding_user_unique" ON "channel_sessions" USING btree ("binding_id","external_user_id");--> statement-breakpoint
CREATE INDEX "channel_sessions_binding_idx" ON "channel_sessions" USING btree ("binding_id");--> statement-breakpoint
CREATE INDEX "channel_bindings_poll_lease_idx" ON "channel_bindings" USING btree ("platform","poll_lease_expires_at");