import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAdmin } from "@/hooks/use-admin";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminLoginDialog({ open, onOpenChange }: Props) {
  const { hasCreds, setup, login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  const isSetup = !hasCreds;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Preencha usuário e senha");
      return;
    }
    setLoading(true);
    try {
      if (isSetup) {
        if (password.length < 4) {
          toast.error("Senha muito curta (mínimo 4 caracteres)");
          return;
        }
        if (password !== confirm) {
          toast.error("As senhas não coincidem");
          return;
        }
        await setup(username.trim(), password);
        toast.success("Admin criado", { description: "Você está logado." });
        onOpenChange(false);
      } else {
        const ok = await login(username.trim(), password);
        if (ok) {
          toast.success("Bem-vindo, admin");
          onOpenChange(false);
        } else {
          toast.error("Usuário ou senha incorretos");
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-border-strong bg-surface p-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div
            className="grid h-9 w-9 place-items-center rounded-lg text-primary-foreground"
            style={{ background: "var(--primary)" }}
          >
            {isSetup ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </div>
          <div>
            <DialogTitle className="text-[14px] font-semibold">
              {isSetup ? "Criar acesso admin" : "Login admin"}
            </DialogTitle>
            <DialogDescription className="text-[11.5px] text-muted-foreground">
              {isSetup
                ? "Defina usuário e senha para desbloquear todos os módulos."
                : "Entre para acessar CRM, Financeiro e Dashboard."}
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Usuário
            </span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          {isSetup && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Confirmar senha
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full rounded-md bg-primary text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSetup ? "Criar e entrar" : "Entrar"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
