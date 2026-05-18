import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  label: string;
  action?: () => void;
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground font-mono">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const sections: Array<{ heading: string; shortcuts: Shortcut[] }> = [
    {
      heading: "Navigation",
      shortcuts: [
        { keys: ["G", "D"], label: "Go to Dashboard",   action: () => navigate("/dashboard") },
        { keys: ["G", "P"], label: "Go to POS",          action: () => navigate("/pos") },
        { keys: ["G", "I"], label: "Go to Inventory",    action: () => navigate("/inventory") },
        { keys: ["G", "V"], label: "Go to Invoices",     action: () => navigate("/invoices") },
        { keys: ["G", "C"], label: "Go to Customers",    action: () => navigate("/customers") },
        { keys: ["G", "R"], label: "Go to Reports",      action: () => navigate("/reports") },
        { keys: ["G", "S"], label: "Go to Settings",     action: () => navigate("/settings") },
      ],
    },
    {
      heading: "Global",
      shortcuts: [
        { keys: ["⌘", "K"], label: "Open search" },
        { keys: ["?"],       label: "Show this help" },
        { keys: ["Esc"],     label: "Close dialogs / panels" },
      ],
    },
  ];

  useEffect(() => {
    let pendingG = false;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === "?") {
        setOpen((o) => !o);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      // Two-key "G + X" navigation chords
      if (e.key === "g" || e.key === "G") {
        pendingG = true;
        pendingTimer = setTimeout(() => { pendingG = false; }, 1500);
        return;
      }

      if (pendingG) {
        pendingG = false;
        if (pendingTimer) clearTimeout(pendingTimer);
        const map: Record<string, string> = {
          d: "/dashboard", D: "/dashboard",
          p: "/pos",       P: "/pos",
          i: "/inventory", I: "/inventory",
          v: "/invoices",  V: "/invoices",
          c: "/customers", C: "/customers",
          r: "/reports",   R: "/reports",
          s: "/settings",  S: "/settings",
        };
        const dest = map[e.key];
        if (dest) { navigate(dest); setOpen(false); }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {sections.map((section) => (
            <div key={section.heading}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {section.heading}
              </p>
              <div className="space-y-2">
                {section.shortcuts.map((sc) => (
                  <div
                    key={sc.label}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary/60 transition-colors cursor-default"
                    onClick={() => { if (sc.action) { sc.action(); setOpen(false); } }}
                  >
                    <span className="text-sm">{sc.label}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((k, i) => (
                        <Key key={i}>{k}</Key>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press <Key>?</Key> anytime to open this panel
        </p>
      </DialogContent>
    </Dialog>
  );
}
