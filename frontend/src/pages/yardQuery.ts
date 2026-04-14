// File overview: Page component and UI logic for pages/yardQuery.ts.
import api from "../api/client";
import type { YardInventoryRow, YardLocation } from "../types/api";

export const YARD_INVENTORY_KEY = ["yard", "inventory"] as const;
export const YARD_LOCATIONS_KEY = ["yard", "locations"] as const;

// Fetches data for yard inventory from the API.
export async function fetchYardInventory(): Promise<YardInventoryRow[]> {
  return (await api.get<YardInventoryRow[]>("/yard/inventory")).data;
}

// Fetches data for yard locations from the API.
export async function fetchYardLocations(): Promise<YardLocation[]> {
  return (await api.get<YardLocation[]>("/yard/locations")).data;
}
