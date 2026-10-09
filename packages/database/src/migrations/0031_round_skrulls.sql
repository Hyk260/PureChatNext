CREATE TABLE "referral_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"request_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"reservations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"message_id" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "referral_batches" ADD CONSTRAINT "referral_batches_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_batches_inviter_key_idx" ON "referral_batches" USING btree ("inviter_id","request_key");--> statement-breakpoint
CREATE INDEX "referrals_inviter_created_idx" ON "referrals" USING btree ("inviter_id","created_at","id");--> statement-breakpoint
CREATE INDEX "referrals_inviter_email_idx" ON "referrals" USING btree ("inviter_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_accepted_user_idx" ON "referrals" USING btree ("accepted_user_id");