import { useEffect, useState } from "react";
import { addDays, addMonths, addWeeks } from "date-fns";

import { store } from "@/lib/scheduling/store";
import { toISODate } from "@/lib/scheduling/time";
import { INTERNAL_OWNERS } from "@/lib/scheduling/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PERIODICITIES = [
  { value: "once", label: "Única" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
] as const;

type Periodicity = (typeof PERIODICITIES)[number]["value"];

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const OCCURRENCES: Record<Periodicity, number> = {
  once: 1,
  weekly: 12,
  biweekly: 8,
  monthly: 6,
};

const selectClass =
  "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-foreground outline-none focus:border-primary";

/** First date >= today that falls on the requested weekday. */
function nextWeekday(weekday: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (weekday - today.getDay() + 7) % 7;
  return addDays(today, diff);
}

export function CreateTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [periodicity, setPeriodicity] = useState<Periodicity>("weekly");
  const [weekday, setWeekday] = useState<number>(1);
  const [owner, setOwner] = useState<string>(INTERNAL_OWNERS[0]);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPeriodicity("weekly");
    setWeekday(new Date().getDay());
    setOwner(INTERNAL_OWNERS[0]);
    setStart("10:00");
    setEnd("11:00");
    setNotes("");
  }, [open]);

  function save() {
    if (!title.trim()) return;
    const base =
      periodicity === "once" ? new Date() : nextWeekday(weekday);
    const count = OCCURRENCES[periodicity];

    for (let i = 0; i < count; i++) {
      const date =
        periodicity === "monthly"
          ? addMonths(base, i)
          : periodicity === "biweekly"
            ? addWeeks(base, i * 2)
            : addWeeks(base, i);
      store.addInternalEvent({
        owner,
        title: title.trim(),
        date: toISODate(date),
        start,
        end,
        status: "confirmed",
        notes: notes.trim() || undefined,
      });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Criar tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Nome da tarefa</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Manutenção da sala"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-periodicity">Periodicidade</Label>
              <select
                id="task-periodicity"
                className={selectClass}
                value={periodicity}
                onChange={(e) => setPeriodicity(e.target.value as Periodicity)}
              >
                {PERIODICITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {periodicity !== "once" && (
              <div className="space-y-1.5">
                <Label htmlFor="task-weekday">Dia da semana sugerido</Label>
                <select
                  id="task-weekday"
                  className={selectClass}
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-owner">Responsável</Label>
              <select
                id="task-owner"
                className={selectClass}
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                {INTERNAL_OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-start">Início</Label>
              <Input
                id="task-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-end">Fim</Label>
              <Input
                id="task-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Observações</Label>
            <Input
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {periodicity !== "once" && (
            <p className="text-[12px] text-muted-foreground">
              Serão criadas {OCCURRENCES[periodicity]} ocorrências a partir da
              próxima {WEEKDAYS[weekday].toLowerCase()}.
            </p>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-border bg-surface px-3 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!title.trim()}
            className="h-9 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            Criar tarefa
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
