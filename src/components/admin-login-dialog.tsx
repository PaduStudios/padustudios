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

export function AdminLoginDialog({ open, onOpenChange }: Props) {
  const { signIn, signUp } = useAdmin();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setMode("login");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!mail || !password) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      toast.error("A senha precisa ter ao menos 6 caracteres");
      return;
    }
    setLoading(true);
    try {
      const error =
        mode === "signup"
          ? await signUp(mail, password)
          : await signIn(mail, password);
      if (error) {
        toast.error(
          error.includes("Invalid login")
            ? "E-mail ou senha incorretos"
            : error
        );
        return;
      }
      toast.success("Bem-vindo");
      onOpenChange(false);
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
            <DialogTitle className="text-[14px] font-semibold">
              {mode === "signup" ? "Criar acesso admin" : "Login"}
            </DialogTitle>
            <DialogDescription className="text-[11.5px] text-muted-foreground">
              Entre para acessar todos os módulos.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              E-mail
            </span>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] outline-none focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Senha
            </span>
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
            {mode === "signup" ? "Criar acesso" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="w-full text-[11.5px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {mode === "signup"
              ? "Já tenho acesso — entrar"
              : "Primeiro acesso? Criar conta de administrador"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
