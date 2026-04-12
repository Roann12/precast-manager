import api from "../api/client";
import type { ProductionSchedule } from "../types/api";

export const PRODUCTION_SCHEDULE_KEY = ["production", "schedule"] as const;

export async function fetchProductionSchedule(): Promise<ProductionSchedule[]> {
  return (await api.get<ProductionSchedule[]>("/production/schedule")).data;
}
