import { useDarkMode } from "./useDarkMode";

/**
 * Recharts-compatible color tokens that adapt to light/dark mode.
 */
export function useChartColors() {
  const isDark = useDarkMode();

  const textColor = isDark ? "hsl(45, 25%, 90%)" : "hsl(140, 28%, 16%)";

  return {
    tooltipStyle: {
      background:   isDark ? "hsl(140, 20%, 13%)" : "white",
      border:       isDark ? "1px solid hsl(140, 15%, 25%)" : "1px solid hsl(45, 15%, 87%)",
      borderRadius: 12,
      color:        textColor,
      fontSize:     13,
      fontFamily:   "'Plus Jakarta Sans', system-ui, sans-serif",
    } as React.CSSProperties,
    // Recharts does NOT inherit contentStyle.color onto label/items — pass these explicitly
    labelStyle: { color: textColor, fontWeight: 600 } as React.CSSProperties,
    itemStyle:  { color: textColor } as React.CSSProperties,
    gridColor:    isDark ? "hsl(140, 12%, 22%)"  : "hsl(45, 15%, 87%)",
    axisColor:    isDark ? "hsl(45, 20%, 72%)"   : "hsl(140, 10%, 44%)",
    primaryColor: isDark ? "hsl(86, 65%, 60%)"   : "hsl(140, 28%, 16%)",
    gradientStart:isDark ? "hsl(86, 65%, 60%)"   : "hsl(140, 28%, 16%)",
  };
}

/**
 * Returns a full chart color palette that is readable in both light and dark mode.
 * Use this instead of hardcoded dark-green color arrays.
 */
export function useChartPalette(): string[] {
  const isDark = useDarkMode();
  return isDark
    ? [
        "hsl(86, 65%, 60%)",    // lime
        "hsl(170, 55%, 55%)",   // teal
        "hsl(210, 80%, 65%)",   // blue
        "hsl(38, 90%, 60%)",    // amber
        "hsl(0, 70%, 65%)",     // red
        "hsl(280, 55%, 70%)",   // purple
        "hsl(140, 45%, 55%)",   // mid green
        "hsl(30, 80%, 65%)",    // orange
      ]
    : [
        "hsl(140, 28%, 16%)",   // forest
        "hsl(86, 68%, 52%)",    // lime
        "hsl(142, 60%, 38%)",   // mid green
        "hsl(210, 70%, 48%)",   // blue
        "hsl(0, 72%, 51%)",     // red
        "hsl(38, 92%, 50%)",    // amber
        "hsl(280, 50%, 50%)",   // purple
        "hsl(170, 55%, 40%)",   // teal
      ];
}

/* Static light-mode palette — kept for non-hook contexts */
export const CHART_COLORS = [
  "hsl(140, 28%, 16%)",
  "hsl(86, 68%, 52%)",
  "hsl(142, 60%, 38%)",
  "hsl(210, 70%, 48%)",
  "hsl(0, 72%, 51%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 50%, 50%)",
  "hsl(170, 55%, 40%)",
];
