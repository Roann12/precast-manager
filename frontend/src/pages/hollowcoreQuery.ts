// File overview: Page component and UI logic for pages/hollowcoreQuery.ts.
import api from "../api/client";
import type { Element, HollowcoreCast } from "../types/api";

/** `/hollowcore/settings` response (planner factory settings). */
export type HollowcoreFactorySettings = {
  default_waste_mm: number;
  default_casts_per_day: number;
  cutting_strength_mpa: number;
  final_strength_mpa: number;
};

export const HOLLOWCORE_SETTINGS_KEY = ["hollowcore", "settings"] as const;

// Fetches data for hollowcore settings from the API.
export async function fetchHollowcoreSettings(): Promise<HollowcoreFactorySettings> {
  return (await api.get<HollowcoreFactorySettings>("/hollowcore/settings")).data;
}

// Inputs: caller state/arguments related to hollowcore casts range key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const hollowcoreCastsRangeKey = (fromDate: string, toDate: string) =>
  // Include date range in key so each planner window caches independently.
  ["hollowcore", "casts", "range", fromDate, toDate] as const;

// Fetches data for hollowcore casts range from the API.
export async function fetchHollowcoreCastsRange(fromDate: string, toDate: string): Promise<HollowcoreCast[]> {
  const { data } = await api.get<HollowcoreCast[]>("/hollowcore/casts", {
    params: { from_date: fromDate, to_date: toDate },
  });
  return data ?? [];
}

/** Unfiltered casts list (used for hollowcore element staging summaries). */
export const HOLLOWCORE_CASTS_REGISTRY_KEY = ["hollowcore", "casts", "registry"] as const;

// Fetches data for hollowcore casts registry from the API.
export async function fetchHollowcoreCastsRegistry(): Promise<
  Array<{ element_id?: number; quantity?: number; status?: string }>
> {
  const { data } = await api.get<Array<{ element_id?: number; quantity?: number; status?: string }>>(
    "/hollowcore/casts"
  );
  return data ?? [];
}

export const HOLLOWCORE_ELEMENTS_HC_KEY = ["elements", "hollowcore-only"] as const;

// Fetches data for hollowcore elements list from the API.
export async function fetchHollowcoreElementsList(): Promise<Element[]> {
  const { data } = await api.get<Element[]>("/elements/", { params: { hollowcore_only: true } });
  return data ?? [];
}

export const HOLLOWCORE_BEDS_KEY = ["hollowcore", "beds"] as const;

export type HollowcoreBedRow = {
  id: number;
  name: string;
  length_mm: number;
  max_casts_per_day: number;
  active: boolean;
};

// Fetches data for hollowcore beds from the API.
export async function fetchHollowcoreBeds(): Promise<HollowcoreBedRow[]> {
  return (await api.get<HollowcoreBedRow[]>("/hollowcore/beds")).data ?? [];
}

// Inputs: caller state/arguments related to hollowcore casts day key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const hollowcoreCastsDayKey = (day: string, statusFilter: string) =>
  // Status is part of the key to avoid mixing filtered and unfiltered day results.
  ["hollowcore", "casts", "day", day, statusFilter || "__all__"] as const;

// Fetches data for hollowcore casts for day from the API.
export async function fetchHollowcoreCastsForDay(day: string, statusFilter: string) {
  const { data } = await api.get<HollowcoreCast[]>("/hollowcore/casts", {
    params: {
      from_date: day || undefined,
      to_date: day || undefined,
      status_filter: statusFilter || undefined,
    },
  });
  return data ?? [];
}

/** Hollowcore planner delay rows (normalized from `/planner/delays`). */
export type HollowcorePlannerDelay = {
  id: number;
  date: string;
  bed_id: number | null;
  lost_slots: number;
  reason: string;
};

// Inputs: caller state/arguments related to hollowcore planner delays key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const hollowcorePlannerDelaysKey = (from: string, to: string) =>
  ["planner", "delays", "hollowcore", from, to] as const;

// Fetches data for hollowcore planner delays from the API.
export async function fetchHollowcorePlannerDelays(
  from: string,
  to: string
): Promise<HollowcorePlannerDelay[]> {
  const { data } = await api.get<
    Array<{
      id: unknown;
      delay_date: unknown;
      bed_id: unknown;
      lost_capacity: unknown;
      reason: unknown;
    }>
  >("/planner/delays", {
    params: { planner_type: "hollowcore", from_date: from, to_date: to },
  });
  return (data ?? []).map((d) => ({
    // Normalize backend field names/types to planner-friendly shape.
    id: Number(d.id),
    date: String(d.delay_date).slice(0, 10),
    bed_id: d.bed_id == null ? null : Number(d.bed_id),
    lost_slots: Number(d.lost_capacity ?? 1),
    reason: String(d.reason ?? ""),
  }));
}
