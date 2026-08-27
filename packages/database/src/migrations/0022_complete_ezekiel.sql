CREATE TABLE "chat_tool_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tool_call_id" text NOT NULL,
	"identifier" text NOT NULL,
	"api_name" text NOT NULL,
	"args_hash" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_tool_approvals_status_check" CHECK ("chat_tool_approvals"."status" in ('pending', 'approved', 'denied', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "chat_tool_approvals" ADD CONSTRAINT "chat_tool_approvals_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_approvals" ADD CONSTRAINT "chat_tool_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_tool_approvals_topic_id_idx" ON "chat_tool_approvals" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "chat_tool_approvals_user_id_idx" ON "chat_tool_approvals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_tool_approvals_topic_tool_call_unique" ON "chat_tool_approvals" USING btree ("topic_id","tool_call_id");