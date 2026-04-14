// File overview: Page component and UI logic for pages/plannerQuery.ts.
import api from "../api/client";
import type { DashboardCalendarItem } from "../types/api";

export const PLANNER_CALENDAR_KEY = ["dashboard", "calendar"] as const;

// Fetches data for planner calendar from the API.
export async function fetchPlannerCalendar(): Promise<DashboardCalendarItem[]> {
  return (await api.get<DashboardCalendarItem[]>("/dashboard/calendar")).data;
}
