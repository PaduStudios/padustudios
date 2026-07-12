import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { evolutionSendText } from "@/lib/whatsapp/evolution.server";

// Evolution API webhook — receives incoming WhatsApp messages.
// Configure Evolution to POST here at: /api/public/hooks/whatsapp
//
// Security: the caller must include ?token=<webhook_secret> matching
// wa_settings.webhook_secret. Blank secret disables the check (dev only).

type EvolutionEvent = {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
    pushName?: string;
    messageType?: string;
  };
};

function extractText(ev: EvolutionEvent): string | null {
  const m = ev.data?.message;
  return m?.conversation?.trim() || m?.extendedTextMessage?.text?.trim() || null;
}
function extractPhone(ev: EvolutionEvent): string | null {
  const jid = ev.data?.key?.remoteJid;
  if (!jid) return null;
  return jid.replace(/@.*/, "").replace(/\D/g, "");
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const providedToken = url.searchParams.get("token") ?? "";

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );

        const { data: settings, error: sErr } = await supabase
          .from("wa_settings")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (sErr || !settings) {
          return new Response("no settings", { status: 500 });
        }
        if (settings.webhook_secret && settings.webhook_secret !== providedToken) {
          return new Response("unauthorized", { status: 401 });
        }

        const ev = (await request.json().catch(() => null)) as EvolutionEvent | null;
        if (!ev) return new Response("bad json", { status: 400 });

        // Only process inbound user messages
        if (ev.data?.key?.fromMe) return new Response("ignored", { status: 200 });
        if (ev.event && !/message/i.test(ev.event)) {
          return new Response("ignored", { status: 200 });
        }

        const text = extractText(ev);
        const phone = extractPhone(ev);
        if (!text || !phone) return new Response("no text", { status: 200 });

        // Upsert conversation
        const { data: conv } = await supabase
          .from("wa_conversations")
          .upsert(
            {
              phone,
              last_message_at: new Date().toISOString(),
              last_message_preview: text.slice(0, 140),
            },
            { onConflict: "phone" }
          )
          .select("id, status, bot_paused_until")
          .single();
        if (!conv) return new Response("conv error", { status: 500 });

        // Store inbound message
        await supabase.from("wa_messages").insert({
          conversation_id: conv.id,
          direction: "in",
          sent_by: "user",
          text,
          external_id: ev.data?.key?.id ?? null,
        });

        // Should the bot reply?
        const paused =
          conv.bot_paused_until && new Date(conv.bot_paused_until) > new Date();
        if (conv.status === "human" || paused || !settings.enable_faq) {
          return new Response("stored", { status: 200 });
        }

        // Fetch recent context (last 8 msgs)
        const { data: history } = await supabase
          .from("wa_messages")
          .select("direction, text")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(8);
        const recent = (history ?? []).reverse();

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("no ai key", { status: 500 });

        const kb = Array.isArray(settings.kb_json) ? settings.kb_json : [];
        const kbText = (kb as Array<{ question: string; answer: string }>)
          .map((k, i) => `${i + 1}. P: ${k.question}\n   R: ${k.answer}`)
          .join("\n");

        const system = `${settings.agent_prompt}

Base de conhecimento do estúdio (use como fonte de verdade para responder):
${kbText || "(vazia — se não souber, peça para o cliente aguardar um atendente humano)"}

Regras:
- Responda de forma curta (máximo 3 frases).
- Se não souber a resposta com certeza, diga que vai chamar um atendente humano.
- Não invente preços, horários ou endereços que não estejam na base de conhecimento.
- Não peça dados sensíveis (CPF, cartão).`;

        const gateway = createLovableAiGatewayProvider(key);
        let reply: string;
        try {
          const result = await generateText({
            model: gateway("openai/gpt-5.5"),
            system,
            messages: recent.map((m) => ({
              role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
              content: m.text,
            })),
          });
          reply = result.text.trim();
        } catch (e) {
          reply =
            "Desculpe, estou com um probleminha agora. Vou chamar um atendente humano.";
          console.error("AI error", e);
        }
        if (!reply) reply = "Um momento, já te respondo.";

        const send = await evolutionSendText(settings, phone, reply);
        await supabase.from("wa_messages").insert({
          conversation_id: conv.id,
          direction: "out",
          sent_by: "bot",
          text: reply,
          external_id: send.externalId ?? null,
        });
        await supabase
          .from("wa_conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: reply.slice(0, 140),
          })
          .eq("id", conv.id);

        return new Response(JSON.stringify({ ok: true, reply }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
