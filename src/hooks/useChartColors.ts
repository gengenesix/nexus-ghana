import { useState, useEffect } from "react";

/**
 * Returns Recharts-compatible color tokens that react to the current
 * dark/light theme (ThemeToggle adds/removes the "light" class on <html>).
 */
export function useChartColors() {
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains("light")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains("light"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return {
    tooltipStyle: {
      background:   isLight ? "hsl(0, 0%, 100%)"       : "hsl(220, 35%, 12%)",
      border:       isLight ? "1px solid hsl(220, 13%, 87%)" : "1px solid hsl(220, 20%, 20%)",
      borderRadius: 8,
      color:        isLight ? "hsl(222, 47%, 11%)"      : "hsl(210, 40%, 96%)",
    } as React.CSSProperties,
    gridColor:  isLight ? "hsl(220, 13%, 87%)" : "hsl(220, 20%, 20%)",
    axisColor:  isLight ? "hsl(220, 8%, 46%)"  : "hsl(215, 15%, 55%)",
  };
}
