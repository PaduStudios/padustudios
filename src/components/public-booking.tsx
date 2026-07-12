import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Music2 } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  addMinutesToTime,
  toISODate,
  weekDays,
} from "@/lib/scheduling/time";
import { isSlotFree } from "@/lib/scheduling/availability";
import { cn } from "@/lib/utils";

const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => `${String(DAY_START_HOUR + i).padStart(2, "0")}:00`
);
const DURATION = 120;

export function PublicBooking() {
  const { appointments } = useStore();
  const [anchor, setAnchor] = useState(new Date());
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const [pick, setPick] = useState<{ date: string; start: string } | null>(
    null
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    band: "",
    members: "",
    notes: "",
  });
  const [done, setDone] = useState<null | { date: string; start: string; end: string }>(
    null
  );

  function submit() {
    if (!pick) return;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    const end = addMinutesToTime(pick.start, DURATION);
    if (!isSlotFree(appointments, pick.date, pick.start, end)) {
      toast.error("Este horário acabou de ser ocupado. Escolha outro.");
      setPick(null);
      return;
    }
    const client = store.findClientByPhone(form.phone) ??
      store.addClient({
        name: form.name.trim(),
        phone: form.phone.trim(),
        band: form.band.trim() || undefined,
        members: form.members ? Number(form.members) : undefined,
        origin: "site",
        notes: form.notes.trim() || undefined,
      });
    store.addAppointment({
      clientId: client.id,
      date: pick.date,
      start: pick.start,
      end,
      status: "pending",
      room: "Ensaio",
      price: (80 * DURATION) / 60,
      notes: form.notes.trim() || undefined,
    });
    setDone({ date: pick.date, start: pick.start, end });
  }

  if (done) {
    const d = parse(done.date, "yyyy-MM-dd", new Date());
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md text-center"
        >
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
            style={{ background: "var(--primary)" }}
          >
            <Check className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="mt-6 text-caption">Padu Studios</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Reserva enviada
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Vamos confirmar seu ensaio de{" "}
            <span className="text-foreground">
              {format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>{" "}
            das{" "}
            <span className="font-mono text-foreground">
              {done.start} às {done.end}
            </span>{" "}
            pelo WhatsApp em minutos.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              <Music2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-caption">Padu Studios</p>
              <p className="text-[14px] font-bold tracking-tight">
                Agende seu ensaio
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-muted-foreground hover:text-primary"
          >
            Falar no WhatsApp →
          </a>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:grid-cols-[minmax(0,1fr)_360px]">
        {/* Slot picker */}
        <section className="surface-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-[13px] font-semibold">
              Semana de{" "}
              {format(days[0], "d 'de' MMM", { locale: ptBR })}
            </p>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setAnchor(addDays(anchor, -7))}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAnchor(new Date())}
                className="h-7 rounded px-2 text-[11.5px] font-semibold hover:bg-surface-2"
              >
                Hoje
              </button>
              <button
                onClick={() => setAnchor(addDays(anchor, 7))}
                className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border">
            {days.map((day) => {
              const iso = toISODate(day);
              const today = isSameDay(day, new Date());
              return (
                <div key={iso} className="bg-surface">
                  <div
                    className={cn(
                      "flex flex-col items-center border-b border-border py-2",
                      today && "bg-primary-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        today ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {format(day, "EEE", { locale: ptBR }).replace(".", "")}
                    </span>
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        today && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1 p-1.5">
                    {HOURS.map((h) => {
                      const end = addMinutesToTime(h, DURATION);
                      const free = isSlotFree(appointments, iso, h, end);
                      const isPicked =
                        pick?.date === iso && pick.start === h;
                      return (
                        <button
                          key={h}
                          disabled={!free}
                          onClick={() => setPick({ date: iso, start: h })}
                          className={cn(
                            "flex h-7 w-full items-center justify-center rounded font-mono text-[10.5px] font-medium transition-all",
                            !free &&
                              "cursor-not-allowed bg-surface-2/40 text-muted-foreground/40 line-through",
                            free &&
                              !isPicked &&
                              "bg-surface-2 text-muted-foreground hover:bg-primary-muted hover:text-primary",
                            isPicked &&
                              "bg-primary text-primary-foreground shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--primary)]"
                          )}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Form */}
        <aside className="surface-panel h-fit p-5">
          <p className="text-caption">Seus dados</p>
          <h2 className="mt-1 text-[16px] font-bold tracking-tight">
            {pick
              ? `${format(parse(pick.date, "yyyy-MM-dd", new Date()), "d 'de' MMM", { locale: ptBR })} · ${pick.start}`
              : "Selecione um horário"}
          </h2>
          {pick && (
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Duração 2h · Termina às {addMinutesToTime(pick.start, DURATION)}
            </p>
          )}

          <div className="mt-5 space-y-3">
            <PublicField label="Nome *">
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </PublicField>
            <PublicField label="Telefone *">
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((s) => ({ ...s, phone: maskBrPhoneInput(e.target.value) }))
                }
                placeholder="(11) 98764-1234"
                inputMode="tel"
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </PublicField>

            <PublicField label="Banda">
              <input
                value={form.band}
                onChange={(e) =>
                  setForm((s) => ({ ...s, band: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </PublicField>
            <div className="grid grid-cols-2 gap-3">
              <PublicField label="Integrantes">
                <input
                  value={form.members}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, members: e.target.value }))
                  }
                  type="number"
                  className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
                />
              </PublicField>
            </div>
            <PublicField label="Observações">
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((s) => ({ ...s, notes: e.target.value }))
                }
                rows={2}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary/50"
              />
            </PublicField>
          </div>

          <button
            disabled={!pick}
            onClick={submit}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-bold text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: pick ? "var(--shadow-glow)" : undefined }}
          >
            Reservar agora
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Você recebe a confirmação pelo WhatsApp em minutos.
          </p>
        </aside>
      </main>
    </div>
  );
}

function PublicField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
