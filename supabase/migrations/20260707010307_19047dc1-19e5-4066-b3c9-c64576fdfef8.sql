
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  cpf TEXT,
  band TEXT,
  members INTEGER,
  origin TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clients_phone_idx ON public.clients (phone);

CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  ends_next_day BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'confirmed',
  room TEXT,
  price NUMERIC,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX appointments_date_idx ON public.appointments (date);
CREATE INDEX appointments_client_idx ON public.appointments (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Temporary open policies until admin auth is added
CREATE POLICY "public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "public write clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "public update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete clients" ON public.clients FOR DELETE USING (true);

CREATE POLICY "public read appointments" ON public.appointments FOR SELECT USING (true);
CREATE POLICY "public write appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "public update appointments" ON public.appointments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete appointments" ON public.appointments FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
