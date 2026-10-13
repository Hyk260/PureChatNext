CREATE TABLE "channel_gateway_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" varchar(255) NOT NULL,
	"binding_id" text,
	"event" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"code" varchar(255),
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_gateway_logs" ADD CONSTRAINT "channel_gateway_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_gateway_logs_owner_idx" ON "channel_gateway_logs" USING btree ("user_id","platform","created_at","id");--> statement-breakpoint
CREATE INDEX "channel_gateway_logs_expiry_idx" ON "channel_gateway_logs" USING btree ("created_at");