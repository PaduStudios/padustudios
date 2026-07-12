import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Zap, Save, QrCode, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { testEvolutionConnection } from "@/lib/whatsapp/settings.functions";
import { cn } from "@/lib/utils";

type KbItem = { question: string; answer: string };
type Settings = {
  id: string;
  evolution_url: string | null;
  evolution_token: string | null;
  evolution_instance: string | null;
  kb_json: KbItem[];
  agent_prompt: string;
  enable_faq: boolean;
  enable_scheduling: boolean;
  enable_reminders: boolean;
  webhook_secret: string | null;
};

export function AutomationView() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [connState, setConnState] = useState<string | null>(null);
  const test = useServerFn(testEvolutionConnection);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("wa_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error("Erro ao carregar configuração");
        setLoading(false);
        return;
      }
      let row = data;
      if (!row) {
        const { data: ins } = await supabase
          .from("wa_settings")
          .insert({})
          .select("*")
          .single();
        row = ins;
      }
      if (row) {
        setS({
          ...row,
          kb_json: Array.isArray(row.kb_json) ? (row.kb_json as KbItem[]) : [],
        });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("wa_settings")
      .update({
        evolution_url: s.evolution_url,
        evolution_token: s.evolution_token,
        evolution_instance: s.evolution_instance,
        kb_json: s.kb_json,
        agent_prompt: s.agent_prompt,
        enable_faq: s.enable_faq,
        enable_scheduling: s.enable_scheduling,
        enable_reminders: s.enable_reminders,
        webhook_secret: s.webhook_secret,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva");
  }

  async function handleTest() {
    if (!s) return;
    setSaving(true);
    // ensure fields are persisted before probing
    await supabase
      .from("wa_settings")
      .update({
        evolution_url: s.evolution_url,
        evolution_token: s.evolution_token,
        evolution_instance: s.evolution_instance,
      })
      .eq("id", s.id);
    setSaving(false);
    setTesting(true);
    try {
      const res = await test({ data: { id: s.id } });
      setConnState(res.state);
      if (res.connected) {
        setQr(null);
        toast.success("WhatsApp conectado!");
      } else if (res.qrcode) {
        setQr(res.qrcode);
        toast.info("Escaneie o QR Code no seu WhatsApp");
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !s) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/hooks/whatsapp${s.webhook_secret ? `?token=${encodeURIComponent(s.webhook_secret)}` : ""}`
      : "";

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Padu Studios
            </p>
            <h1 className="text-[15px] font-semibold tracking-tight">
              Automação · Robô WhatsApp
            </h1>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {/* Connection */}
          <section className="surface-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              <h2 className="text-[13px] font-bold uppercase tracking-wider">
                Conexão Evolution API
              </h2>
              {connState && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    connState === "open"
                      ? "bg-status-confirmed/20 text-status-confirmed"
                      : "bg-status-pending/20 text-status-pending"
                  )}
                >
                  {connState}
                </span>
              )}
            </div>
            <div className="grid gap-3">
              <Field
                label="URL da instância"
                placeholder="https://sua-evolution-api.com"
                value={s.evolution_url ?? ""}
                onChange={(v) => setS({ ...s, evolution_url: v })}
              />
              <Field
                label="Token (apikey)"
                type="password"
                value={s.evolution_token ?? ""}
                onChange={(v) => setS({ ...s, evolution_token: v })}
              />
              <Field
                label="Nome da instância"
                placeholder="padu-studios"
                value={s.evolution_instance ?? ""}
                onChange={(v) => setS({ ...s, evolution_instance: v })}
              />
              <button
                onClick={handleTest}
                disabled={testing || !s.evolution_url || !s.evolution_token || !s.evolution_instance}
                className="flex h-9 items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Conectar / atualizar QR
              </button>
              {qr && (
                <div className="rounded-md border border-border bg-surface-2 p-4 text-center">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Escaneie no WhatsApp → Aparelhos conectados
                  </p>
                  {qr.startsWith("data:") || qr.startsWith("iVBOR") ? (
                    <img
                      src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                      alt="QR Code"
                      className="mx-auto h-56 w-56 rounded bg-white p-2"
                    />
                  ) : (
                    <code className="block break-all rounded bg-background p-3 text-[10px]">
                      {qr}
                    </code>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Webhook */}
          <section className="surface-panel p-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider">
              Webhook
            </h2>
            <p className="mb-2 text-[12px] text-muted-foreground">
              Configure este URL no painel da Evolution como "webhook" para eventos
              de mensagem.
            </p>
            <code className="mb-3 block break-all rounded-md border border-border bg-surface-2 p-3 text-[11px]">
              {webhookUrl}
            </code>
            <Field
              label="Token do webhook (secreto)"
              type="password"
              placeholder="deixe em branco para desabilitar checagem"
              value={s.webhook_secret ?? ""}
              onChange={(v) => setS({ ...s, webhook_secret: v })}
            />
          </section>

          {/* Toggles */}
          <section className="surface-panel p-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider">
              O que o robô faz
            </h2>
            <div className="space-y-2">
              <Toggle
                label="Responder perguntas frequentes"
                hint="Usa a IA e a base de conhecimento abaixo"
                checked={s.enable_faq}
                onChange={(v) => setS({ ...s, enable_faq: v })}
              />
              <Toggle
                label="Agendar ensaios pelo chat"
                hint="Fase 2 — em construção"
                checked={s.enable_scheduling}
                onChange={(v) => setS({ ...s, enable_scheduling: v })}
                disabled
              />
              <Toggle
                label="Confirmação 24h antes"
                hint="Fase 3 — em construção"
                checked={s.enable_reminders}
                onChange={(v) => setS({ ...s, enable_reminders: v })}
                disabled
              />
            </div>
          </section>

          {/* Agent persona */}
          <section className="surface-panel p-5">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider">
              Personalidade do atendente
            </h2>
            <textarea
              value={s.agent_prompt}
              onChange={(e) => setS({ ...s, agent_prompt: e.target.value })}
              rows={4}
              className="w-full resize-y rounded-md border border-border bg-surface p-3 text-[12.5px] outline-none focus:border-border-strong"
            />
          </section>

          {/* KB */}
          <section className="surface-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-bold uppercase tracking-wider">
                Base de conhecimento
              </h2>
              <button
                onClick={() =>
                  setS({
                    ...s,
                    kb_json: [...s.kb_json, { question: "", answer: "" }],
                  })
                }
                className="flex h-8 items-center gap-1 rounded-md border border-border bg-surface-2 px-2.5 text-[11.5px] font-semibold transition-colors hover:bg-surface-3"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
            {s.kb_json.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">
                Nenhuma pergunta cadastrada. Adicione perguntas frequentes e o robô
                aprende como responder.
              </p>
            ) : (
              <ul className="space-y-3">
                {s.kb_json.map((k, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-border bg-surface p-3"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        value={k.question}
                        onChange={(e) => {
                          const next = [...s.kb_json];
                          next[i] = { ...k, question: e.target.value };
                          setS({ ...s, kb_json: next });
                        }}
                        placeholder="Pergunta (ex: Qual o preço da hora?)"
                        className="flex-1 rounded border border-border bg-surface-2 px-2 py-1.5 text-[12.5px] font-semibold outline-none focus:border-border-strong"
                      />
                      <button
                        onClick={() =>
                          setS({
                            ...s,
                            kb_json: s.kb_json.filter((_, j) => j !== i),
                          })
                        }
                        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={k.answer}
                      onChange={(e) => {
                        const next = [...s.kb_json];
                        next[i] = { ...k, answer: e.target.value };
                        setS({ ...s, kb_json: next });
                      }}
                      placeholder="Resposta que o robô deve dar"
                      rows={2}
                      className="w-full resize-y rounded border border-border bg-surface-2 p-2 text-[12.5px] outline-none focus:border-border-strong"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-surface px-3 text-[12.5px] outline-none focus:border-border-strong"
      />
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-md border border-border bg-surface p-3 transition-colors",
        !disabled && "hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div>
        <p className="text-[13px] font-semibold">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}
