CREATE TABLE "chat_topic_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"visibility" text DEFAULT 'link' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_topic_shares" ADD CONSTRAINT "chat_topic_shares_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_topic_shares" ADD CONSTRAINT "chat_topic_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_topic_shares_topic_id_unique" ON "chat_topic_shares" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "chat_topic_shares_user_id_idx" ON "chat_topic_shares" USING btree ("user_id");