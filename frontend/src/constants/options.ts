// File overview: Shared frontend constants used across features for constants/options.ts.
export const ELEMENT_TYPES = ["Column", "Beam", "Wall", "Slab", "Footing", "Staircase", "Pier", "Railing", "Foundation", "Hollowcore Panel","hollwcore walling" , "Other"] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const MOULD_TYPES = ELEMENT_TYPES;
export type MouldType = (typeof MOULD_TYPES)[number];

export const PROJECT_STATUSES = ["planned", "active", "suspended", "stopped", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const ELEMENT_STATUSES = ["planned", "scheduled", "in_production", "completed", "cancelled"] as const;
export type ElementStatus = (typeof ELEMENT_STATUSES)[number];

