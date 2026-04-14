// File overview: Page component and UI logic for pages/dispatchQuery.ts.
import api from "../api/client";
import type { DispatchOrder } from "../types/api";

export const DISPATCH_ORDERS_KEY = ["dispatch", "orders"] as const;

// Fetches data for dispatch orders from the API.
export async function fetchDispatchOrders(): Promise<DispatchOrder[]> {
  return (await api.get<DispatchOrder[]>("/dispatch")).data;
}
