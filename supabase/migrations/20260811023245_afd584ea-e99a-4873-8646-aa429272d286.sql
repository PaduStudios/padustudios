-- ── Roles ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users read own roles" ON public.user_roles
FOR SELECT TO authenticated USING (user_id = auth.uid());

-- First account created becomes the studio admin.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_first_admin();

-- ── clients ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read clients" ON public.clients;
DROP POLICY IF EXISTS "public write clients" ON public.clients;
DROP POLICY IF EXISTS "public update clients" ON public.clients;
DROP POLICY IF EXISTS "public delete clients" ON public.clients;
REVOKE ALL ON public.clients FROM anon, authenticated;
GRANT INSERT ON public.clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

CREATE POLICY "admin reads clients" ON public.clients
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "site booking creates clients" ON public.clients
FOR INSERT TO anon WITH CHECK (origin = 'site');
CREATE POLICY "admin creates clients" ON public.clients
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates clients" ON public.clients
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deletes clients" ON public.clients
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── appointments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read appointments" ON public.appointments;
DROP POLICY IF EXISTS "public write appointments" ON public.appointments;
DROP POLICY IF EXISTS "public update appointments" ON public.appointments;
DROP POLICY IF EXISTS "public delete appointments" ON public.appointments;
REVOKE ALL ON public.appointments FROM anon, authenticated;
GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

-- Busy slots stay public so the calendar/booking page can show availability.
CREATE POLICY "public reads appointments" ON public.appointments
FOR SELECT USING (true);
CREATE POLICY "site booking requests appointment" ON public.appointments
FOR INSERT TO anon
WITH CHECK (status = 'pending' AND date >= current_date);
CREATE POLICY "admin creates appointments" ON public.appointments
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates appointments" ON public.appointments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin deletes appointments" ON public.appointments
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ── finance_entries ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read finance_entries" ON public.finance_entries;
DROP POLICY IF EXISTS "public write finance_entries" ON public.finance_entries;
DROP POLICY IF EXISTS "public update finance_entries" ON public.finance_entries;
DROP POLICY IF EXISTS "public delete finance_entries" ON public.finance_entries;
REVOKE ALL ON public.finance_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;

CREATE POLICY "admin manages finance" ON public.finance_entries
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── internal_events ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read internal_events" ON public.internal_events;
DROP POLICY IF EXISTS "public write internal_events" ON public.internal_events;
DROP POLICY IF EXISTS "public update internal_events" ON public.internal_events;
DROP POLICY IF EXISTS "public delete internal_events" ON public.internal_events;
REVOKE ALL ON public.internal_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_events TO authenticated;
GRANT ALL ON public.internal_events TO service_role;

CREATE POLICY "admin manages internal events" ON public.internal_events
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));