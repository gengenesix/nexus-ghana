import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("nexus-theme");
    if (stored) return stored === "dark";
    return true; // default dark
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("light");
      root.classList.add("dark");
      localStorage.setItem("nexus-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("nexus-theme", "light");
    }
  }, [isDark]);

  return (
    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsDark(!isDark)}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
