import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  CalendarCheck,
  Users,
  Wallet,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { toISODate } from "@/lib/scheduling/time";
import { cn } from "@/lib/utils";

const CHURN_MIN_APPTS = 3;
const CHURN_DAYS_INACTIVE = 30;

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function DashboardView() {
  const { appointments, clients, finance } = useStore();

  const stats = useMemo(() => {
    const todayISO = toISODate(new Date());
    const monthISO = todayISO.slice(0, 7);
    const now = Date.now();

    const todayList = appointments
      .filter((a) => a.date === todayISO && a.status !== "cancelled")
      .sort((a, b) => a.start.localeCompare(b.start));

    const upcoming = appointments
      .filter((a) => a.date >= todayISO && a.status !== "cancelled")
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
      .slice(0, 6);

    const monthAppts = appointments.filter(
      (a) => monthKey(a.date) === monthISO && a.status !== "cancelled" && a.status !== "blocked"
    );
    const monthRevenue = monthAppts.reduce((s, a) => s + (a.price ?? 0), 0);
    const monthExpense = finance
      .filter((f) => monthKey(f.date) === monthISO && f.kind === "expense")
      .reduce((s, f) => s + f.amount, 0);
    const monthIncomeManual = finance
      .filter((f) => monthKey(f.date) === monthISO && f.kind === "income")
      .reduce((s, f) => s + f.amount, 0);
    const balance = monthRevenue + monthIncomeManual - monthExpense;

    // Occupancy this week (Mon-Sun)
    const day = new Date();
    const dow = (day.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(day.getFullYear(), day.getMonth(), day.getDate() - dow);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekAppts = appointments.filter((a) => {
      const t = Date.parse(a.date);
      return (
        !isNaN(t) &&
        t >= weekStart.getTime() &&
        t <= weekEnd.getTime() &&
        a.status !== "cancelled"
      );
    });
    const bookedMin = weekAppts.reduce(
      (s, a) => s + (timeToMin(a.end) - timeToMin(a.start)),
      0
    );
    const occupancy = Math.round((bookedMin / (7 * 16 * 60)) * 100);

    // Churn
    const cutoff = now - CHURN_DAYS_INACTIVE * 24 * 60 * 60 * 1000;
    const byClient = new Map<string, { count: number; lastMs: number }>();
    for (const a of appointments) {
      if (a.status === "cancelled" || a.status === "blocked") continue;
      const t = Date.parse(a.date);
      if (isNaN(t)) continue;
      const cur = byClient.get(a.clientId);
      if (!cur) byClient.set(a.clientId, { count: 1, lastMs: t });
      else {
        cur.count++;
        if (t > cur.lastMs) cur.lastMs = t;
      }
    }
    let churnCount = 0;
    for (const [, v] of byClient) {
      if (v.count >= CHURN_MIN_APPTS && v.lastMs < cutoff) churnCount++;
    }

    return {
      todayList,
      upcoming,
      monthRevenue,
      monthExpense,
      monthIncomeManual,
      balance,
      occupancy,
      churnCount,
      totalClients: clients.length,
    };
  }, [appointments, clients, finance]);

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c] as const)),
    [clients]
  );

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div>
          <p className="text-caption">Padu OS</p>
          <h1 className="text-[15px] font-semibold tracking-tight">Dashboard</h1>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top metrics */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          <StatCard
            icon={CalendarCheck}
            label="Ensaios hoje"
            value={String(stats.todayList.length)}
            hint={
              stats.todayList.length
                ? `próximo às ${stats.todayList[0].start}`
                : "sem agenda"
            }
          />
          <StatCard
            icon={TrendingUp}
            label="Ocupação semana"
            value={`${stats.occupancy}%`}
            hint="16h úteis/dia · seg–dom"
            progress={stats.occupancy}
          />
          <StatCard
            icon={Wallet}
            label="Saldo do mês"
            value={formatBRL(stats.balance)}
            hint={`${formatBRL(stats.monthRevenue + stats.monthIncomeManual)} entradas · ${formatBRL(stats.monthExpense)} saídas`}
            tone={stats.balance >= 0 ? "positive" : "negative"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Clientes sumidos"
            value={String(stats.churnCount)}
            hint={`≥${CHURN_MIN_APPTS} ensaios, ${CHURN_DAYS_INACTIVE}+ dias sem vir`}
            tone={stats.churnCount > 0 ? "warning" : "default"}
          />
        </motion.div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Today's schedule */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="surface-panel p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Ensaios de hoje</h2>
              <Link
                to="/calendar"
                className="text-[11.5px] font-semibold text-primary hover:underline"
              >
                Ver calendário →
              </Link>
            </div>
            {stats.todayList.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                Nenhum ensaio hoje.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {stats.todayList.map((a) => {
                  const c = clientMap.get(a.clientId);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-surface-2/40 px-3 py-2"
                    >
                      <span className="font-mono text-[11.5px] text-muted-foreground">
                        {a.start}–{a.end}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {c?.band || c?.name || "—"}
                      </span>
                      {a.room && (
                        <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {a.room}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>

          {/* Upcoming */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="surface-panel p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold">Próximos ensaios</h2>
              <span className="text-[11px] text-muted-foreground">
                {stats.totalClients} clientes na base
              </span>
            </div>
            {stats.upcoming.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                Sem agendamentos futuros.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {stats.upcoming.map((a) => {
                  const c = clientMap.get(a.clientId);
                  const d = new Date(a.date + "T00:00:00");
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-surface-2/40 px-3 py-2"
                    >
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          {d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)}
                        </p>
                        <p className="text-[13px] font-semibold tabular-nums leading-none">
                          {String(d.getDate()).padStart(2, "0")}
                        </p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          {c?.band || c?.name || "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.start}–{a.end}
                          {a.room ? ` · ${a.room}` : ""}
                        </p>
                      </div>
                      {a.status === "pending" && (
                        <span className="rounded-md bg-[color:var(--status-pending)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--status-pending)]">
                          pend.
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 md:grid-cols-3">
          <QuickLink to="/finance" icon={Wallet} label="Financeiro" hint="Lançar entradas e saídas" />
          <QuickLink to="/crm" icon={Users} label="CRM & Retenção" hint={`${stats.churnCount} sumidos aguardando contato`} />
          <QuickLink to="/clients" icon={CalendarCheck} label="Clientes" hint={`${stats.totalClients} no cadastro`} />
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  progress,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-[color:var(--success)]",
    negative: "text-destructive",
    warning: "text-[color:var(--status-pending)]",
  }[tone];
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-3.5 w-3.5", tone === "default" ? "text-muted-foreground" : toneClass)} />
      </div>
      <p className={cn("mt-3 text-[24px] font-bold tabular-nums leading-none", toneClass)}>
        {value}
      </p>
      {hint && <p className="mt-2 text-[11.5px] text-muted-foreground">{hint}</p>}
      {typeof progress === "number" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.6 }}
            className="h-full bg-primary"
          />
        </div>
      )}
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: "/finance" | "/crm" | "/clients";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="surface-panel flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-primary-muted/20"
    >
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-muted text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}
