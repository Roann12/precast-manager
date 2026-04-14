// File overview: Core frontend setup and app-level wiring for queryClient.ts.
import { QueryCache, QueryClient } from "@tanstack/react-query";
import axios from "axios";

export type QueryNotifyApi = { error: (message: string) => void };

// Formats query error message for display.
export function formatQueryErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data;
    const detail =
      typeof d === "object" && d !== null && "detail" in d
        ? (d as { detail?: unknown }).detail
        : undefined;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail != null) {
      try {
        return JSON.stringify(detail);
      } catch {
        return String(detail);
      }
    }
    if (error.message?.trim()) return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong";
}

// Creates and configures query client.
export function createQueryClient(getNotify: () => QueryNotifyApi) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // AuthContext handles 401 flow globally; suppress duplicate toast noise here.
        if (axios.isAxiosError(error) && error.response?.status === 401) return;
        getNotify().error(formatQueryErrorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
