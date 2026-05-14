import { lazy, Suspense } from "react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StaffSessionProvider } from "@/contexts/StaffSessionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BusinessGuard } from "@/components/BusinessGuard";
import { StaffPinGuard } from "@/components/StaffPinGuard";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RoleGuard } from "@/components/RoleGuard";
import { TierGate } from "@/components/TierGate";

// Lazy-loaded pages — each becomes its own chunk
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Reports = lazy(() => import("./pages/Reports"));
const Staff = lazy(() => import("./pages/Staff"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
// ERP Modules
const Administration = lazy(() => import("./pages/modules/Administration"));
const Financials = lazy(() => import("./pages/modules/Financials"));
const CRM = lazy(() => import("./pages/modules/CRM"));
const SalesOrders = lazy(() => import("./pages/modules/SalesOrders"));
const Purchasing = lazy(() => import("./pages/modules/Purchasing"));
const Production = lazy(() => import("./pages/modules/Production"));
const MRP = lazy(() => import("./pages/modules/MRP"));
const Projects = lazy(() => import("./pages/modules/Projects"));
const ServiceModule = lazy(() => import("./pages/modules/ServiceModule"));
const HumanResources = lazy(() => import("./pages/modules/HumanResources"));
const Banking = lazy(() => import("./pages/modules/Banking"));
const Warehouses = lazy(() => import("./pages/modules/Warehouses"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// Smart root: authenticated users go straight to dashboard,
// everyone else sees the landing page.
const LandingOrDashboard = lazy(() => import("./pages/Landing"));
function SmartRoot() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <LandingOrDashboard />
    </Suspense>
  );
}

const App = () => {
  usePWAUpdate();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StaffSessionProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<SmartRoot />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                <Route element={<ProtectedRoute><BusinessGuard><StaffPinGuard><AppLayout /></StaffPinGuard></BusinessGuard></ProtectedRoute>}>
                  {/* Core — available on all tiers */}
                  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/pos" element={<ErrorBoundary><POS /></ErrorBoundary>} />
                  <Route path="/inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />
                  <Route path="/invoices" element={<ErrorBoundary><Invoices /></ErrorBoundary>} />
                  <Route path="/customers" element={<ErrorBoundary><Customers /></ErrorBoundary>} />
                  <Route path="/suppliers" element={<ErrorBoundary><Suppliers /></ErrorBoundary>} />
                  <Route path="/expenses" element={<ErrorBoundary><Expenses /></ErrorBoundary>} />
                  <Route path="/reports" element={<ErrorBoundary><RoleGuard feature="reports"><Reports /></RoleGuard></ErrorBoundary>} />
                  <Route path="/staff" element={<ErrorBoundary><RoleGuard feature="staff"><Staff /></RoleGuard></ErrorBoundary>} />
                  <Route path="/settings" element={<ErrorBoundary><RoleGuard feature="settings"><Settings /></RoleGuard></ErrorBoundary>} />

                  {/* Finance tier */}
                  <Route path="/financials" element={<ErrorBoundary><TierGate module="financials"><RoleGuard feature="financials"><Financials /></RoleGuard></TierGate></ErrorBoundary>} />
                  <Route path="/banking" element={<ErrorBoundary><TierGate module="banking"><RoleGuard feature="banking"><Banking /></RoleGuard></TierGate></ErrorBoundary>} />

                  {/* Sales & CRM tier */}
                  <Route path="/crm" element={<ErrorBoundary><TierGate module="crm"><CRM /></TierGate></ErrorBoundary>} />
                  <Route path="/sales-orders" element={<ErrorBoundary><TierGate module="sales-orders"><SalesOrders /></TierGate></ErrorBoundary>} />
                  <Route path="/projects" element={<ErrorBoundary><TierGate module="projects"><Projects /></TierGate></ErrorBoundary>} />
                  <Route path="/service" element={<ErrorBoundary><TierGate module="service"><ServiceModule /></TierGate></ErrorBoundary>} />

                  {/* Logistics tier */}
                  <Route path="/purchasing" element={<ErrorBoundary><TierGate module="purchasing"><Purchasing /></TierGate></ErrorBoundary>} />
                  <Route path="/warehouses" element={<ErrorBoundary><TierGate module="warehouses"><Warehouses /></TierGate></ErrorBoundary>} />
                  <Route path="/production" element={<ErrorBoundary><TierGate module="production"><Production /></TierGate></ErrorBoundary>} />
                  <Route path="/mrp" element={<ErrorBoundary><TierGate module="mrp"><MRP /></TierGate></ErrorBoundary>} />

                  {/* Professional-only */}
                  <Route path="/hr" element={<ErrorBoundary><TierGate module="hr"><RoleGuard feature="hr"><HumanResources /></RoleGuard></TierGate></ErrorBoundary>} />
                  <Route path="/administration" element={<ErrorBoundary><TierGate module="administration"><RoleGuard feature="administration"><Administration /></RoleGuard></TierGate></ErrorBoundary>} />

                  {/* /opportunities was a duplicate of /crm — redirect */}
                  <Route path="/opportunities" element={<Navigate to="/crm" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </StaffSessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
