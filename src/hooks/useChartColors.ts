import { useDarkMode } from "./useDarkMode";

/**
 * Recharts-compatible color tokens that adapt to light/dark mode.
 */
export function useChartColors() {
  const isDark = useDarkMode();

  return {
    tooltipStyle: {
      background:   isDark ? "hsl(140, 20%, 13%)" : "white",
      border:       isDark ? "1px solid hsl(140, 15%, 22%)" : "1px solid hsl(45, 15%, 87%)",
      borderRadius: 12,
      color:        isDark ? "hsl(45, 25%, 88%)" : "hsl(140, 28%, 16%)",
      fontSize:     13,
      fontFamily:   "'Plus Jakarta Sans', system-ui, sans-serif",
    } as React.CSSProperties,
    gridColor:    isDark ? "hsl(140, 15%, 20%)"  : "hsl(45, 15%, 87%)",
    axisColor:    isDark ? "hsl(45, 10%, 55%)"   : "hsl(140, 10%, 44%)",
    primaryColor: isDark ? "hsl(86, 65%, 60%)"   : "hsl(140, 28%, 16%)",
    gradientStart:isDark ? "hsl(86, 65%, 60%)"   : "hsl(140, 28%, 16%)",
  };
}

/* Shared chart color palette — adapts to dark/light */
export const CHART_COLORS = [
  "hsl(140, 28%, 16%)",   // forest
  "hsl(86, 68%, 52%)",    // lime (darker for charts)
  "hsl(142, 60%, 38%)",   // mid green
  "hsl(210, 70%, 48%)",   // blue
  "hsl(0, 72%, 51%)",     // red
  "hsl(38, 92%, 50%)",    // amber
  "hsl(280, 50%, 50%)",   // purple
  "hsl(170, 55%, 40%)",   // teal
];
