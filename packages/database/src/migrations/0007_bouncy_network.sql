CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"user_id" text,
	"title" varchar(255) NOT NULL,
	"description" varchar(1000),
	"avatar" text,
	"background_color" text,
	"system_role" text,
	"model" text,
	"provider" text,
	"params" jsonb DEFAULT '{}'::jsonb,
	"pinned" boolean DEFAULT false,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"market_identifier" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_slug_builtin_unique" ON "agents" USING btree ("slug") WHERE "agents"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_slug_user_id_unique" ON "agents" USING btree ("user_id","slug") WHERE "agents"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "agents_user_id_idx" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agents_is_builtin_idx" ON "agents" USING btree ("is_builtin");--> statement-breakpoint
CREATE INDEX "agents_list_order_idx" ON "agents" USING btree ("is_builtin" DESC NULLS LAST,"pinned" DESC NULLS LAST,"sort","updated_at" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "agents" (
  "id",
  "slug",
  "user_id",
  "title",
  "description",
  "avatar",
  "system_role",
  "pinned",
  "is_builtin",
  "sort"
) VALUES (
  'agt_inbox',
  'inbox',
  NULL,
  'Pure AI',
  '你的默认 AI 助手',
  '✨',
  E'你是 Pure AI，一位友好、清晰、务实的助手。\n回答保持结构清楚、可执行；不确定时主动说明假设。',
  true,
  true,
  0
) ON CONFLICT ("id") DO NOTHING;