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

export async function fetchElementsAll(): Promise<Element[]> {
  return (await api.get<Element[]>("/elements/")).data;
}

export const ELEMENTS_INCLUDE_INACTIVE_KEY = ["elements", "include-inactive"] as const;

export async function fetchElementsIncludeInactive(): Promise<Element[]> {
  return (await api.get<Element[]>("/elements/", { params: { include_inactive: true } })).data ?? [];
}

export async function fetchElementsPrefabPage(): Promise<ElementsPrefabPage> {
  const [elementsRes, progressRes] = await Promise.all([
    api.get<Element[]>("/elements/"),
    api.get<ElementProgress[]>("/elements/progress"),
  ]);
  const items = elementsRes.data.filter(
    (e) => !(e.panel_length_mm != null && e.slab_thickness_mm != null)
  );
  const progressByElementId = Object.fromEntries((progressRes.data ?? []).map((p) => [p.element_id, p]));
  return { items, progressByElementId };
}

export async function fetchProjectsOptions(): Promise<Project[]> {
  return (await api.get<Project[]>("/projects")).data;
}

export async function fetchMouldsList(): Promise<Mould[]> {
  return (await api.get<Mould[]>("/moulds")).data;
}

export async function fetchActiveMixDesigns(): Promise<MixDesign[]> {
  const { data } = await api.get<MixDesign[]>("/mix-designs");
  return data.filter((m) => m.active);
}
