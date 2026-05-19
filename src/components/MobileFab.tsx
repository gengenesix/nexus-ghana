/**
 * MobileFab — Phase 5 floating action button
 * Visible only on mobile (md:hidden), sits above the bottom navigation bar.
 * Use for the primary page action (Add, New, Create…).
 */
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MobileFabProps {
  /** Icon to display (defaults to Plus) */
  icon?: LucideIcon;
  /** Text label shown next to the icon */
  label?: string;
  onClick: () => void;
  /** Set true to hide (e.g. when staff lacks create permission) */
  hidden?: boolean;
}

export function MobileFab({
  icon: Icon = Plus,
  label,
  onClick,
  hidden = false,
}: MobileFabProps) {
  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          key="mobile-fab"
          className="fixed z-40 md:hidden flex items-center gap-2 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-xl"
          style={{
            bottom: "calc(3.75rem + 1rem)", // above the 60px mobile nav + 1rem gap
            right: "1rem",
            paddingLeft: label ? "1rem" : "0.9rem",
            paddingRight: label ? "1.25rem" : "0.9rem",
            paddingTop: "0.875rem",
            paddingBottom: "0.875rem",
            boxShadow: "0 8px 24px hsl(var(--primary) / 0.35)",
          }}
          onClick={onClick}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.05 }}
          aria-label={label ?? "Add"}
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2.2} />
          {label && <span className="leading-none">{label}</span>}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
