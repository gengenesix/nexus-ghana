/**
 * IndustryPicker
 * ──────────────
 * Visual card grid for selecting an industry vertical during onboarding.
 *
 * Design system: Apple-level icon treatment
 * - Premium earthy palette: deep, muted tones anchored to the forest/amber brand
 * - Gradient icon backgrounds with inner highlight and coloured drop shadow
 * - Unified forest-green selected state (not per-industry colour chaos)
 * - Clean Framer Motion stagger entrance
 */
import { motion } from "framer-motion";
import {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INDUSTRIES, type IndustryVertical } from "@/lib/industryConfig";

// ── Icon component map ─────────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag, Utensils, Package2, Factory, Pill, Briefcase,
  HardHat, Truck, BedDouble, Wrench, Leaf, Scissors, Landmark,
};

// ── Premium earthy colour palette ─────────────────────────────────────────────
// Each industry gets a gradient pair (top → bottom) that feels deep and
// purposeful — not Material Design / generic SaaS rainbow.
// All colours are "owned": high saturation at a low-to-medium lightness.
const ICON_PALETTE: Record<string, { from: string; to: string; shadow: string }> = {
  retail:          { from: "#C97D1A", to: "#9A5C08", shadow: "#b86c0c" },
  "food-beverage": { from: "#C94030", to: "#9A2318", shadow: "#b03020" },
  wholesale:       { from: "#2F65B5", to: "#1A428A", shadow: "#244e98" },
  manufacturing:   { from: "#3D4F63", to: "#222D3D", shadow: "#2d3d50" },
  pharmacy:        { from: "#0E8068", to: "#085C4A", shadow: "#0a6c57" },
  professional:    { from: "#1E4577", to: "#0F2B52", shadow: "#163561" },
  construction:    { from: "#A8620E", to: "#784408", shadow: "#915410" },
  transport:       { from: "#1575A8", to: "#0A4E78", shadow: "#10628f" },
  hospitality:     { from: "#6435AA", to: "#3F1A80", shadow: "#512d95" },
  auto:            { from: "#405570", to: "#253245", shadow: "#31435a" },
  agriculture:     { from: "#1D6635", to: "#0E4020", shadow: "#175428" },
  beauty:          { from: "#B03270", to: "#7A1A50", shadow: "#962858" },
  financial:       { from: "#1C3D6B", to: "#0C2244", shadow: "#142e55" },
};

// Fallback if slug not found
const FALLBACK_PALETTE = { from: "#1D6635", to: "#0E4020", shadow: "#175428" };

// ── IndustryCard ───────────────────────────────────────────────────────────────

interface IndustryCardProps {
  industry: IndustryVertical;
  selected: boolean;
  onSelect: (slug: string) => void;
  index: number;
}

function IndustryCard({ industry, selected, onSelect, index }: IndustryCardProps) {
  const Icon = ICON_MAP[industry.iconKey] ?? ShoppingBag;
  const palette = ICON_PALETTE[industry.slug] ?? FALLBACK_PALETTE;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(industry.slug)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.035, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: "14px 14px 15px",
        borderRadius: 20,
        border: selected
          ? "2px solid #1a5c2e"
          : "1.5px solid rgba(0,0,0,0.08)",
        backgroundColor: selected
          ? "rgba(26, 92, 46, 0.05)"
          : "white",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.18s, transform 0.18s",
        boxShadow: selected
          ? "0 0 0 3px rgba(26, 92, 46, 0.12), 0 2px 12px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.05), 0 1px 8px rgba(0,0,0,0.04)",
        outline: "none",
      }}
      aria-pressed={selected}
    >
      {/* Selected checkmark — forest green, top-right */}
      {selected && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18, ease: "backOut" }}
          style={{
            position: "absolute",
            top: 9,
            right: 9,
          }}
        >
          <CheckCircle2
            style={{ color: "#1a5c2e", width: 17, height: 17 }}
            strokeWidth={2.5}
          />
        </motion.span>
      )}

      {/* Icon — gradient + inner highlight + coloured drop shadow */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: `linear-gradient(150deg, ${palette.from} 0%, ${palette.to} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: [
            `inset 0 1.5px 0 rgba(255,255,255,0.22)`,
            `inset 0 -1px 0 rgba(0,0,0,0.15)`,
            `0 4px 16px ${palette.shadow}66`,
          ].join(", "),
        }}
      >
        <Icon
          style={{ width: 25, height: 25, color: "rgba(255,255,255,0.95)" }}
          strokeWidth={1.75}
        />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: selected ? 20 : 0 }}>
        <p
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "#1a3a22",
            lineHeight: 1.3,
            marginBottom: 3,
            letterSpacing: "-0.01em",
          }}
        >
          {industry.name}
        </p>
        <p
          style={{
            fontSize: 10,
            color: "#8a9090",
            lineHeight: 1.45,
            fontWeight: 400,
          }}
        >
          {industry.tagline}
        </p>
      </div>
    </motion.button>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

interface IndustryPickerProps {
  value: string;
  onChange: (slug: string) => void;
}

export function IndustryPicker({ value, onChange }: IndustryPickerProps) {
  const sorted = [...INDUSTRIES].sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedIndustry = sorted.find(i => i.slug === value);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: "clamp(1.2rem, 2.5vw, 1.45rem)",
            fontWeight: 800,
            color: "#1a3a22",
            letterSpacing: "-0.028em",
            marginBottom: 5,
            lineHeight: 1.2,
          }}
        >
          What type of business are you running?
        </h2>
        <p style={{ fontSize: 13, color: "#6b7675", fontWeight: 400, lineHeight: 1.5 }}>
          We'll configure your workspace, dashboard, and modules for your industry.
        </p>
      </div>

      {/* Industry grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 9,
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

      {/* Selection confirmation banner */}
      {selectedIndustry && (
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 9,
            borderRadius: 14,
            padding: "11px 16px",
            backgroundColor: "rgba(26, 92, 46, 0.07)",
            border: "1.5px solid rgba(26, 92, 46, 0.18)",
          }}
        >
          <CheckCircle2 style={{ width: 15, height: 15, color: "#1a5c2e", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1a3a22" }}>
            <span style={{ color: "#1a5c2e" }}>{selectedIndustry.name}</span> selected — your workspace will be personalised for this.
          </span>
        </motion.div>
      )}
    </div>
  );
}
