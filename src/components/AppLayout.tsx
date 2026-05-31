import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentProvider, AgentRecommendationStrip } from "@/components/AgentSystem";
import kpmgLogo from "@/assets/kpmg-logo-white.svg";

const tabs = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/work-queue", label: "Work Queue" },
  { to: "/reports", label: "Reports", disabled: true },
] as { to: string; label: string; end?: boolean; disabled?: boolean }[];

const AppLayout = () => {
  const location = useLocation();
  return (
    <AgentProvider>
      <div className="h-full bg-background flex flex-col">
        <header className="bg-nav text-nav-foreground">
          <div className="px-6 h-14 flex items-center gap-8">
            <div className="flex items-center gap-3">
              <img src={kpmgLogo} alt="KPMG" className="h-5 w-auto" />
              <span className="font-semibold text-[15px]">KYC Platform</span>
            </div>

            <nav className="flex-1 flex items-center justify-center gap-8">
              {tabs.map((t) =>
                t.disabled ? (
                  <span
                    key={t.to}
                    title="Coming soon"
                    className="relative text-[14px] py-[18px] text-nav-muted/50 cursor-not-allowed flex items-center gap-1.5"
                  >
                    {t.label}
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 uppercase tracking-wide leading-none">Soon</span>
                  </span>
                ) : (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    end={t.end}
                    className={({ isActive }) =>
                      cn(
                        "relative text-[14px] py-[18px] transition-colors",
                        isActive
                          ? "text-nav-foreground after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-nav-foreground"
                          : "text-nav-muted hover:text-nav-foreground"
                      )
                    }
                  >
                    {t.label}
                  </NavLink>
                )
              )}
            </nav>

            <div className="flex items-center gap-4">
              <button className="text-nav-muted hover:text-nav-foreground transition-colors" aria-label="Notifications">
                <Bell className="size-[18px]" />
              </button>
              <button className="size-8 rounded-full border border-white/15 flex items-center justify-center text-nav-muted hover:text-nav-foreground transition-colors" aria-label="Account">
                <User className="size-[16px]" />
              </button>
              <button className="size-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-sm" aria-label="AI Assistant">
                <Sparkles className="size-[14px] text-white" />
              </button>
            </div>
          </div>
        </header>

        <AgentRecommendationStrip route={location.pathname} />

        <main className="flex-1 overflow-y-auto min-h-0">
          <Outlet />
        </main>
      </div>
    </AgentProvider>
  );
};

export default AppLayout;
