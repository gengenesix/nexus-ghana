import { useEffect } from "react";
import { Outlet } from "react-router-dom";

/**
 * PublicLayout — wraps all public-facing pages (landing, login, register,
 * terms, user-guide, onboarding, join-business).
 *
 * Actively strips any app-shell theme class ("dark" / "light") from <html>
 * on every mount so the app's dark-mode preference never bleeds into
 * public pages regardless of how the user arrived (SPA navigation or
 * hard reload). Public pages always render in their own CSS defaults.
 */
export function PublicLayout() {
  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
  }, []);

  return <Outlet />;
}
