import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { store } from "@/lib/scheduling/store";
import { cn } from "@/lib/utils";
import type { Appointment, Client, FinanceEntry, FinanceKind } from "@/lib/scheduling/types";

const EXPENSE_CATEGORIES = [
  "Aluguel / contas",
  "Equipamento",
  "Marketing",
  "Outros",
];

const INCOME_CATEGORIES = [
  "Outras entradas",
  "Venda avulsa",
  "Aula",
  "Outros",
];

type LedgerRow =
  | {
      kind: "appointment";
      id: string;
      date: string;
      amount: number;
      label: string;
      sublabel: string;
      status: Appointment["status"];
      paid: boolean;
    }
  | {
      kind: "income" | "expense";
      id: string;
      date: string;
      amount: number;
      label: string;
      sublabel: string;
    };

function monthKey(iso: string) {
  return iso.slice(0, 7); // yyyy-mm
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatMonthLabel(d: Date) {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function FinanceView() {
  const { appointments, clients, finance } = useStore();
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => firstOfMonth(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c] as const)),
    [clients]
  );

  const targetMonth = `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`;

  const { rows, income, expense, pending, apptCount } = useMemo(() => {
    const rows: LedgerRow[] = [];
    let income = 0;
    let expense = 0;
    let pending = 0;
    let apptCount = 0;

    for (const a of appointments) {
      if (monthKey(a.date) !== targetMonth) continue;
      if (a.status === "cancelled" || a.status === "blocked") continue;
      const amount = a.price ?? 0;
      const paid = a.status === "confirmed" && !!a.paymentMethod;
      const c = clientMap.get(a.clientId);
      rows.push({
        kind: "appointment",
        id: a.id,
        date: a.date,
        amount,
        label: c ? c.band || c.name : "Cliente removido",
        sublabel: `${a.start}–${a.end}${a.room ? ` · ${a.room}` : ""}${paid ? ` · ${a.paymentMethod}` : a.status === "pending" ? " · pendente" : ""}`,
        status: a.status,
        paid,
      });
      apptCount += 1;
      if (amount > 0) {
        if (paid) income += amount;
        else if (a.status === "pending") pending += amount;
        else income += amount; // confirmed sem método marcado como recebido
      }
    }

    for (const f of finance) {
      if (monthKey(f.date) !== targetMonth) continue;
      rows.push({
        kind: f.kind,
        id: f.id,
        date: f.date,
        amount: f.amount,
        label: f.description || f.category,
        sublabel: f.description ? f.category : "manual",
      });
      if (f.kind === "income") income += f.amount;
      else expense += f.amount;
    }

    rows.sort((a, b) => b.date.localeCompare(a.date));
    return { rows, income, expense, pending, apptCount };
  }, [appointments, clientMap, finance, targetMonth]);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/70 px-6 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-4">
          <div>
            <p className="text-caption">Padu OS</p>
            <h1 className="text-[15px] font-semibold tracking-tight">Financeiro</h1>
          </div>
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
            <button
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMonthAnchor(firstOfMonth(new Date()))}
              className="h-7 rounded-md px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-2"
            >
              {formatMonthLabel(monthAnchor)}
            </button>
            <button
              onClick={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <Plus className="h-4 w-4" />
          Novo lançamento
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          <MetricCard
            icon={ArrowUpRight}
            label="Entradas"
            value={formatBRL(income)}
            hint={`${apptCount} ensaios no mês`}
            tone="income"
          />
          <MetricCard
            icon={ArrowDownRight}
            label="Saídas"
            value={formatBRL(expense)}
            hint="Lançamentos manuais"
            tone="expense"
          />
          <MetricCard
            icon={Wallet}
            label="Saldo do mês"
            value={formatBRL(income - expense)}
            hint={income - expense >= 0 ? "no verde" : "no vermelho"}
            tone={income - expense >= 0 ? "income" : "expense"}
          />
          <MetricCard
            icon={Clock}
            label="A receber"
            value={formatBRL(pending)}
            hint="Ensaios pendentes"
            tone="pending"
          />
        </motion.div>

        {/* Ledger */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="surface-panel mt-6 overflow-hidden"
        >
          <div className="grid grid-cols-[80px_minmax(0,1fr)_140px_140px_60px] border-b border-border px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <span>Data</span>
            <span>Descrição</span>
            <span className="text-right">Categoria</span>
            <span className="text-right">Valor</span>
            <span />
          </div>
          <ul>
            {rows.map((r, i) => (
              <li
                key={`${r.kind}-${r.id}`}
                className={cn(
                  "grid grid-cols-[80px_minmax(0,1fr)_140px_140px_60px] items-center gap-2 border-b border-border px-5 py-3 text-[13px] last:border-b-0",
                  i % 2 === 1 && "bg-surface-2/20"
                )}
              >
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {formatDate(r.date)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.sublabel}
                  </p>
                </div>
                <span className="text-right text-[11.5px] text-muted-foreground">
                  {r.kind === "appointment" ? (
                    <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                      Ensaio
                    </span>
                  ) : r.kind === "income" ? (
                    "Entrada manual"
                  ) : (
                    "Saída"
                  )}
                </span>
                <span
                  className={cn(
                    "text-right font-mono font-semibold tabular-nums",
                    r.kind === "expense"
                      ? "text-destructive"
                      : r.kind === "appointment" && !("paid" in r && r.paid) && r.status === "pending"
                        ? "text-[color:var(--status-pending)]"
                        : "text-[color:var(--success)]"
                  )}
                >
                  {r.kind === "expense" ? "− " : "+ "}
                  {formatBRL(r.amount)}
                </span>
                <span className="flex justify-end">
                  {r.kind !== "appointment" ? (
                    <button
                      onClick={() => {
                        if (confirm("Remover este lançamento?")) {
                          store.deleteFinance(r.id);
                        }
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-5 py-12 text-center text-[13px] text-muted-foreground">
                Sem movimentação em {formatMonthLabel(monthAnchor)}. Adicione um
                lançamento manual ou marque ensaios no calendário.
              </li>
            )}
          </ul>
        </motion.div>
      </div>

      <NewEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={targetMonth === monthKey(new Date().toISOString().slice(0, 10))
          ? new Date().toISOString().slice(0, 10)
          : `${targetMonth}-01`}
      />
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: "income" | "expense" | "pending";
}) {
  const color =
    tone === "income"
      ? "text-[color:var(--success)]"
      : tone === "expense"
        ? "text-destructive"
        : "text-[color:var(--status-pending)]";
  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <p className={cn("mt-3 text-[24px] font-bold tabular-nums leading-none", color)}>
        {value}
      </p>
      <p className="mt-2 text-[11.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function NewEntryDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
}) {
  const [kind, setKind] = useState<FinanceKind>("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [description, setDescription] = useState("");

  if (!open) return null;

  const categories = kind === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function submit() {
    const value = Number(amount.replace(",", "."));
    if (!value || value <= 0) return;
    store.addFinance({
      kind,
      category,
      amount: value,
      date,
      description: description.trim() || undefined,
    });
    setAmount("");
    setDescription("");
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md surface-panel p-6">
        <h2 className="text-[16px] font-semibold">Novo lançamento manual</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Use para valores fora da agenda (aluguel, gear, vendas avulsas).
        </p>

        <div className="mt-5 flex gap-2">
          {(["expense", "income"] as FinanceKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setCategory((k === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0]);
              }}
              className={cn(
                "flex-1 h-10 rounded-md border text-[13px] font-semibold transition-colors",
                kind === k
                  ? k === "expense"
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-[color:var(--success)]/50 bg-[color:var(--success)]/10 text-[color:var(--success)]"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              {k === "expense" ? "Saída" : "Entrada"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Categoria">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-[12.5px] outline-none focus:border-primary/50"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor (R$)">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="h-9 w-full rounded-md border border-border bg-surface-2 px-2 font-mono text-[13px] outline-none focus:border-primary/50"
            />
          </Field>
          <Field label="Data">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-[12.5px] outline-none focus:border-primary/50"
            />
          </Field>
          <Field label="Descrição (opcional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: pedal reparo, boleto luz…"
              className="h-9 w-full rounded-md border border-border bg-surface-2 px-2 text-[12.5px] outline-none focus:border-primary/50"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md px-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!amount || Number(amount.replace(",", ".")) <= 0}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
