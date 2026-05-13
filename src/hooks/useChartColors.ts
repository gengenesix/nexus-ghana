/**
 * Recharts-compatible color tokens using the CampusAid
 * forest/lime/cream design system (always light theme).
 */
export function useChartColors() {
  return {
    tooltipStyle: {
      background:   "white",
      border:       "1px solid hsl(45, 15%, 87%)",
      borderRadius: 12,
      color:        "hsl(140, 28%, 16%)",
      fontSize:     13,
      fontFamily:   "'Plus Jakarta Sans', system-ui, sans-serif",
    } as React.CSSProperties,
    gridColor:  "hsl(45, 15%, 87%)",
    axisColor:  "hsl(140, 10%, 44%)",
  };
}

/* Shared chart color palette — forest, lime, greens, blues, red, amber */
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
