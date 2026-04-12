import { useRef, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useNotify } from "./notifications/NotifyContext";
import { createQueryClient } from "./queryClient";

export function QueryClientBridge({ children }: { children: ReactNode }) {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [client] = useState(() =>
    createQueryClient(() => notifyRef.current)
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
