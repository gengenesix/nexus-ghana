import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { StaffSessionProvider } from "@/contexts/StaffSessionContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BusinessGuard } from "@/components/BusinessGuard";
import { StaffPinGuard } from "@/components/StaffPinGuard";
import { AppLayout } from "@/components/AppLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import Invoices from "./pages/Invoices";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
// ERP Modules
import Administration from "./pages/modules/Administration";
import Financials from "./pages/modules/Financials";
import CRM from "./pages/modules/CRM";
import SalesOrders from "./pages/modules/SalesOrders";
import Purchasing from "./pages/modules/Purchasing";
import Production from "./pages/modules/Production";
import MRP from "./pages/modules/MRP";
import Projects from "./pages/modules/Projects";
import ServiceModule from "./pages/modules/ServiceModule";
import HumanResources from "./pages/modules/HumanResources";
import Banking from "./pages/modules/Banking";
import Warehouses from "./pages/modules/Warehouses";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StaffSessionProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route element={<ProtectedRoute><BusinessGuard><StaffPinGuard><AppLayout /></StaffPinGuard></BusinessGuard></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/staff" element={<Staff />} />
                <Route path="/settings" element={<Settings />} />
                {/* ERP Module Routes */}
                <Route path="/administration" element={<Administration />} />
                <Route path="/financials" element={<Financials />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/sales-orders" element={<SalesOrders />} />
                <Route path="/purchasing" element={<Purchasing />} />
                <Route path="/production" element={<Production />} />
                <Route path="/mrp" element={<MRP />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/service" element={<ServiceModule />} />
                <Route path="/hr" element={<HumanResources />} />
                <Route path="/banking" element={<Banking />} />
                <Route path="/warehouses" element={<Warehouses />} />
                <Route path="/opportunities" element={<CRM />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StaffSessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
