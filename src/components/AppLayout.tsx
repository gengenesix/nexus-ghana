import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout() {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6">
            <SidebarTrigger className="mr-4 hidden md:flex" />
            <div className="flex items-center gap-2 md:hidden">
              <span className="font-display text-lg font-black tracking-tighter bg-gradient-to-r from-primary via-yellow-400 to-primary bg-clip-text text-transparent">
                NexusGH
              </span>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
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
