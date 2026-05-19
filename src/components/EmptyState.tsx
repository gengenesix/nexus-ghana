/**
 * EmptyState — Phase 5 enhanced version
 * Animated, role-aware, context-rich empty state component.
 */
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Primary CTA label */
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary link/action */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /**
   * Set to false to hide the primary CTA.
   * Use this when the current user lacks create permission.
   * Defaults to true.
   */
  canAct?: boolean;
  /** "sm" = inside a card/panel; "md" = full section (default) */
  size?: "sm" | "md";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  canAct = true,
  size = "md",
}: EmptyStateProps) {
  const isSm = size === "sm";

  return (
    <motion.div
      className={`flex flex-col items-center justify-center text-center ${isSm ? "py-10 px-4" : "py-16 px-6"}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Concentric rings + icon */}
      <div className={`relative flex items-center justify-center mb-5 ${isSm ? "mb-4" : "mb-6"}`}>
        {/* Outermost ring */}
        <motion.div
          className="absolute rounded-full bg-primary/5"
          style={{ width: isSm ? 88 : 112, height: isSm ? 88 : 112 }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full bg-primary/8"
          style={{ width: isSm ? 64 : 80, height: isSm ? 64 : 80 }}
        />
        {/* Icon container */}
        <div
          className={`relative z-10 flex items-center justify-center rounded-2xl bg-primary/12 ${
            isSm ? "h-12 w-12" : "h-16 w-16"
          }`}
          style={{ backgroundColor: "hsl(var(--primary) / 0.12)" }}
        >
          <Icon
            className="text-primary"
            style={{ width: isSm ? 22 : 30, height: isSm ? 22 : 30 }}
            strokeWidth={1.6}
          />
        </div>
      </div>

      {/* Text */}
      <motion.h3
        className={`font-display font-bold text-foreground leading-tight mb-2 ${
          isSm ? "text-base" : "text-xl"
        }`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {title}
      </motion.h3>

      <motion.p
        className={`text-muted-foreground leading-relaxed max-w-xs ${isSm ? "text-sm mb-5" : "text-sm mb-7"}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {description}
      </motion.p>

      {/* Actions */}
      {canAct && (actionLabel || secondaryLabel) && (
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-2.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
        >
          {actionLabel && onAction && (
            <Button
              onClick={onAction}
              size={isSm ? "sm" : "default"}
              className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-sm shadow-primary/20"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button
              variant="ghost"
              size={isSm ? "sm" : "default"}
              onClick={onSecondary}
              className="text-muted-foreground hover:text-foreground"
            >
              {secondaryLabel}
            </Button>
          )}
        </motion.div>
      )}

      {/* Hint when action is hidden (no permission) */}
      {!canAct && actionLabel && (
        <motion.p
          className="text-xs text-muted-foreground/60 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          Contact your administrator to add records.
        </motion.p>
      )}
    </motion.div>
  );
}
