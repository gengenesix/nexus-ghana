/**
 * IndustryPicker
 * ──────────────
 * Visual card grid for selecting an industry vertical during onboarding.
 * Renders 13 industry cards with professional SVG icons, animated entrance,
 * and a clear selected state matching the Nexis brand.
 *
 * Design: Forest/lime/cream palette · Framer Motion stagger · 3-col grid
 */
import { motion } from "framer-motion";
import {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INDUSTRIES, type IndustryVertical } from "@/lib/industryConfig";

// ── Icon map: iconKey (string) → Lucide component ─────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface IndustryCardProps {
  industry: IndustryVertical;
  selected: boolean;
  onSelect: (slug: string) => void;
  index: number;
}

function IndustryCard({ industry, selected, onSelect, index }: IndustryCardProps) {
  const Icon = ICON_MAP[industry.iconKey] ?? ShoppingBag;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(industry.slug)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
      whileHover={{ scale: 1.025, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: "14px 14px 16px",
        borderRadius: 18,
        border: selected
          ? `2px solid var(--forest)`
          : "2px solid hsl(var(--border))",
        backgroundColor: selected ? industry.accentHex : "white",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
        boxShadow: selected
          ? `0 0 0 3px ${industry.colorHex}22`
          : "0 1px 4px rgba(0,0,0,0.06)",
        outline: "none",
      }}
      aria-pressed={selected}
    >
      {/* Selected checkmark badge */}
      {selected && (
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
          }}
        >
          <CheckCircle2
            style={{ color: "var(--forest)", width: 18, height: 18 }}
            strokeWidth={2.5}
          />
        </motion.span>
      )}

      {/* Industry icon with colored background */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: industry.colorHex,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 4px 12px ${industry.colorHex}44`,
        }}
      >
        <Icon
          style={{ width: 24, height: 24, color: "white" }}
          strokeWidth={1.8}
        />
      </div>

      {/* Labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--forest)",
            lineHeight: 1.3,
            marginBottom: 2,
            letterSpacing: "-0.01em",
          }}
        >
          {industry.name}
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: "var(--muted-foreground)",
            lineHeight: 1.4,
            fontWeight: 400,
          }}
        >
          {industry.tagline}
        </p>
      </div>
    </motion.button>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────

interface IndustryPickerProps {
  value: string;
  onChange: (slug: string) => void;
}

export function IndustryPicker({ value, onChange }: IndustryPickerProps) {
  const sorted = [...INDUSTRIES].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2
          style={{
            fontSize: "clamp(1.25rem, 2.5vw, 1.5rem)",
            fontWeight: 800,
            color: "var(--forest)",
            letterSpacing: "-0.025em",
            marginBottom: 6,
          }}
        >
          What type of business are you running?
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--muted-foreground)", fontWeight: 400 }}>
          We'll configure your workspace, dashboard, and modules for your industry.
        </p>
      </div>

      {/* Industry grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
        role="group"
        aria-label="Select your industry"
      >
        {sorted.map((industry, index) => (
          <IndustryCard
            key={industry.slug}
            industry={industry}
            selected={value === industry.slug}
            onSelect={onChange}
            index={index}
          />
        ))}
      </div>

      {/* Selection indicator */}
      {value && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ backgroundColor: INDUSTRY_MAP_LOCAL[value]?.accentHex ?? "var(--cream-dark)" }}
        >
          <CheckCircle2 style={{ width: 16, height: 16, color: "var(--forest)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)" }}>
            {INDUSTRY_MAP_LOCAL[value]?.name} selected — your workspace will be personalised for this.
          </span>
        </motion.div>
      )}
    </div>
  );
}

// Local map for the selection banner (avoids importing heavy industryConfig in this component)
const INDUSTRY_MAP_LOCAL = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i])
) as Record<string, IndustryVertical>;
