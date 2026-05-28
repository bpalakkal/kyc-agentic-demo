/**
 * App — root router
 *
 * The basename "/kyc-agentic2" matches the GitHub Pages repository sub-path.
 * TODO: In production (custom domain or root-path deployment), remove basename
 * and update vite.config.ts `base` to "/".
 *
 * Route structure
 * ───────────────
 * /                   → Dashboard     (KPI summary, AI assistant, activity feed)
 * /work-queue         → WorkQueue     (entity selection table, grouped by DRG)
 * /work-queue/review  → ExceptionReview (exception detail + agent console)
 * /reports            → Reports       (placeholder — not yet implemented)
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import WorkQueue from "./pages/WorkQueue";
import ExceptionReview from "./pages/ExceptionReview";
import { Reports } from "./pages/Placeholders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/kyc-agentic2">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work-queue" element={<WorkQueue />} />
            <Route path="/work-queue/review" element={<ExceptionReview />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
