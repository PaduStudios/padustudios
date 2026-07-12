
-- WhatsApp settings (single row)
CREATE TABLE public.wa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_url text,
  evolution_token text,
  evolution_instance text,
  kb_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_prompt text NOT NULL DEFAULT 'Você é o atendente virtual do Padu Studios, um estúdio de ensaios e gravação. Seja simpático, direto e objetivo. Responda em português brasileiro.',
  enable_faq boolean NOT NULL DEFAULT true,
  enable_scheduling boolean NOT NULL DEFAULT false,
  enable_reminders boolean NOT NULL DEFAULT false,
  webhook_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_settings TO anon, authenticated;
GRANT ALL ON public.wa_settings TO service_role;
ALTER TABLE public.wa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read wa_settings" ON public.wa_settings FOR SELECT USING (true);
CREATE POLICY "public write wa_settings" ON public.wa_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "public update wa_settings" ON public.wa_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete wa_settings" ON public.wa_settings FOR DELETE USING (true);

CREATE TRIGGER wa_settings_updated_at
  BEFORE UPDATE ON public.wa_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conversations
CREATE TABLE public.wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  phone text NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  status text NOT NULL DEFAULT 'bot',
  bot_paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_conversations TO anon, authenticated;
GRANT ALL ON public.wa_conversations TO service_role;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read wa_conversations" ON public.wa_conversations FOR SELECT USING (true);
CREATE POLICY "public write wa_conversations" ON public.wa_conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "public update wa_conversations" ON public.wa_conversations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete wa_conversations" ON public.wa_conversations FOR DELETE USING (true);

CREATE TRIGGER wa_conversations_updated_at
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX wa_conversations_last_message_idx
  ON public.wa_conversations (last_message_at DESC);

-- Messages
CREATE TABLE public.wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  sent_by text NOT NULL DEFAULT 'user',
  text text NOT NULL,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_messages TO anon, authenticated;
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read wa_messages" ON public.wa_messages FOR SELECT USING (true);
CREATE POLICY "public write wa_messages" ON public.wa_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "public update wa_messages" ON public.wa_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete wa_messages" ON public.wa_messages FOR DELETE USING (true);

CREATE INDEX wa_messages_conversation_idx
  ON public.wa_messages (conversation_id, created_at);

-- Reminder tracking on appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Seed single settings row
INSERT INTO public.wa_settings (id) VALUES (gen_random_uuid());
