// File overview: Page component and UI logic for pages/productionQuery.ts.
import api from "../api/client";
import type { ProductionSchedule } from "../types/api";

export const PRODUCTION_SCHEDULE_KEY = ["production", "schedule"] as const;

// Fetches data for production schedule from the API.
export async function fetchProductionSchedule(): Promise<ProductionSchedule[]> {
  return (await api.get<ProductionSchedule[]>("/production/schedule")).data;
}
