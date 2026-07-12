// WhatsApp automation server functions. Server-only Supabase client used
// so this module can run inside createServerFn handlers.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function serverSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export const testEvolutionConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { id: string })
  .handler(async ({ data }) => {
    const { evolutionInstanceStatus, evolutionConnect } = await import(
      "@/lib/whatsapp/evolution.server"
    );
    const sb = serverSupabase();
    const { data: row, error } = await sb
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
