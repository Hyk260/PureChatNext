ALTER TABLE "channel_bindings" RENAME COLUMN "poll_lease_owner" TO "gateway_lease_owner";--> statement-breakpoint
ALTER TABLE "channel_bindings" RENAME COLUMN "poll_lease_expires_at" TO "gateway_lease_expires_at";--> statement-breakpoint
ALTER INDEX "channel_bindings_poll_lease_idx" RENAME TO "channel_bindings_gateway_lease_idx";
