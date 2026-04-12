import api from "../api/client";
import type { DashboardCalendarItem } from "../types/api";

export const PLANNER_CALENDAR_KEY = ["dashboard", "calendar"] as const;

export async function fetchPlannerCalendar(): Promise<DashboardCalendarItem[]> {
  return (await api.get<DashboardCalendarItem[]>("/dashboard/calendar")).data;
}
