import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Bell, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentProvider, AgentRecommendationStrip } from "@/components/AgentSystem";

const tabs = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/work-queue", label: "Work Queue" },
  { to: "/reports", label: "Reports" },
];

const AppLayout = () => {
  const location = useLocation();
  return (
    <AgentProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-nav text-nav-foreground">
          <div className="px-6 h-14 flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground font-bold text-sm tracking-tight px-2 py-1 rounded-sm">
                KPMG
              </div>
              <span className="font-semibold text-[15px]">KYC Platform</span>
            </div>

            <nav className="flex-1 flex items-center justify-center gap-8">
              {tabs.map((t) => (
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
              ))}
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

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </AgentProvider>
  );
};

export default AppLayout;
