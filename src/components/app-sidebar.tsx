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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/hooks/use-admin";
import { AdminLoginDialog } from "@/components/admin-login-dialog";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  adminOnly?: boolean;
}

const primary: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, adminOnly: true },
  { to: "/calendar", label: "Calendário", icon: Calendar },
  { to: "/clients", label: "Clientes", icon: Users, adminOnly: true },
];

const business: NavItem[] = [
  { to: "/crm", label: "CRM", icon: Sparkles, adminOnly: true },
  { to: "/finance", label: "Financeiro", icon: Wallet, adminOnly: true },
];

const operations: NavItem[] = [
  { to: "/equipment", label: "Equipamentos", icon: Guitar, soon: true, adminOnly: true },
  { to: "/automation", label: "Automação", icon: Zap, soon: true, adminOnly: true },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, hasCreds, logout } = useAdmin();
  const [loginOpen, setLoginOpen] = useState(false);

  const filter = (items: NavItem[]) =>
    items.filter((i) => isAdmin || !i.adminOnly);

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-surface/40 backdrop-blur-xl md:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div
          className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tracking-tight text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,_var(--primary)_50%,_transparent)]"
          style={{ background: "var(--primary)" }}
        >
          P.
        </div>
        <div className="min-w-0 leading-none">
          <p className="text-[13px] font-bold tracking-tight">Padu Studios</p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
            Studios · Teodoro
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <NavGroup items={filter(primary)} pathname={pathname} />
        {isAdmin && (
          <>
            <NavGroup label="Negócio" items={filter(business)} pathname={pathname} />
            <NavGroup label="Operação" items={filter(operations)} pathname={pathname} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        {isAdmin && (
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
              pathname === "/settings" && "bg-surface-2 text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        )}

        <button
          onClick={() => (isAdmin ? logout() : setLoginOpen(true))}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-surface-3"
        >
          {isAdmin ? (
            <>
              <LogOut className="h-3.5 w-3.5" />
              Sair do admin
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5" />
              {hasCreds ? "Login Admin" : "Criar acesso admin"}
            </>
          )}
        </button>

        {isAdmin && (
          <button className="mt-2 flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface-2">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-surface-3 text-[11px] font-bold">
              P
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold">Padu</p>
              <p className="truncate text-[10px] text-muted-foreground">
                admin@padustudios.com
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </aside>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: NavItem[];
  pathname: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      {label && (
        <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
          {label}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-2 py-1.5 text-[13px] font-medium transition-all",
                active
                  ? "bg-primary-muted text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.soon && (
                <span className="rounded-sm border border-border px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  em breve
                </span>
              )}
              {active && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
