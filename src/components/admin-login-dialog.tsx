import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
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

const ALLOWED_USERNAME = "padustudios";

export function AdminLoginDialog({ open, onOpenChange }: Props) {
  const { hasCreds, setup, login } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername("");
      setPassword("");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const user = username.trim().toLowerCase();
    if (!user || !password) {
      toast.error("Preencha usuário e senha");
      return;
    }
    if (user !== ALLOWED_USERNAME) {
      toast.error("Usuário ou senha incorretos");
      return;
    }
    setLoading(true);
    try {
      // First-time bootstrap on this device: only "padustudios" pode registrar.
      if (!hasCreds) {
        if (password.length < 4) {
          toast.error("Senha muito curta");
          return;
        }
        await setup(user, password);
        toast.success("Bem-vindo");
        onOpenChange(false);
        return;
      }
      const ok = await login(user, password);
      if (ok) {
        toast.success("Bem-vindo");
        onOpenChange(false);
      } else {
        toast.error("Usuário ou senha incorretos");
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
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <DialogTitle className="text-[14px] font-semibold">Login</DialogTitle>
            <DialogDescription className="text-[11.5px] text-muted-foreground">
              Entre para acessar todos os módulos.
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
          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-10 w-full rounded-md bg-primary text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Entrar
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
