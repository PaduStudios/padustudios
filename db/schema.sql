-- Portable schema for the CRM backend.
-- Versioned in Git so the app can move to any Postgres/Supabase-compatible host.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql
--
-- On Lovable Cloud, schema changes still go through the platform migration tool;
-- mirror any change here to keep this file as the portable source of truth.

-- =====================================================================
-- Shared helper: keep updated_at fresh
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- clients
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text NOT NULL,
  email      text,
  cpf        text,
  band       text,
  members    integer,
  origin     text NOT NULL DEFAULT 'other',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_phone_idx ON public.clients (phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read clients"   ON public.clients;
DROP POLICY IF EXISTS "public write clients"  ON public.clients;
DROP POLICY IF EXISTS "public update clients" ON public.clients;
DROP POLICY IF EXISTS "public delete clients" ON public.clients;

CREATE POLICY "public read clients"   ON public.clients FOR SELECT USING (true);
CREATE POLICY "public write clients"  ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "public update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete clients" ON public.clients FOR DELETE USING (true);

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- appointments
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date           date NOT NULL,
  start_time     text NOT NULL,
  end_time       text NOT NULL,
  ends_next_day  boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'confirmed',
  room           text,
  price          numeric,
  payment_method text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointments_client_idx ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS appointments_date_idx   ON public.appointments (date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read appointments"   ON public.appointments;
DROP POLICY IF EXISTS "public write appointments"  ON public.appointments;
DROP POLICY IF EXISTS "public update appointments" ON public.appointments;
DROP POLICY IF EXISTS "public delete appointments" ON public.appointments;

CREATE POLICY "public read appointments"   ON public.appointments FOR SELECT USING (true);
CREATE POLICY "public write appointments"  ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "public update appointments" ON public.appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete appointments" ON public.appointments FOR DELETE USING (true);
