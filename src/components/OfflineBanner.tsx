import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const online  = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online",  online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online",  online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold"
      style={{ backgroundColor: "hsl(37 90% 55%)", color: "#1a3a22" }}
    >
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      You&rsquo;re offline — showing cached data. Sales made now will sync when you reconnect.
    </div>
  );
}
