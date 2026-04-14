// File overview: Page component and UI logic for pages/elementsQuery.ts.
import api from "../api/client";
import type { Element, ElementProgress, MixDesign, Mould, Project } from "../types/api";

export const ELEMENTS_PREFAB_LIST_KEY = ["elements", "prefab-list"] as const;
/** Raw `/elements/` response (includes hollowcore rows). Used by Production and invalidated with prefab list. */
export const ELEMENTS_ALL_KEY = ["elements", "all"] as const;
export const PROJECTS_OPTIONS_KEY = ["projects", "options"] as const;
export const MOULDS_LIST_KEY = ["moulds", "list"] as const;
export const MIX_DESIGNS_ACTIVE_KEY = ["mix-designs", "active"] as const;

export type ElementsPrefabPage = {
  items: Element[];
  progressByElementId: Record<number, ElementProgress>;
};

// Fetches data for elements all from the API.
export async function fetchElementsAll(): Promise<Element[]> {
  return (await api.get<Element[]>("/elements/")).data;
}

export const ELEMENTS_INCLUDE_INACTIVE_KEY = ["elements", "include-inactive"] as const;

// Fetches data for elements include inactive from the API.
export async function fetchElementsIncludeInactive(): Promise<Element[]> {
  return (await api.get<Element[]>("/elements/", { params: { include_inactive: true } })).data ?? [];
}

// Fetches data for elements prefab page from the API.
export async function fetchElementsPrefabPage(): Promise<ElementsPrefabPage> {
  const [elementsRes, progressRes] = await Promise.all([
    api.get<Element[]>("/elements/"),
    api.get<ElementProgress[]>("/elements/progress"),
  ]);
  // Wetcast list excludes hollowcore rows (those have panel length + slab thickness).
  const items = elementsRes.data.filter(
    (e) => !(e.panel_length_mm != null && e.slab_thickness_mm != null)
  );
  const progressByElementId = Object.fromEntries((progressRes.data ?? []).map((p) => [p.element_id, p]));
  return { items, progressByElementId };
}

// Fetches data for projects options from the API.
export async function fetchProjectsOptions(): Promise<Project[]> {
  return (await api.get<Project[]>("/projects")).data;
}

// Fetches data for moulds list from the API.
export async function fetchMouldsList(): Promise<Mould[]> {
  return (await api.get<Mould[]>("/moulds")).data;
}

// Fetches data for active mix designs from the API.
export async function fetchActiveMixDesigns(): Promise<MixDesign[]> {
  const { data } = await api.get<MixDesign[]>("/mix-designs");
  // Keep UI selectors focused on mixes that are currently usable in production.
  return data.filter((m) => m.active);
}
