-- Supabase exposes the public schema through the Data API. This application
-- uses a server-side PostgreSQL connection instead, so no API role should
-- access the application tables directly.
DO $$
DECLARE
	table_name text;
BEGIN
	FOR table_name IN
		SELECT c.relname
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind = 'r'
	LOOP
		EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
		EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
		EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
	END LOOP;
END
$$;
--> statement-breakpoint

-- Keep future tables locked down when they are created by the migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
--> statement-breakpoint

-- These legacy public functions are not used by the application and must not
-- be callable through /rest/v1/rpc. Keep service-side ownership access intact.
REVOKE EXECUTE ON FUNCTION public.authenticate_user(text, text) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_user(text, text, boolean) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.trigger_set_updated_at() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- Pin the function search path so a future object in an earlier search-path
-- position cannot change function resolution.
ALTER FUNCTION public.authenticate_user(text, text) SET search_path = pg_catalog, public, extensions;
--> statement-breakpoint
ALTER FUNCTION public.create_user(text, text, boolean) SET search_path = pg_catalog, public, extensions;
--> statement-breakpoint
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = pg_catalog, public, extensions;
