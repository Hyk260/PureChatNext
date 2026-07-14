CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"role" varchar(32) NOT NULL,
	"content" text,
	"parts" jsonb,
	"model" text,
	"provider" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"title" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_topic_id_chat_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."chat_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_topics" ADD CONSTRAINT "chat_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_topic_id_created_at_idx" ON "chat_messages" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_user_id_topic_id_idx" ON "chat_messages" USING btree ("user_id","topic_id");--> statement-breakpoint
CREATE INDEX "chat_topics_user_id_agent_id_idx" ON "chat_topics" USING btree ("user_id","agent_id");--> statement-breakpoint
CREATE INDEX "chat_topics_user_id_updated_at_idx" ON "chat_topics" USING btree ("user_id","updated_at" DESC NULLS LAST);