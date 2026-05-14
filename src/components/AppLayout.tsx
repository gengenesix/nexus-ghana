import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { ApprovalInbox } from "@/components/ApprovalInbox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LowStockBanner } from "@/components/LowStockBanner";

export function AppLayout() {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="mr-2 hidden md:flex" />
              <div className="flex items-center gap-2 md:hidden">
                <img src="/brand/nexis-icon-green.png" alt="Nexis" style={{ height: 32, width: 32, borderRadius: 8, display: "block", boxShadow: "0 2px 8px rgba(26,58,34,0.12)" }} />
                <img src="/brand/nexis-wordmark-dark.png" alt="" aria-hidden style={{ height: 16, display: "block" }} />
              </div>
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <ApprovalInbox />
              <NotificationsCenter />
            </div>
          </header>

          <LowStockBanner />

          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto min-w-0">
            <AnimatePresence mode="wait">
              <PageTransition key={location.pathname}>
                <Outlet />
              </PageTransition>
            </AnimatePresence>
          </main>
        </div>

        <MobileNav />
      </div>
    </SidebarProvider>
  );
}
