import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import WarehousePage from "./pages/Warehouse";
import ShipmentsPage from "./pages/Shipments";
import DeploymentsPage from "./pages/Deployments";
import EvidencePage from "./pages/Evidence";
import ProjectsPage from "./pages/Projects";
import ItemsPage from "./pages/Items";
import AuditPage from "./pages/Audit";
import ReportsPage from "./pages/Reports";
import MapViewPage from "./pages/MapView";
import UsersPage from "./pages/Users";
import PcbRepairsPage from "./pages/PcbRepairs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <CurrencyProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/shipments" element={<ProtectedRoute><ShipmentsPage /></ProtectedRoute>} />
              <Route path="/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
              <Route path="/deployments" element={<ProtectedRoute><DeploymentsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/evidence" element={<ProtectedRoute><EvidencePage /></ProtectedRoute>} />
              <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><MapViewPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
              <Route path="/pcb-repairs" element={<ProtectedRoute><PcbRepairsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </CurrencyProvider>
  </ThemeProvider>
);

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">This module will be built next.</p>
    </div>
  );
}

export default App;
