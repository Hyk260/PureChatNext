CREATE TABLE "task_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"result" text,
	"error" text,
	"diagnostics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_runs_status_check" CHECK ("task_runs"."status" in ('pending', 'running', 'retry', 'succeeded', 'failed', 'canceled', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "task_scheduler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"heartbeat_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"instruction" text NOT NULL,
	"agent_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule" jsonb NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" between 0 and 4),
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('todo', 'review', 'completed', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "task_deliveries" ADD CONSTRAINT "task_deliveries_run_id_task_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."task_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_deliveries" ADD CONSTRAINT "task_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_deliveries_run_platform_idx" ON "task_deliveries" USING btree ("run_id","platform");--> statement-breakpoint
CREATE INDEX "task_deliveries_queue_idx" ON "task_deliveries" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "task_runs_dedupe_idx" ON "task_runs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "task_runs_user_running_idx" ON "task_runs" USING btree ("user_id") WHERE "task_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "task_runs_queue_idx" ON "task_runs" USING btree ("status","available_at","lease_expires_at");--> statement-breakpoint
CREATE INDEX "task_runs_history_idx" ON "task_runs" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("next_run_at") WHERE "tasks"."enabled" = true;