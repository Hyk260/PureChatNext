ALTER TABLE "channel_bindings" ADD COLUMN "provider" varchar(255);--> statement-breakpoint
ALTER TABLE "channel_bindings" ADD COLUMN "model" varchar(255);--> statement-breakpoint
UPDATE "channel_bindings" AS "binding"
SET
  "provider" = CASE
    WHEN NULLIF(TRIM("agent"."provider"), '') IN ('purechat', 'purehub') THEN 'purechat'
    WHEN NULLIF(TRIM("agent"."provider"), '') IN ('openai', 'deepseek')
      THEN NULLIF(TRIM("agent"."provider"), '')
    ELSE 'deepseek'
  END,
  "model" = CASE
    WHEN NULLIF(TRIM("agent"."provider"), '') IN ('purechat', 'purehub')
      THEN COALESCE(NULLIF(TRIM("agent"."model"), ''), 'gpt-5.4-mini')
    WHEN NULLIF(TRIM("agent"."provider"), '') = 'openai'
      THEN COALESCE(NULLIF(TRIM("agent"."model"), ''), 'gpt-5.4-mini')
    WHEN NULLIF(TRIM("agent"."provider"), '') = 'deepseek'
      THEN COALESCE(NULLIF(TRIM("agent"."model"), ''), 'deepseek-v4-flash')
    ELSE 'deepseek-v4-flash'
  END
FROM "agents" AS "agent"
WHERE "binding"."platform" = 'wechat' AND "binding"."agent_id" = "agent"."id";--> statement-breakpoint
UPDATE "channel_bindings"
SET "provider" = 'deepseek', "model" = 'deepseek-v4-flash'
WHERE "platform" = 'wechat' AND ("provider" IS NULL OR "model" IS NULL);
