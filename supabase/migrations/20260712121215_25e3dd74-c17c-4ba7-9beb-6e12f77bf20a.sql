CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  category text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO anon, authenticated;
GRANT ALL ON public.finance_entries TO service_role;

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read finance_entries" ON public.finance_entries FOR SELECT USING (true);
CREATE POLICY "public write finance_entries" ON public.finance_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "public update finance_entries" ON public.finance_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete finance_entries" ON public.finance_entries FOR DELETE USING (true);

CREATE TRIGGER finance_entries_updated_at
BEFORE UPDATE ON public.finance_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();