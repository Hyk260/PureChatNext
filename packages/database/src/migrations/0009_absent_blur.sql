CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" varchar(7) NOT NULL,
	"delta" integer NOT NULL,
	"reason" varchar(32) NOT NULL,
	"provider" text,
	"model" text,
	"message_id" text,
	"credits" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"user_id" text NOT NULL,
	"period" varchar(7) NOT NULL,
	"grant" integer NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"topup_balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_user_period_idx" ON "credit_ledger" USING btree ("user_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_chat_usage_message_unique" ON "credit_ledger" USING btree ("message_id") WHERE "credit_ledger"."reason" = 'chat_usage' AND "credit_ledger"."message_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_credits_user_period_unique" ON "user_credits" USING btree ("user_id","period");--> statement-breakpoint
CREATE INDEX "user_credits_period_idx" ON "user_credits" USING btree ("period");