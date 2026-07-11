import { useEffect, useState } from "react";
import { Trash2, X, Save } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { store } from "@/lib/scheduling/store";
import type { Client, ClientOrigin } from "@/lib/scheduling/types";
import { cn } from "@/lib/utils";

const ORIGINS: { value: ClientOrigin; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "site", label: "Site" },
  { value: "instagram", label: "Instagram" },
  { value: "phone", label: "Telefone" },
  { value: "walkin", label: "Balcão" },
  { value: "other", label: "Outro" },
];

interface Props {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientEditDialog({ client, open, onOpenChange }: Props) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    band: "",
    members: "",
    origin: "whatsapp" as ClientOrigin,
    notes: "",
  });

  useEffect(() => {
    if (!client) return;
    setForm({
      name: client.name,
      phone: client.phone,
      email: client.email ?? "",
      band: client.band ?? "",
      members: client.members ? String(client.members) : "",
      origin: client.origin,
      notes: client.notes ?? "",
    });
  }, [client]);

  if (!client) return null;

  function save() {
    if (!client) return;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    store.updateClient(client.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      band: form.band.trim() || undefined,
      members: form.members ? Number(form.members) : undefined,
      origin: form.origin,
      notes: form.notes.trim() || undefined,
    });
    toast.success("Cliente atualizado", {
      description: form.band || form.name,
    });
    onOpenChange(false);
  }

  function remove() {
    if (!client) return;
    if (
      !window.confirm(
        `Excluir ${client.band || client.name}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    store.deleteClient(client.id);
    toast.success("Cliente excluído");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden border-border-strong bg-surface p-0"
        style={{ boxShadow: "0 24px 80px -20px rgba(0,0,0,0.6)" }}
      >
        <DialogTitle className="sr-only">Editar cliente</DialogTitle>

        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Padu OS · Cliente
            </p>
            <p className="text-[14px] font-semibold">Editar dados</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" className="col-span-2">
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
            <Field label="Telefone *">
              <input
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
            <Field label="Banda">
              <input
                value={form.band}
                onChange={(e) => setForm((s) => ({ ...s, band: e.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
            <Field label="Integrantes">
              <input
                value={form.members}
                onChange={(e) => setForm((s) => ({ ...s, members: e.target.value }))}
                type="number"
                min={1}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
            <Field label="Origem" className="col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {ORIGINS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, origin: o.value }))}
                    className={cn(
                      "h-8 rounded-md border px-2.5 text-[11.5px] font-semibold transition-colors",
                      form.origin === o.value
                        ? "border-primary bg-primary-muted text-primary"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Observações" className="col-span-2">
              <textarea
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary/50"
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface/60 p-4 backdrop-blur">
          <button
            onClick={remove}
            className="flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir cliente
          </button>
          <button
            onClick={save}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12.5px] font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            <Save className="h-3.5 w-3.5" />
            Salvar alterações
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
