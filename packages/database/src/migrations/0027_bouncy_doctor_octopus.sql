CREATE TABLE "user_provider_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" varchar(32) NOT NULL,
	"key_vaults" text NOT NULL,
	"key_hint" varchar(16) NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_provider_secrets" ADD CONSTRAINT "user_provider_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_provider_secrets_user_provider_unique" ON "user_provider_secrets" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "user_provider_secrets_user_id_idx" ON "user_provider_secrets" USING btree ("user_id");