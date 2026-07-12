import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { useAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});

const ADMIN_PREFIXES = ["/dashboard", "/clients", "/crm", "/finance", "/equipment", "/automation", "/settings"];

function ShellLayout() {
  const { isAdmin } = useAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin && ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      navigate({ to: "/calendar", replace: true });
    }
  }, [isAdmin, pathname, navigate]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Ambient red glow — barely visible, gives the surface depth */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 85% -10%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 60%), radial-gradient(900px 500px at -5% 110%, color-mix(in oklch, var(--primary) 6%, transparent), transparent 70%)",
        }}
      />
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
