import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import App from "./App";
import { theme } from "./theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotifyProvider } from "./notifications/NotifyContext";
import { QueryClientBridge } from "./QueryClientBridge";

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
