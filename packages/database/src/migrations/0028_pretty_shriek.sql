CREATE TABLE "user_skill_files" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"path" text NOT NULL,
	"s3_key" text NOT NULL,
	"size" integer NOT NULL,
	"file_type" varchar(255) NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"version" varchar(64),
	"icon" text,
	"homepage" text,
	"github_owner" varchar(255) NOT NULL,
	"github_repo" varchar(255) NOT NULL,
	"github_branch" varchar(255) NOT NULL,
	"github_path" text,
	"file_count" integer NOT NULL,
	"total_size" integer NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_skill_files" ADD CONSTRAINT "user_skill_files_skill_id_user_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."user_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_skill_files_skill_id_path_unique" ON "user_skill_files" USING btree ("skill_id","path");--> statement-breakpoint
CREATE INDEX "user_skill_files_skill_id_idx" ON "user_skill_files" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_skills_user_id_identifier_unique" ON "user_skills" USING btree ("user_id","identifier");--> statement-breakpoint
CREATE INDEX "user_skills_user_id_idx" ON "user_skills" USING btree ("user_id");