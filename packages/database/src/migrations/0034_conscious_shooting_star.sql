CREATE TABLE "custom_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"logo" text,
	"base_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_providers" ADD CONSTRAINT "custom_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_providers_user_provider_unique" ON "custom_providers" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "custom_providers_user_id_idx" ON "custom_providers" USING btree ("user_id");