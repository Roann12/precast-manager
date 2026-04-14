// File overview: Core frontend setup and app-level wiring for main.tsx.
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import App from "./App";
import { theme } from "./theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotifyProvider } from "./notifications/NotifyContext";
import { QueryClientBridge } from "./QueryClientBridge";

// Session flag prevents an infinite reload loop when asset recovery fails.
const CHUNK_ERROR_RELOAD_KEY = "pm:chunk-reload-attempted";

const isChunkLoadError = (message: string | undefined) =>
  !!message &&
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(message);

async function recoverFromStaleAssets() {
  try {
    // If an old service worker is still active, remove it so fresh assets can be fetched.
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    // Delete cached bundles that may no longer match the deployed app version.
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch (error) {
    console.error("Failed to clear stale app caches", error);
  } finally {
    window.location.reload();
  }
}

// Runtime errors can happen when a user has stale JS chunks after deployment.
window.addEventListener("error", (event) => {
  const message = event?.error?.message || event?.message;
  if (!isChunkLoadError(message)) return;
  if (sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
  void recoverFromStaleAssets();
});

// Promise-based chunk failures surface as unhandled rejections instead of window errors.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const message = typeof reason === "string" ? reason : reason?.message;
  if (!isChunkLoadError(message)) return;
  if (sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, "1");
  void recoverFromStaleAssets();
});

// Provider order matters: theme + notifications + query client + error boundary wrap the full app.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <NotifyProvider>
        <QueryClientBridge>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </QueryClientBridge>
      </NotifyProvider>
    </ThemeProvider>
  </React.StrictMode>
);
