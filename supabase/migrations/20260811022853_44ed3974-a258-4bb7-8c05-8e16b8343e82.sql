-- wa_settings: contains Evolution API token and webhook secret. Never expose to the browser.
DROP POLICY IF EXISTS "public read wa_settings" ON public.wa_settings;
DROP POLICY IF EXISTS "public write wa_settings" ON public.wa_settings;
DROP POLICY IF EXISTS "public update wa_settings" ON public.wa_settings;
DROP POLICY IF EXISTS "public delete wa_settings" ON public.wa_settings;
REVOKE ALL ON public.wa_settings FROM anon, authenticated;

DROP POLICY IF EXISTS "public read wa_conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "public write wa_conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "public update wa_conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "public delete wa_conversations" ON public.wa_conversations;
REVOKE ALL ON public.wa_conversations FROM anon, authenticated;

DROP POLICY IF EXISTS "public read wa_messages" ON public.wa_messages;
DROP POLICY IF EXISTS "public write wa_messages" ON public.wa_messages;
DROP POLICY IF EXISTS "public update wa_messages" ON public.wa_messages;
DROP POLICY IF EXISTS "public delete wa_messages" ON public.wa_messages;
REVOKE ALL ON public.wa_messages FROM anon, authenticated;

GRANT ALL ON public.wa_settings TO service_role;
GRANT ALL ON public.wa_conversations TO service_role;
GRANT ALL ON public.wa_messages TO service_role;