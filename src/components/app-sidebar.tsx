import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const primary: NavItem[] = [
  { to: "/calendar", label: "Calendário", icon: Calendar },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-surface/40 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div
          className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-black tracking-tight text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,_var(--primary)_50%,_transparent)]"
          style={{ background: "var(--primary)" }}
        >
          P.
        </div>
        <div className="min-w-0 leading-none">
          <p className="text-[14px] font-bold tracking-tight">Padu Studios</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {primary.map((item) => {
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
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <button className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface-2">
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
      </div>
    </aside>
  );
}
