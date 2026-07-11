import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  autoMapColumns,
  CLIENT_FIELD_HINTS,
  APPOINTMENT_FIELD_HINTS,
  type AppointmentField,
  type ClientField,
  type CsvRow,
} from "@/lib/import/supersaas-csv";
import {
  buildAppointmentPlan,
  buildClientPlan,
  commit,
  type AppointmentImportPlan,
  type AppointmentMapping,
  type ClientImportPlan,
  type ClientMapping,
} from "@/lib/import";
import type { ClientOrigin } from "@/lib/scheduling/types";

type Step = "upload" | "map" | "review" | "done";

interface ParsedCsv {
  fileName: string;
  headers: string[];
  rows: CsvRow[];
}

const CLIENT_FIELD_LABELS: Record<ClientField, string> = {
  name: "Nome completo",
  phone: "Telefone (obrigatório — usado pra dedupe)",
  email: "Email",
  band: "Banda / grupo",
  members: "Nº de integrantes",
  notes: "Observações",
  createdAt: "Cadastrado em",
};

const APPOINTMENT_FIELD_LABELS: Record<AppointmentField, string> = {
  userName: "Nome do cliente (pra achar no cadastro)",
  phone: "Telefone (pra achar no cadastro)",
  email: "Email",
  date: "Data do ensaio",
  start: "Horário de início",
  end: "Horário de fim",
  duration: "Duração (usado se não houver hora de fim)",
  room: "Sala / recurso",
  price: "Preço",
  payment: "Método de pagamento",
  status: "Status",
  notes: "Observações do ensaio",
};

const MAPPING_STORAGE_KEY = "padu-os:supersaas-import:mapping:v1";

interface SavedMappings {
  clients?: Partial<Record<ClientField, string>>;
  appointments?: Partial<Record<AppointmentField, string>>;
  dateLocale?: "br" | "us" | "iso";
  defaultOrigin?: ClientOrigin;
}

function loadSaved(): SavedMappings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(MAPPING_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function persist(saved: SavedMappings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(saved));
}

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [clientsCsv, setClientsCsv] = useState<ParsedCsv | null>(null);
  const [apptsCsv, setApptsCsv] = useState<ParsedCsv | null>(null);

  const saved = useRef<SavedMappings>(loadSaved()).current;

  const [clientMapping, setClientMapping] = useState<ClientMapping>(
    () => emptyMapping<ClientField>(CLIENT_FIELD_HINTS)
  );
  const [apptMapping, setApptMapping] = useState<AppointmentMapping>(
    () => emptyMapping<AppointmentField>(APPOINTMENT_FIELD_HINTS)
  );
  const [dateLocale, setDateLocale] = useState<"br" | "us" | "iso">(
    saved.dateLocale ?? "br"
  );
  const [defaultOrigin, setDefaultOrigin] = useState<ClientOrigin>(
    saved.defaultOrigin ?? "other"
  );

  const clientPlan = useMemo<ClientImportPlan | null>(() => {
    if (!clientsCsv) return null;
    return buildClientPlan(clientsCsv.rows, clientMapping, {
      dateLocale,
      defaultOrigin,
    });
  }, [clientsCsv, clientMapping, dateLocale, defaultOrigin]);

  const apptPlan = useMemo<AppointmentImportPlan | null>(() => {
    if (!apptsCsv || !clientPlan) return null;
    return buildAppointmentPlan(
      apptsCsv.rows,
      apptMapping,
      { dateLocale, defaultOrigin },
      clientPlan.toCreate
    );
  }, [apptsCsv, apptMapping, clientPlan, dateLocale, defaultOrigin]);

  async function handleFile(kind: "clients" | "appts", file: File) {
    const text = await file.text();
    const result = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length > 0) {
      toast.error("Erro ao ler CSV", {
        description: result.errors[0].message,
      });
    }
    const parsed: ParsedCsv = {
      fileName: file.name,
      headers: result.meta.fields ?? [],
      rows: (result.data ?? []).filter((r) =>
        Object.values(r).some((v) => v && String(v).trim())
      ),
    };
    if (kind === "clients") {
      setClientsCsv(parsed);
      const auto = autoMapColumns(parsed.headers, CLIENT_FIELD_HINTS);
      // overlay any saved mapping (only if header still exists)
      const overlaid = overlayMapping(auto, saved.clients, parsed.headers);
      setClientMapping(overlaid);
    } else {
      setApptsCsv(parsed);
      const auto = autoMapColumns(parsed.headers, APPOINTMENT_FIELD_HINTS);
      const overlaid = overlayMapping(auto, saved.appointments, parsed.headers);
      setApptMapping(overlaid);
    }
  }

  function goToMap() {
    if (!clientsCsv || !apptsCsv) {
      toast.error("Envie os dois arquivos CSV antes de continuar");
      return;
    }
    setStep("map");
  }

  function goToReview() {
    if (!clientMapping.phone) {
      toast.error("Mapeie a coluna de telefone dos clientes");
      return;
    }
    if (!apptMapping.date || !apptMapping.start) {
      toast.error("Mapeie ao menos data e horário de início dos ensaios");
      return;
    }
    persist({
      clients: cleanMapping(clientMapping),
      appointments: cleanMapping(apptMapping),
      dateLocale,
      defaultOrigin,
    });
    setStep("review");
  }

  function doImport() {
    if (!clientPlan || !apptPlan) return;
    const result = commit(clientPlan, apptPlan);
    toast.success("Importação concluída", {
      description: `${result.clientsCreated} clientes novos · ${result.clientsMerged} atualizados · ${result.appointmentsCreated} ensaios`,
    });
    setStep("done");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/settings"
            className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Configurações
          </Link>
          <h1 className="text-[22px] font-bold tracking-tight">
            Importar do SuperSaaS
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Carregue os CSVs de clientes e agendamentos exportados do SuperSaaS.
            Nada é enviado até você confirmar.
          </p>
        </div>
      </header>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        <StepPill n={1} label="Upload" active={step === "upload"} done={step !== "upload"} />
        <div className="h-px flex-1 bg-border" />
        <StepPill
          n={2}
          label="Mapear colunas"
          active={step === "map"}
          done={step === "review" || step === "done"}
        />
        <div className="h-px flex-1 bg-border" />
        <StepPill
          n={3}
          label="Revisar"
          active={step === "review"}
          done={step === "done"}
        />
      </div>

      {step === "upload" && (
        <UploadStep
          clientsCsv={clientsCsv}
          apptsCsv={apptsCsv}
          onFile={handleFile}
          onNext={goToMap}
        />
      )}

      {step === "map" && clientsCsv && apptsCsv && (
        <MapStep
          clientsCsv={clientsCsv}
          apptsCsv={apptsCsv}
          clientMapping={clientMapping}
          apptMapping={apptMapping}
          setClientMapping={setClientMapping}
          setApptMapping={setApptMapping}
          dateLocale={dateLocale}
          setDateLocale={setDateLocale}
          defaultOrigin={defaultOrigin}
          setDefaultOrigin={setDefaultOrigin}
          onBack={() => setStep("upload")}
          onNext={goToReview}
        />
      )}

      {step === "review" && clientPlan && apptPlan && (
        <ReviewStep
          clientPlan={clientPlan}
          apptPlan={apptPlan}
          onBack={() => setStep("map")}
          onConfirm={doImport}
        />
      )}

      {step === "done" && (
        <div className="surface-panel flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
            <Check className="h-6 w-6" />
          </div>
          <h2 className="text-[16px] font-semibold">Importação concluída</h2>
          <p className="text-[13px] text-muted-foreground">
            Seus dados já estão no calendário e no cadastro de clientes.
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              to="/calendar"
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground"
            >
              Ver calendário
            </Link>
            <Link
              to="/clients"
              className="flex h-9 items-center rounded-md border border-border bg-surface px-3 text-[12.5px] font-semibold hover:bg-surface-2"
            >
              Ver clientes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

function UploadStep({
  clientsCsv,
  apptsCsv,
  onFile,
  onNext,
}: {
  clientsCsv: ParsedCsv | null;
  apptsCsv: ParsedCsv | null;
  onFile: (k: "clients" | "appts", f: File) => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DropCard
        title="Clientes / Users"
        hint="No SuperSaaS: Supervise → Users → Export"
        file={clientsCsv}
        onFile={(f) => onFile("clients", f)}
      />
      <DropCard
        title="Agendamentos / Reservations"
        hint="No SuperSaaS: Reports → Appointments → Export CSV"
        file={apptsCsv}
        onFile={(f) => onFile("appts", f)}
      />
      <div className="sm:col-span-2 flex justify-end">
        <button
          onClick={onNext}
          disabled={!clientsCsv || !apptsCsv}
          className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function DropCard({
  title,
  hint,
  file,
  onFile,
}: {
  title: string;
  hint: string;
  file: ParsedCsv | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="surface-panel flex flex-col gap-3 p-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>
      </div>

      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-2/50 p-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-muted text-primary">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{file.fileName}</p>
            <p className="text-[11px] text-muted-foreground">
              {file.rows.length} linhas · {file.headers.length} colunas
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            Trocar
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2/30 p-6 text-[12px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-muted/30 hover:text-primary"
        >
          <Upload className="h-5 w-5" />
          Clique para selecionar CSV
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function MapStep({
  clientsCsv,
  apptsCsv,
  clientMapping,
  apptMapping,
  setClientMapping,
  setApptMapping,
  dateLocale,
  setDateLocale,
  defaultOrigin,
  setDefaultOrigin,
  onBack,
  onNext,
}: {
  clientsCsv: ParsedCsv;
  apptsCsv: ParsedCsv;
  clientMapping: ClientMapping;
  apptMapping: AppointmentMapping;
  setClientMapping: (m: ClientMapping) => void;
  setApptMapping: (m: AppointmentMapping) => void;
  dateLocale: "br" | "us" | "iso";
  setDateLocale: (v: "br" | "us" | "iso") => void;
  defaultOrigin: ClientOrigin;
  setDefaultOrigin: (v: ClientOrigin) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className="surface-panel p-5">
        <h2 className="text-[14px] font-semibold">Clientes</h2>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {clientsCsv.rows.length} linhas em <code>{clientsCsv.fileName}</code>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(CLIENT_FIELD_LABELS) as ClientField[]).map((field) => (
            <MapField
              key={field}
              label={CLIENT_FIELD_LABELS[field]}
              value={clientMapping[field]}
              headers={clientsCsv.headers}
              onChange={(v) =>
                setClientMapping({ ...clientMapping, [field]: v })
              }
              required={field === "phone"}
            />
          ))}
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Origem padrão dos importados
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(
              [
                "other",
                "whatsapp",
                "instagram",
                "site",
                "phone",
                "walkin",
              ] as ClientOrigin[]
            ).map((o) => (
              <button
                key={o}
                onClick={() => setDefaultOrigin(o)}
                className={cn(
                  "h-8 rounded-md border px-3 text-[11.5px] font-semibold transition-colors",
                  defaultOrigin === o
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <Preview csv={clientsCsv} />
      </section>

      <section className="surface-panel p-5">
        <h2 className="text-[14px] font-semibold">Agendamentos</h2>
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          {apptsCsv.rows.length} linhas em <code>{apptsCsv.fileName}</code>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(APPOINTMENT_FIELD_LABELS) as AppointmentField[]).map(
            (field) => (
              <MapField
                key={field}
                label={APPOINTMENT_FIELD_LABELS[field]}
                value={apptMapping[field]}
                headers={apptsCsv.headers}
                onChange={(v) =>
                  setApptMapping({ ...apptMapping, [field]: v })
                }
                required={field === "date" || field === "start"}
              />
            )
          )}
        </div>
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Formato de data no CSV
          </p>
          <div className="mt-2 flex gap-1.5">
            {(
              [
                { v: "br", l: "dd/mm/yyyy (BR)" },
                { v: "us", l: "mm/dd/yyyy (US)" },
                { v: "iso", l: "yyyy-mm-dd (ISO)" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setDateLocale(opt.v)}
                className={cn(
                  "h-8 rounded-md border px-3 text-[11.5px] font-semibold transition-colors",
                  dateLocale === opt.v
                    ? "border-primary bg-primary-muted text-primary"
                    : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <Preview csv={apptsCsv} />
      </section>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="h-10 rounded-md px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          Revisar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MapField({
  label,
  value,
  headers,
  onChange,
  required,
}: {
  label: string;
  value: string | null;
  headers: string[];
  onChange: (v: string | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-primary">*</span>}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "h-9 w-full rounded-md border bg-surface-2 px-2 text-[12.5px] outline-none focus:border-primary/50",
          required && !value ? "border-destructive/40" : "border-border"
        )}
      >
        <option value="">— Ignorar —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

function Preview({ csv }: { csv: ParsedCsv }) {
  const preview = csv.rows.slice(0, 3);
  return (
    <details className="mt-4 rounded-md border border-border bg-surface-2/30 p-3">
      <summary className="cursor-pointer text-[11.5px] font-semibold text-muted-foreground hover:text-foreground">
        Prévia (3 linhas)
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border">
              {csv.headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-2 py-1 text-left font-semibold text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b border-border/50">
                {csv.headers.map((h) => (
                  <td key={h} className="whitespace-nowrap px-2 py-1">
                    {row[h] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ReviewStep({
  clientPlan,
  apptPlan,
  onBack,
  onConfirm,
}: {
  clientPlan: ClientImportPlan;
  apptPlan: AppointmentImportPlan;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const totalSkipped = clientPlan.skipped.length + apptPlan.skipped.length;

  function downloadSkipped() {
    const lines = [
      "tipo,linha,motivo",
      ...clientPlan.skipped.map((s) => `cliente,${s.row},"${s.reason}"`),
      ...apptPlan.skipped.map((s) => `agendamento,${s.row},"${s.reason}"`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supersaas-import-descartados.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Clientes novos"
          value={clientPlan.toCreate.length}
          tone="primary"
        />
        <StatCard
          label="Clientes atualizados"
          value={clientPlan.toMerge.length}
          tone="muted"
        />
        <StatCard
          label="Ensaios importados"
          value={apptPlan.toCreate.length}
          tone="primary"
        />
      </div>

      {totalSkipped > 0 && (
        <div className="surface-panel border-[color:var(--status-pending)]/25 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--status-pending)]/15 text-[color:var(--status-pending)]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold">
                {totalSkipped} linhas descartadas
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nenhuma delas será importada. Ajuste o CSV ou o mapeamento e
                tente de novo, ou continue sem elas.
              </p>
              <button
                onClick={downloadSkipped}
                className="mt-3 text-[11.5px] font-semibold text-primary hover:underline"
              >
                Baixar lista dos descartados (.csv)
              </button>
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-surface-2/30 p-2 text-[11.5px]">
                {[
                  ...clientPlan.skipped.map((s) => ({
                    ...s,
                    kind: "cliente",
                  })),
                  ...apptPlan.skipped.map((s) => ({
                    ...s,
                    kind: "agendamento",
                  })),
                ]
                  .slice(0, 40)
                  .map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <X className="h-3 w-3 shrink-0 text-destructive/70" />
                      <span className="font-mono text-[10.5px]">
                        {s.kind}#{s.row}
                      </span>
                      <span className="truncate">{s.reason}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="h-10 rounded-md px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={
            clientPlan.toCreate.length === 0 &&
            clientPlan.toMerge.length === 0 &&
            apptPlan.toCreate.length === 0
          }
          className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-5 text-[13px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Importar tudo
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "muted";
}) {
  return (
    <div className="surface-panel p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-[28px] font-bold tabular-nums leading-none",
          tone === "primary" ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StepPill({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors",
        active
          ? "border-primary bg-primary-muted text-primary"
          : done
            ? "border-primary/40 text-primary/80"
            : "border-border text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 place-items-center rounded-full text-[10px]",
          active
            ? "bg-primary text-primary-foreground"
            : done
              ? "bg-primary/30 text-primary"
              : "bg-surface-2 text-muted-foreground"
        )}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      {label}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function emptyMapping<T extends string>(
  hints: Record<T, readonly string[]>
): Record<T, string | null> {
  const out = {} as Record<T, string | null>;
  for (const k of Object.keys(hints) as T[]) out[k] = null;
  return out;
}

function overlayMapping<T extends string>(
  auto: Record<T, string | null>,
  saved: Partial<Record<T, string>> | undefined,
  headers: string[]
): Record<T, string | null> {
  if (!saved) return auto;
  const headerSet = new Set(headers);
  const out = { ...auto };
  for (const k of Object.keys(saved) as T[]) {
    const v = saved[k];
    if (v && headerSet.has(v)) out[k] = v;
  }
  return out;
}

function cleanMapping<T extends string>(
  m: Record<T, string | null>
): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  for (const k of Object.keys(m) as T[]) {
    const v = m[k];
    if (v) out[k] = v;
  }
  return out;
}
