CREATE TABLE "refresh_token_families" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"family_id" varchar(64) PRIMARY KEY NOT NULL,
	"revoked_at" timestamp with time zone,
	"token_id" varchar(128) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "refresh_token_families_user_id_idx" ON "refresh_token_families" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_token_families_expires_at_idx" ON "refresh_token_families" USING btree ("expires_at");