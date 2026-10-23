CREATE TABLE "user_rebates" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_rebates_balance_nonnegative" CHECK ("user_rebates"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"invitee_id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"invitation_id" text,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"rewarded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar(8);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "signup_referral" jsonb;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "referral_reward_id" text;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "monthly_credits" integer;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "rebate_credits" integer;--> statement-breakpoint
ALTER TABLE "user_rebates" ADD CONSTRAINT "user_rebates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_invitation_id_referrals_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."referrals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_rewards_inviter_idx" ON "referral_rewards" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "users_referral_inviter_idx" ON "users" USING btree (("signup_referral"->>'inviterId'));--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_referral_reward_unique" ON "credit_ledger" USING btree ("user_id","referral_reward_id") WHERE "credit_ledger"."reason" = 'referral_reward';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code");