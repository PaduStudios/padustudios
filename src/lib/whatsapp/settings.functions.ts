// WhatsApp automation server functions.
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export type WaKbItem = { question: string; answer: string };
export type WaSettings = {
  id: string;
  evolution_url: string | null;
  evolution_token: string | null;
  evolution_instance: string | null;
  kb_json: WaKbItem[];
  agent_prompt: string;
  enable_faq: boolean;
  enable_scheduling: boolean;
  enable_reminders: boolean;
};

async function loadSettingsRow() {
  const { data, error } = await supabase
    .from("wa_settings")
    .select(
      "id, evolution_url, evolution_token, evolution_instance, kb_json, agent_prompt, enable_faq, enable_scheduling, enable_reminders"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: inserted, error: insErr } = await supabase
      .from("wa_settings")
      .insert({})
      .select(
        "id, evolution_url, evolution_token, evolution_instance, kb_json, agent_prompt, enable_faq, enable_scheduling, enable_reminders"
      )
      .single();
    if (insErr) throw insErr;
    return inserted;
  }
  return data;
}

export const getWaSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<WaSettings> => {
    const r = await loadSettingsRow();
    return {
      id: r.id,
      evolution_url: r.evolution_url,
      evolution_token: r.evolution_token,
      evolution_instance: r.evolution_instance,
      kb_json: Array.isArray(r.kb_json) ? (r.kb_json as WaKbItem[]) : [],
      agent_prompt: r.agent_prompt,
      enable_faq: r.enable_faq,
      enable_scheduling: r.enable_scheduling,
      enable_reminders: r.enable_reminders,
    };
  }
);

export const saveWaSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as Partial<WaSettings> & { id: string })
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {};
    for (const key of [
      "evolution_url",
      "evolution_token",
      "evolution_instance",
      "kb_json",
      "agent_prompt",
      "enable_faq",
      "enable_scheduling",
      "enable_reminders",
    ] as const) {
      if (key in data) patch[key] = (data as Record<string, unknown>)[key];
    }
    const { error } = await supabase.from("wa_settings").update(patch as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const testEvolutionConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { id: string })
  .handler(async ({ data }) => {
    const { evolutionInstanceStatus, evolutionConnect } = await import(
      "@/lib/whatsapp/evolution.server"
    );
    const { data: row, error } = await supabase
      .from("wa_settings")
      .select("evolution_url, evolution_token, evolution_instance")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw error ?? new Error("config não encontrada");
    const status = await evolutionInstanceStatus(row);
    if (status.ok && status.state === "open") {
      return { connected: true, qrcode: null, state: status.state };
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
