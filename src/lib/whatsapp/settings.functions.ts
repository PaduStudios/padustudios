// WhatsApp automation server functions.
//
// SECURITY: the `wa_*` tables are not reachable from the browser (no anon /
// authenticated grants). Every read/write goes through these server functions
// so credentials (Evolution token, webhook secret) are never sent to the
// client — they are write-only from the UI's point of view.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const kbSchema = z.array(
  z.object({ question: z.string().max(500), answer: z.string().max(4000) })
);

const saveSchema = z.object({
  id: z.string().uuid(),
  evolution_url: z.string().max(500).nullable().optional(),
  evolution_instance: z.string().max(200).nullable().optional(),
  /** Empty string / undefined = keep the stored secret. */
  evolution_token: z.string().max(500).optional(),
  /** Empty string / undefined = keep the stored secret. */
  webhook_secret: z.string().max(500).optional(),
  kb_json: kbSchema.optional(),
  agent_prompt: z.string().max(8000).optional(),
  enable_faq: z.boolean().optional(),
  enable_scheduling: z.boolean().optional(),
  enable_reminders: z.boolean().optional(),
});

export const getWaSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("wa_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  let row = data;
  if (!row) {
    const { data: ins, error: iErr } = await supabaseAdmin
      .from("wa_settings")
      .insert({} as never)
      .select("*")
      .single();
    if (iErr) throw new Error(iErr.message);
    row = ins;
  }

  return {
    id: row!.id,
    evolution_url: row!.evolution_url,
    evolution_instance: row!.evolution_instance,
    kb_json: (Array.isArray(row!.kb_json)
      ? (row!.kb_json as { question?: string; answer?: string }[])
      : []
    ).map((k) => ({ question: String(k?.question ?? ""), answer: String(k?.answer ?? "") })),
    agent_prompt: row!.agent_prompt,
    enable_faq: row!.enable_faq,
    enable_scheduling: row!.enable_scheduling,
    enable_reminders: row!.enable_reminders,
    // Secrets are never returned — only whether they are configured.
    hasToken: Boolean(row!.evolution_token),
    hasWebhookSecret: Boolean(row!.webhook_secret),
  };
});

export const saveWaSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (data.evolution_url !== undefined) patch.evolution_url = data.evolution_url || null;
    if (data.evolution_instance !== undefined)
      patch.evolution_instance = data.evolution_instance || null;
    if (data.evolution_token) patch.evolution_token = data.evolution_token;
    if (data.webhook_secret) patch.webhook_secret = data.webhook_secret;
    if (data.kb_json !== undefined) patch.kb_json = data.kb_json;
    if (data.agent_prompt !== undefined) patch.agent_prompt = data.agent_prompt;
    if (data.enable_faq !== undefined) patch.enable_faq = data.enable_faq;
    if (data.enable_scheduling !== undefined) patch.enable_scheduling = data.enable_scheduling;
    if (data.enable_reminders !== undefined) patch.enable_reminders = data.enable_reminders;

    const { error } = await supabaseAdmin
      .from("wa_settings")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testEvolutionConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { evolutionInstanceStatus, evolutionConnect } = await import(
      "@/lib/whatsapp/evolution.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("wa_settings")
      .select("evolution_url, evolution_token, evolution_instance")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw error ?? new Error("config não encontrada");
    const status = await evolutionInstanceStatus(row);
    if (status.ok && status.state === "open") {
      return {
        connected: true,
        qrcode: null as string | null,
        pairingCode: null as string | null,
        state: status.state,
        error: null as string | null,
      };
    }
    const conn = await evolutionConnect(row);
    return {
      connected: false,
      qrcode: conn.qrcode ?? null,
      pairingCode: conn.pairingCode ?? null,
      state: status.state ?? null,
      error: conn.error ?? status.error ?? null,
    };
  });
