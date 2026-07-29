ALTER TABLE "credit_ledger" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "cached_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_at_idx" ON "credit_ledger" USING btree ("user_id","created_at");