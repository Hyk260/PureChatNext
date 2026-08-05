-- Rename legacy PureHub provider id to PureChat across stored provider columns.
UPDATE "credit_ledger" SET "provider" = 'purechat' WHERE "provider" = 'purehub';--> statement-breakpoint
UPDATE "chat_messages" SET "provider" = 'purechat' WHERE "provider" = 'purehub';--> statement-breakpoint
UPDATE "agents" SET "provider" = 'purechat' WHERE "provider" = 'purehub';
