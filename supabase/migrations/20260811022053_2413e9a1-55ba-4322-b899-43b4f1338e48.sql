CREATE TABLE public.internal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_events TO authenticated;
GRANT ALL ON public.internal_events TO service_role;

ALTER TABLE public.internal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read internal_events" ON public.internal_events FOR SELECT USING (true);
CREATE POLICY "public write internal_events" ON public.internal_events FOR INSERT WITH CHECK (true);
CREATE POLICY "public update internal_events" ON public.internal_events FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete internal_events" ON public.internal_events FOR DELETE USING (true);

CREATE TRIGGER internal_events_updated_at BEFORE UPDATE ON public.internal_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();