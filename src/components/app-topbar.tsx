import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Calendar,
  Users,
  Sparkles,
  Wallet,
  Zap,
  Settings,
  LayoutGrid,
  Lock,
  LogOut,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/hooks/use-admin";
import { AdminLoginDialog } from "@/components/admin-login-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, adminOnly: true },
  { to: "/calendar", label: "Calendário", icon: Calendar },
  { to: "/clients", label: "Clientes", icon: Users, adminOnly: true },
  { to: "/crm", label: "CRM", icon: Sparkles, adminOnly: true },
  { to: "/finance", label: "Financeiro", icon: Wallet, adminOnly: true },
  { to: "/automation", label: "Automação", icon: Zap, adminOnly: true },
];

export function AppTopbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, hasCreds, logout } = useAdmin();
  const [loginOpen, setLoginOpen] = useState(false);

  const items = nav.filter((i) => isAdmin || !i.adminOnly);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-surface/70 px-4 backdrop-blur-xl md:px-6">
      {/* Brand */}
      <Link to="/calendar" className="flex items-center gap-2.5">
        <div
          className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tracking-tight text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,_var(--primary)_50%,_transparent)]"
          style={{ background: "var(--primary)" }}
        >
          P.
        </div>
        <div className="hidden min-w-0 leading-none sm:block">
          <p className="text-[13px] font-bold tracking-tight">Padu Studios</p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
            Studios · Teodoro
          </p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all",
                active
                  ? "bg-primary-muted text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Login / Admin dropdown */}
      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-3">
            <div
              className="grid h-6 w-6 place-items-center rounded-full text-primary-foreground"
              style={{ background: "var(--primary)" }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <span className="hidden sm:inline">Admin</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sessão admin
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="flex items-center gap-2 text-primary focus:text-primary"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={() => setLoginOpen(true)}
          className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-3"
        >
          <Lock className="h-3.5 w-3.5" />
          Login
        </button>
      )}

      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </header>
  );
}
