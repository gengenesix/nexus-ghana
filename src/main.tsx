import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// vite-plugin-pwa (registerType: "autoUpdate") handles SW registration
// and calls skipWaiting() automatically when a new version is deployed.
// This listener reloads the page the moment the new SW takes control,
// ensuring users always run the latest code — including in installed PWAs.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
