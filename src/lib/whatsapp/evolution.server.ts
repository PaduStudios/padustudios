// WhatsApp / Evolution API adapter. Server-only.
// A thin wrapper around Evolution API's REST endpoints so we can swap
// providers (Meta Cloud API, Twilio) later without touching business logic.

export type EvolutionSettings = {
  url: string;
  token: string;
  instance: string;
};

function requireSettings(s: {
  evolution_url: string | null;
  evolution_token: string | null;
  evolution_instance: string | null;
}): EvolutionSettings {
  if (!s.evolution_url || !s.evolution_token || !s.evolution_instance) {
    throw new Error("Evolution API não configurada");
  }
  return {
    url: s.evolution_url.replace(/\/+$/, ""),
    token: s.evolution_token,
    instance: s.evolution_instance,
  };
}

export async function evolutionSendText(
  settings: Parameters<typeof requireSettings>[0],
  toPhone: string,
  text: string
): Promise<{ ok: boolean; error?: string; externalId?: string }> {
  try {
    const s = requireSettings(settings);
    const digits = toPhone.replace(/\D/g, "");
    const res = await fetch(`${s.url}/message/sendText/${s.instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: s.token,
      },
      body: JSON.stringify({
        number: digits,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Evolution ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
    return { ok: true, externalId: data.key?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function evolutionInstanceStatus(
  settings: Parameters<typeof requireSettings>[0]
): Promise<{ ok: boolean; state?: string; qrcode?: string; error?: string }> {
  try {
    const s = requireSettings(settings);
    const res = await fetch(`${s.url}/instance/connectionState/${s.instance}`, {
      headers: { apikey: s.token },
    });
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${await res.text()}` };
    }
    const data = (await res.json()) as {
      instance?: { state?: string };
      state?: string;
    };
    return { ok: true, state: data.instance?.state ?? data.state };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function evolutionConnect(
  settings: Parameters<typeof requireSettings>[0]
): Promise<{ ok: boolean; qrcode?: string; pairingCode?: string; error?: string }> {
  try {
    const s = requireSettings(settings);
    const res = await fetch(`${s.url}/instance/connect/${s.instance}`, {
      headers: { apikey: s.token },
    });
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${await res.text()}` };
    }
    const data = (await res.json()) as {
      code?: string;
      base64?: string;
      pairingCode?: string;
      qrcode?: { code?: string; base64?: string };
    };
    const qr = data.base64 ?? data.qrcode?.base64 ?? data.code ?? data.qrcode?.code;
    return { ok: true, qrcode: qr, pairingCode: data.pairingCode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
