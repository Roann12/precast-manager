import api from "../api/client";
import type { DispatchOrder } from "../types/api";

export const DISPATCH_ORDERS_KEY = ["dispatch", "orders"] as const;

export async function fetchDispatchOrders(): Promise<DispatchOrder[]> {
  return (await api.get<DispatchOrder[]>("/dispatch")).data;
}
