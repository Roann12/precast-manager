import api from "../api/client";
import type { Project } from "../types/api";
import { PROJECT_STATUSES } from "../constants/options";

export type ProjectVisibilityFilter = "active_only" | "all" | (typeof PROJECT_STATUSES)[number];

export type ProjectListParams = { search: string; filter: ProjectVisibilityFilter };

export function buildProjectListParams(search: string, visibilityFilter: ProjectVisibilityFilter) {
  const params: Record<string, string | boolean> = {};
  if (search.trim()) {
    params.search = search.trim();
    params.include_inactive = true;
  } else if (visibilityFilter === "active_only") {
    params.include_inactive = false;
  } else if (visibilityFilter === "all") {
    params.include_inactive = true;
  } else {
    params.status = visibilityFilter as (typeof PROJECT_STATUSES)[number];
    params.include_inactive = true;
  }
  return params;
}

export async function fetchProjectList(list: ProjectListParams): Promise<Project[]> {
  const { data } = await api.get<Project[]>("/projects", {
    params: buildProjectListParams(list.search, list.filter),
  });
  return data;
}

export const projectDetailQueryKey = (id: number) => ["projects", "detail", id] as const;

export async function fetchProjectDetail(id: number): Promise<Project> {
  return (await api.get<Project>(`/projects/${id}`)).data;
}
