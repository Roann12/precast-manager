// File overview: Core frontend setup and app-level wiring for QueryClientBridge.tsx.
import { useRef, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useNotify } from "./notifications/NotifyContext";
import { createQueryClient } from "./queryClient";

// Inputs: caller state/arguments related to query client bridge.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export function QueryClientBridge({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [client] = useState(() =>
    createQueryClient(() => notifyRef.current)
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
