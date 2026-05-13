/**
 * NexisLogo — reusable brand components.
 * The "i" in Nexis has a custom oversized dot (dark fill, light hole)
 * inspired by the CampusAid iconic-i treatment.
 */

interface SpecialIProps {
  /** fill color of the big outer circle */
  dotFill: string;
  /** fill color of the inner contrasting circle */
  holeFill: string;
}

/** The letter "i" with an oversized branded dot above it */
function SpecialI({ dotFill, holeFill }: SpecialIProps) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* dotless i (U+0131) — no default font dot */}
      ı
      {/* custom dot — large circle with a contrasting inner ring */}
      <span
        style={{
          position: "absolute",
          top: "-0.3em",
          left: "50%",
          transform: "translateX(-50%)",
          width: "0.48em",
          height: "0.48em",
          borderRadius: "50%",
          backgroundColor: dotFill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "block",
            width: "0.2em",
            height: "0.2em",
            borderRadius: "50%",
            backgroundColor: holeFill,
          }}
        />
      </span>
    </span>
  );
}

interface NexisWordmarkProps {
  /** true = on a dark (forest) background → white dot, forest hole */
  onDark?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/** Full "Nexis" wordmark with iconic i-dot */
export function NexisWordmark({ onDark = false, style, className }: NexisWordmarkProps) {
  const dotFill  = onDark ? "white"          : "var(--forest)";
  const holeFill = onDark ? "var(--forest)"  : "white";

  return (
    <span
      className={className}
      style={{
        fontWeight: 800,
        letterSpacing: "-0.04em",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        ...style,
      }}
    >
      Nex<SpecialI dotFill={dotFill} holeFill={holeFill} />s
    </span>
  );
}

interface NexisBadgeProps {
  /** size of the badge square in px */
  size?: number;
  /** if true, badge shows dark bg with lime text (default sidebar style) */
  onDark?: boolean;
  className?: string;
}

/** Square badge icon — shows "Ni" with the special i dot */
export function NexisBadge({ size = 36, onDark = false, className }: NexisBadgeProps) {
  const bg        = onDark ? "var(--lime)"   : "var(--forest)";
  const fg        = onDark ? "var(--forest)" : "var(--lime)";
  const dotFill   = onDark ? "var(--forest)" : "white";
  const holeFill  = onDark ? "white"         : "var(--forest)";
  const radius    = Math.round(size * 0.28);
  const fontSize  = Math.round(size * 0.38);

  return (
    <span
      className={`flex items-center justify-center font-black shrink-0 select-none ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        color: fg,
        fontSize,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        letterSpacing: "-0.03em",
        fontWeight: 900,
      }}
    >
      N<SpecialI dotFill={dotFill} holeFill={holeFill} />
    </span>
  );
}
