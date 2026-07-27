CREATE TABLE "channel_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" varchar(255) NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"credentials" text NOT NULL,
	"agent_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"needs_rebind" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD CONSTRAINT "channel_bindings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_bindings_user_platform_unique" ON "channel_bindings" USING btree ("user_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_bindings_platform_app_unique" ON "channel_bindings" USING btree ("platform","application_id");--> statement-breakpoint
CREATE INDEX "channel_bindings_enabled_idx" ON "channel_bindings" USING btree ("enabled","platform");