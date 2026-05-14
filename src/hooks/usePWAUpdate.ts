import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Detects when a new service worker has taken control (meaning a new version
 * of the app has been deployed and activated). Shows a brief toast then reloads
 * so the user is always on the latest build — no stale cache, no manual refresh.
 *
 * Works for both regular browser tabs and installed PWAs.
 */
export function usePWAUpdate() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      toast.loading("Updating to latest version...", { duration: 1200 });
      // Small delay so the toast is visible before reload
      setTimeout(() => window.location.reload(), 900);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
}
