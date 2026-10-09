CREATE TABLE "desktop_auth_codes" (
	"code_hash" varchar(128) PRIMARY KEY NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"code_challenge" varchar(128) NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redirect_uri" text NOT NULL,
	"state" varchar(256) NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "desktop_auth_codes" ADD CONSTRAINT "desktop_auth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desktop_auth_codes_expires_at_idx" ON "desktop_auth_codes" USING btree ("expires_at");