import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WorkQueue from "./pages/WorkQueue";
import ExceptionReview from "./pages/ExceptionReview";
import Screening from "./pages/Screening";
import Reports from "./pages/Reports";
import Agents from "./pages/Agents";
import NotFound from "./pages/NotFound";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { document.querySelector("main")?.scrollTo(0, 0); }, [pathname]);
  return null;
};

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route element={user ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/work-queue" element={<WorkQueue />} />
          <Route path="/work-queue/review/:kycRef" element={<ExceptionReview />} />
          <Route path="/work-queue/review/:kycRef/screening" element={<Screening />} />
          <Route path="/work-queue/review" element={<Navigate to="/work-queue" replace />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/agents" element={<Agents />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="kyc-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/kyc-agentic">
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
