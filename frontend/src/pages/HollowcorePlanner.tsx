// File overview: Page component and UI logic for pages/HollowcorePlanner.tsx.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  ELEMENTS_ALL_KEY,
  ELEMENTS_INCLUDE_INACTIVE_KEY,
  ELEMENTS_PREFAB_LIST_KEY,
  PROJECTS_OPTIONS_KEY,
  fetchElementsIncludeInactive,
  fetchProjectsOptions,
} from "./elementsQuery";
import {
  HOLLOWCORE_BEDS_KEY,
  HOLLOWCORE_CASTS_REGISTRY_KEY,
  HOLLOWCORE_ELEMENTS_HC_KEY,
  HOLLOWCORE_SETTINGS_KEY,
  fetchHollowcoreBeds,
  fetchHollowcoreCastsRange,
  fetchHollowcoreCastsRegistry,
  fetchHollowcorePlannerDelays,
  fetchHollowcoreSettings,
  hollowcoreCastsRangeKey,
  hollowcorePlannerDelaysKey,
  type HollowcorePlannerDelay,
} from "./hollowcoreQuery";
import { QC_QUEUE_KEY, fetchQcBatchStatus, qcBatchStatusKey } from "./qcQuery";

// Inputs: unknown error object and fallback message.
// Process: tries API-specific fields first, then generic error message.
// Output: user-safe message string for UI feedback.
function formatError(err: unknown, fallback: string) {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    fallback
  );
}

type Bed = { id: number; name: string; length_mm: number; max_casts_per_day: number; active: boolean };
type ElementRow = {
  id: number;
  element_mark?: string | null;
  element_type?: string | null;
  project_id?: number | null;
  due_date?: string | null;
  requires_cubes?: boolean;
  /** Order quantity (panels / units) — caps total hollowcore casts for this element. */
  quantity?: number;
};
type ProjectRow = { id: number; project_name?: string | null; due_date?: string | null };

type PlannedCast = {
  id?: number;
  cast_date: string;
  bed_id: number;
  cast_slot_index: number;
  element_id: number;
  panel_length_mm: number;
  slab_thickness_mm: number;
  quantity: number;
  used_length_mm: number;
  waste_mm: number;
  status?: string;
  batch_id?: string | null;
  /** Quantity attributed in DB when this row was loaded (0 for draft-from-generate rows). */
  baselineQty?: number;
};

type UnplacedRemainingRow = {
  element_id: number;
  element_mark?: string | null;
  remaining_qty: number;
  panel_length_mm: number;
};

type GenerateResponse = {
  beds: Bed[];
  casts: PlannedCast[];
  unplaced_remaining?: UnplacedRemainingRow[];
};

type DelayEvent = HollowcorePlannerDelay;

type CommitResult = {
  inserted?: number;
  updated?: number;
  deleted?: number;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Matches backend hollowcore_planner_v2 + planner_commit. */
function maxPanelsForBed(bed: Bed | undefined, defaultWasteMm: number, panelLengthMm: number): number {
  if (!bed || panelLengthMm <= 0) return 0;
  const usable = bed.length_mm - defaultWasteMm;
  if (usable <= 0) return 0;
  return Math.floor(usable / panelLengthMm);
}

// Inputs: caller state/arguments related to usable strip length mm.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function usableStripLengthMm(bedLengthMm: number, defaultWasteMm: number): number {
  const m = Math.max(0, defaultWasteMm);
  return Math.max(0, bedLengthMm - 2 * m);
}

// Inputs: caller state/arguments related to row used length mm.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function rowUsedLengthMm(r: PlannedCast): number {
  const u = Number(r.used_length_mm);
  if (Number.isFinite(u) && u > 0) return u;
  return Math.max(0, Number(r.quantity ?? 0) * Number(r.panel_length_mm ?? 0));
}

/**
 * Per bed+day: earlier slots get remaining usable strip after that segment (matches planner chaining);
 * the last slot gets physical bed free — same value as the visualization "Free" segment.
 */
function recomputeWasteMmForCasts(casts: PlannedCast[], bedById: Map<number, Bed>, defaultWasteMm: number): PlannedCast[] {
  // Recompute derived waste after every manual edit so UI stays physically consistent.
  const groups = new Map<string, PlannedCast[]>();
  for (const c of casts) {
    const k = `${c.cast_date}::${c.bed_id}`;
    const arr = groups.get(k) ?? [];
    arr.push(c);
    groups.set(k, arr);
  }

  const wasteByRowKey = new Map<string, number>();
  for (const [, arr] of groups) {
    const bedId = Number(arr[0]?.bed_id ?? 0);
    const bed = bedById.get(bedId);
    const bedLen = Math.max(0, Number(bed?.length_mm ?? 0));
    const usable = usableStripLengthMm(bedLen, defaultWasteMm);
    const sorted = [...arr].sort((a, b) => a.cast_slot_index - b.cast_slot_index);
    const totalUsed = sorted.reduce((s, r) => s + rowUsedLengthMm(r), 0);

    let cum = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const r = sorted[i];
      cum += rowUsedLengthMm(r);
      const isLast = i === sorted.length - 1;
      const w = isLast ? Math.max(0, bedLen - totalUsed) : Math.max(0, usable - cum);
      wasteByRowKey.set(`${r.cast_date}::${r.bed_id}::${r.cast_slot_index}`, w);
    }
  }

  return casts.map((c) => {
    const k = `${c.cast_date}::${c.bed_id}::${c.cast_slot_index}`;
    const w = wasteByRowKey.get(k);
    return w === undefined ? c : { ...c, waste_mm: w };
  });
}

// Inputs: caller state/arguments related to delay capacity for bed day.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function delayCapacityForBedDay(baseCapacity: number, bedId: number, date: string, delays: DelayEvent[]): number {
  const totalLost = delays
    .filter((d) => d.date === date && (d.bed_id == null || Number(d.bed_id) === Number(bedId)))
    .reduce((s, d) => s + Number(d.lost_slots ?? 0), 0);
  return Math.max(0, baseCapacity - totalLost);
}

// Inputs: caller state/arguments related to normalize slots.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function normalizeSlots(rows: PlannedCast[]): PlannedCast[] {
  return rows.map((r, idx) => ({ ...r, cast_slot_index: idx + 1 }));
}

// Inputs: caller state/arguments related to apply delays to draft.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function applyDelaysToDraft(casts: PlannedCast[], beds: Bed[], delays: DelayEvent[]): { nextCasts: PlannedCast[]; overflowWarnings: string[] } {
  if (delays.length === 0) return { nextCasts: casts, overflowWarnings: [] };
  const bedById = new Map(beds.map((b) => [Number(b.id), b] as const));
  const byBed = new Map<number, PlannedCast[]>();
  for (const c of casts) {
    const k = Number(c.bed_id);
    const arr = byBed.get(k) ?? [];
    arr.push(c);
    byBed.set(k, arr);
  }

  const plannedOut: PlannedCast[] = [];
  const warnings: string[] = [];
  const maxDate = casts.map((c) => c.cast_date).sort().at(-1) ?? todayStr();

  for (const [bedId, rows] of byBed.entries()) {
    const bed = bedById.get(bedId);
    const baseCap = Number(bed?.max_casts_per_day ?? 0);
    const lockedByDate = new Map<string, PlannedCast[]>();
    const plannedByDate = new Map<string, PlannedCast[]>();
    for (const r of rows) {
      const m = (r.status ?? "planned") === "planned" ? plannedByDate : lockedByDate;
      const arr = m.get(r.cast_date) ?? [];
      arr.push(r);
      m.set(r.cast_date, arr);
    }
    for (const arr of lockedByDate.values()) arr.sort((a, b) => a.cast_slot_index - b.cast_slot_index);
    for (const arr of plannedByDate.values()) arr.sort((a, b) => a.cast_slot_index - b.cast_slot_index);

    const dates = new Set<string>([
      ...Array.from(lockedByDate.keys()),
      ...Array.from(plannedByDate.keys()),
      ...delays
        .filter((d) => d.bed_id == null || Number(d.bed_id) === Number(bedId))
        .map((d) => d.date),
    ]);
    const startDate = Array.from(dates).sort()[0] ?? todayStr();
    const queue: PlannedCast[] = [];

    for (let i = 0; i < 90; i += 1) {
      const date = addDays(startDate, i);
      const cap = delayCapacityForBedDay(baseCap, bedId, date, delays);
      const locked = [...(lockedByDate.get(date) ?? [])];
      const incoming = plannedByDate.get(date) ?? [];
      // Planned rows get pushed into a queue and re-slotted based on reduced capacity.
      for (const p of incoming) queue.push(p);

      if (locked.length > cap) {
        warnings.push(
          `${bed?.name ?? `Bed #${bedId}`} on ${date}: ${locked.length} locked casts exceed delay-adjusted capacity ${cap}`
        );
      }

      const available = Math.max(0, cap - locked.length);
      const keepToday = queue.splice(0, available).map((q) => ({ ...q, cast_date: date }));
      const outRows = normalizeSlots([...locked, ...keepToday]);
      for (const r of outRows) plannedOut.push(r);

      if (queue.length === 0 && date >= maxDate && i > 14) break;
    }

    if (queue.length > 0) {
      warnings.push(`${bed?.name ?? `Bed #${bedId}`}: ${queue.length} planned casts could not be re-slotted within 90 days`);
      let tailDate = addDays(startDate, 90);
      while (queue.length > 0) {
        const cap = Math.max(1, delayCapacityForBedDay(baseCap, bedId, tailDate, delays));
        const moved = queue.splice(0, cap).map((q) => ({ ...q, cast_date: tailDate }));
        const outRows = normalizeSlots(moved);
        for (const r of outRows) plannedOut.push(r);
        tailDate = addDays(tailDate, 1);
      }
    }
  }

  plannedOut.sort((a, b) => {
    if (a.cast_date !== b.cast_date) return a.cast_date < b.cast_date ? -1 : 1;
    if (a.bed_id !== b.bed_id) return a.bed_id - b.bed_id;
    return a.cast_slot_index - b.cast_slot_index;
  });
  return { nextCasts: plannedOut, overflowWarnings: warnings };
}

/**
 * Total panels that would be committed for this element: DB totals plus edits in the current draft
 * (quantity − baseline per row).
 */
function projectedQtyForElement(elementId: number, draftCasts: PlannedCast[], dbSumByElement: Map<number, number>): number {
  const base = dbSumByElement.get(Number(elementId)) ?? 0;
  let delta = 0;
  for (const c of draftCasts) {
    if (Number(c.element_id) !== Number(elementId)) continue;
    delta += c.quantity - (c.baselineQty ?? 0);
  }
  return base + delta;
}

// Inputs: caller state/arguments related to map server casts to planned.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function mapServerCastsToPlanned(raw: unknown[], bedListForMap: Bed[], defaultWaste: number): PlannedCast[] {
  const bedMap = new Map(bedListForMap.map((b) => [b.id, b] as const));
  const mapped: PlannedCast[] = (raw ?? []).map((row) => {
    const c = row as Record<string, unknown>;
    const q0 = Number(c.quantity ?? 0);
    return {
      id: c.id as number | undefined,
      cast_date:
        typeof c.cast_date === "string" ? c.cast_date : String(c.cast_date ?? "").slice(0, 10),
      bed_id: (c.bed_id ?? c.bed_number) as number,
      cast_slot_index: Number(c.cast_slot_index ?? 0),
      element_id: Number(c.element_id ?? 0),
      panel_length_mm: Number(c.panel_length_mm ?? 0),
      slab_thickness_mm: Number(c.slab_thickness_mm ?? 0),
      quantity: Number(c.quantity ?? 0),
      baselineQty: q0,
      used_length_mm: Number(
        c.used_length_mm != null && Number(c.used_length_mm) > 0
          ? c.used_length_mm
          : q0 * Number(c.panel_length_mm ?? 0)
      ),
      waste_mm: 0,
      status: (c.status as string | undefined) ?? "planned",
      batch_id: (c.batch_id as string | null | undefined) ?? null,
    };
  });
  return recomputeWasteMmForCasts(mapped, bedMap, defaultWaste);
}

type GenPayload = { start: string; end: string; waste: number };

// Inputs: caller state/arguments related to hollowcore planner.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function HollowcorePlanner() {
  const { user } = useAuth();
  const isAdmin = String(user?.role ?? "").toLowerCase() === "admin";
  const theme = useTheme();
  const isNarrowPlanner = useMediaQuery(theme.breakpoints.down("md"));
  const bedColPx = isNarrowPlanner ? 260 : 320;
  const dateColPx = isNarrowPlanner ? 112 : 150;
  /** Custom drag-pan blocks native vertical scroll on phones; rely on overflow scroll instead. */
  const enableGridPan = !isNarrowPlanner;

  const qClient = useQueryClient();
  const refreshDashboardOverview = async () => {
    await qClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(addDays(todayStr(), 14));
  const [generatedBeds, setGeneratedBeds] = useState<Bed[] | null>(null);
  const [casts, setCasts] = useState<PlannedCast[]>([]);
  const [err, setErr] = useState<string | null>(null);
  /** After Generate: quantity the simulator could not place in the chosen date range (time/beds). */
  const [unplacedRemaining, setUnplacedRemaining] = useState<UnplacedRemainingRow[]>([]);
  const [delayDate, setDelayDate] = useState(todayStr());
  const [delayBedIdRaw, setDelayBedIdRaw] = useState<string>("all");
  const [delayLostSlots, setDelayLostSlots] = useState<number>(1);
  const [delayReason, setDelayReason] = useState("");
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [commitSummary, setCommitSummary] = useState<CommitResult | null>(null);
  const [bedFilterRaw, setBedFilterRaw] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "planned" | "completed" | "delayed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [showBedVisualization, setShowBedVisualization] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [castActionBusy, setCastActionBusy] = useState<number | null>(null);

  const elementsQuery = useQuery({
    queryKey: ELEMENTS_INCLUDE_INACTIVE_KEY,
    queryFn: fetchElementsIncludeInactive,
  });
  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });
  const bedsQuery = useQuery({ queryKey: HOLLOWCORE_BEDS_KEY, queryFn: fetchHollowcoreBeds });
  const settingsQuery = useQuery({
    queryKey: HOLLOWCORE_SETTINGS_KEY,
    queryFn: fetchHollowcoreSettings,
  });
  const registryQuery = useQuery({
    queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY,
    queryFn: fetchHollowcoreCastsRegistry,
  });
  const delaysQuery = useQuery({
    queryKey: hollowcorePlannerDelaysKey(start, end),
    queryFn: () => fetchHollowcorePlannerDelays(start, end),
  });
  const rangeCastsQuery = useQuery({
    queryKey: hollowcoreCastsRangeKey(start, end),
    queryFn: () => fetchHollowcoreCastsRange(start, end),
    enabled: !autoGenerate,
  });

  const defaultWasteMm = Number(
    (settingsQuery.data as { default_waste_mm?: number } | undefined)?.default_waste_mm ?? 2000
  );

  const elements = (elementsQuery.data ?? []) as ElementRow[];
  const projects = (projectsQuery.data ?? []) as ProjectRow[];

  const dbSumByElement = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of registryQuery.data ?? []) {
      const eid = Number(row.element_id);
      const q = Number(row.quantity ?? 0);
      m.set(eid, (m.get(eid) ?? 0) + q);
    }
    return m;
  }, [registryQuery.data]);

  const delayEvents: DelayEvent[] = delaysQuery.data ?? [];

  useEffect(() => {
    if (!autoGenerate) setGeneratedBeds(null);
  }, [autoGenerate]);

  const beds = (generatedBeds ?? (bedsQuery.data as Bed[]) ?? []) as Bed[];

  const batchIdsCsv = useMemo(
    () =>
      Array.from(new Set(casts.map((c) => c.batch_id).filter((x): x is string => Boolean(x))))
        .sort()
        .join(","),
    [casts]
  );

  const qcStatusQuery = useQuery({
    queryKey: qcBatchStatusKey(batchIdsCsv),
    queryFn: () => fetchQcBatchStatus(batchIdsCsv),
    enabled: batchIdsCsv.length > 0,
  });
  const qcStatus = qcStatusQuery.data ?? {};

  const generateMutation = useMutation({
    mutationFn: async (p: GenPayload) => {
      const { data } = await api.post<GenerateResponse>("/hollowcore/planner/generate", {
        start_date: p.start,
        end_date: p.end,
      });
      return { data, waste: p.waste };
    },
    onMutate: () => {
      setErr(null);
      setCommitSummary(null);
    },
    onSuccess: ({ data, waste }) => {
      const bedList = data?.beds ?? [];
      setGeneratedBeds(bedList);
      const bedMap = new Map(bedList.map((b) => [b.id, b] as const));
      const mapped = (data?.casts ?? []).map((c) => {
        // Generated draft rows start with baselineQty=0 because nothing is committed yet.
        const castDate = typeof c.cast_date === "string" ? c.cast_date : String(c.cast_date).slice(0, 10);
        const qty = Number(c.quantity ?? 0);
        const panelLen = Number(c.panel_length_mm ?? 0);
        const fromApi = Number(c.used_length_mm);
        const used_length_mm = Number.isFinite(fromApi) && fromApi > 0 ? fromApi : qty * panelLen;
        return {
          ...c,
          cast_date: castDate,
          baselineQty: 0,
          used_length_mm,
          waste_mm: 0,
        } as PlannedCast;
      });
      setCasts(recomputeWasteMmForCasts(mapped, bedMap, waste));
      setUnplacedRemaining(data?.unplaced_remaining ?? []);
    },
    onError: (e) => {
      console.error(e);
      setErr(formatError(e, "Failed to generate plan"));
      setGeneratedBeds(null);
      setCasts([]);
      setUnplacedRemaining([]);
    },
  });

  useEffect(() => {
    // Auto mode regenerates draft on range/settings changes; manual mode does not.
    if (!autoGenerate || !settingsQuery.isFetched || !bedsQuery.isFetched) return;
    generateMutation.mutate({ start, end, waste: defaultWasteMm });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when range / mode / waste / beds changes
  }, [start, end, autoGenerate, defaultWasteMm, settingsQuery.isFetched, bedsQuery.isFetched, bedsQuery.dataUpdatedAt]);

  useEffect(() => {
    if (autoGenerate) return;
    if (rangeCastsQuery.isError) {
      setErr(formatError(rangeCastsQuery.error, "Failed to load hollowcore planner data"));
      setCasts([]);
      setUnplacedRemaining([]);
      return;
    }
    if (rangeCastsQuery.data == null) return;
    const bedList = ((bedsQuery.data ?? []) as Bed[]) || [];
    setCasts(mapServerCastsToPlanned(rangeCastsQuery.data as unknown[], bedList, defaultWasteMm));
    setUnplacedRemaining([]);
    setErr(null);
  }, [
    autoGenerate,
    rangeCastsQuery.data,
    rangeCastsQuery.isError,
    rangeCastsQuery.error,
    bedsQuery.data,
    defaultWasteMm,
  ]);

  const commitMutation = useMutation({
    mutationFn: async (vars: { planned: PlannedCast[]; start: string; end: string; waste: number }) => {
      const { data } = await api.post<CommitResult>("/hollowcore/planner/commit", {
        casts: vars.planned.map((c) => ({
          cast_date: c.cast_date,
          bed_id: c.bed_id,
          cast_slot_index: c.cast_slot_index,
          element_id: c.element_id,
          panel_length_mm: c.panel_length_mm,
          slab_thickness_mm: c.slab_thickness_mm,
          quantity: c.quantity,
          used_length_mm: c.used_length_mm,
          waste_mm: c.waste_mm,
        })),
      });
      return { data, ...vars };
    },
    onMutate: () => {
      setErr(null);
    },
    onSuccess: async (res) => {
      setCommitSummary({
        inserted: Number(res.data?.inserted ?? 0),
        updated: Number(res.data?.updated ?? 0),
        deleted: Number(res.data?.deleted ?? 0),
      });
      setGeneratedBeds(null);
      await Promise.all([
        qClient.invalidateQueries({ queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY }),
        qClient.invalidateQueries({ queryKey: hollowcoreCastsRangeKey(res.start, res.end) }),
        qClient.invalidateQueries({ queryKey: hollowcorePlannerDelaysKey(res.start, res.end) }),
        qClient.invalidateQueries({ queryKey: HOLLOWCORE_BEDS_KEY }),
        qClient.invalidateQueries({ queryKey: ["hollowcore", "casts"] }),
        qClient.invalidateQueries({ queryKey: ELEMENTS_ALL_KEY }),
        qClient.invalidateQueries({ queryKey: ELEMENTS_PREFAB_LIST_KEY }),
        qClient.invalidateQueries({ queryKey: HOLLOWCORE_ELEMENTS_HC_KEY }),
        qClient.invalidateQueries({ queryKey: QC_QUEUE_KEY }),
        refreshDashboardOverview(),
      ]);
      // Re-fetch authoritative DB data so planner reflects committed truth, not local draft.
      const raw = await qClient.fetchQuery({
        queryKey: hollowcoreCastsRangeKey(res.start, res.end),
        queryFn: () => fetchHollowcoreCastsRange(res.start, res.end),
      });
      const freshBeds = ((await qClient.fetchQuery({
        queryKey: HOLLOWCORE_BEDS_KEY,
        queryFn: fetchHollowcoreBeds,
      })) ?? []) as Bed[];
      setCasts(mapServerCastsToPlanned(raw as unknown[], freshBeds, res.waste));
      setUnplacedRemaining([]);
    },
    onError: (e) => {
      console.error(e);
      setErr(formatError(e, "Failed to commit plan"));
    },
  });

  const addDelayMutation = useMutation({
    mutationFn: async () => {
      const lost = Math.max(1, Math.floor(Number(delayLostSlots) || 0));
      const bedId = delayBedIdRaw === "all" ? null : Number(delayBedIdRaw);
      await api.post("/planner/delays", {
        planner_type: "hollowcore",
        delay_date: delayDate,
        bed_id: bedId,
        lost_capacity: lost,
        reason: delayReason.trim() || null,
      });
    },
    onSuccess: async () => {
      await qClient.invalidateQueries({ queryKey: hollowcorePlannerDelaysKey(start, end) });
      setDelayReason("");
    },
    onError: (e) => setErr(formatError(e, "Failed to add delay")),
  });

  const removeDelayMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/planner/delays/${id}`);
    },
    onSuccess: async () => {
      await qClient.invalidateQueries({ queryKey: hollowcorePlannerDelaysKey(start, end) });
    },
    onError: (e) => setErr(formatError(e, "Failed to delete delay")),
  });

  const elementMap = useMemo(
    () => new Map(elements.map((e) => [Number(e.id), e] as const)),
    [elements]
  );
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [Number(p.id), p] as const)),
    [projects]
  );

  const triggerGenerate = () => {
    generateMutation.mutate({ start, end, waste: defaultWasteMm });
  };

  const refreshPlanner = () => {
    if (autoGenerate) triggerGenerate();
    else void rangeCastsQuery.refetch();
  };

  const runCastAction = async (castId: number, endpoint: string, payload?: Record<string, unknown>) => {
    try {
      setErr(null);
      setCastActionBusy(castId);
      await api.post(`/hollowcore/casts/${castId}/${endpoint}`, payload ?? {});
      await Promise.all([
        qClient.invalidateQueries({ queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY }),
        qClient.invalidateQueries({ queryKey: QC_QUEUE_KEY }),
        refreshDashboardOverview(),
      ]);
      refreshPlanner();
    } catch (e) {
      setErr(formatError(e, "Failed to update cast status"));
    } finally {
      setCastActionBusy(null);
    }
  };

  const requestRetest = async (castId: number) => {
    const reason = window.prompt("Retest reason (required):", "1-day failed, priority retest requested");
    if (!reason || !reason.trim()) return;
    await runCastAction(castId, "request-retest", { reason: reason.trim() });
  };

  const markCutOverride = async (castId: number) => {
    const reason = window.prompt("Override reason (required):", "Approved conditional release");
    if (!reason || !reason.trim()) return;
    if (!window.confirm("Proceed with admin override and mark this cast as cut?")) return;
    await runCastAction(castId, "mark-cut-override", { reason: reason.trim() });
  };

  const commit = () => {
    if (casts.length === 0) return;
    const plannedOnly = casts.filter((c) => (c.status ?? "planned") === "planned");
    if (plannedOnly.length === 0) {
      setErr("Nothing to commit — every cast in this view is already marked cast or completed.");
      return;
    }
    commitMutation.mutate({ planned: plannedOnly, start, end, waste: defaultWasteMm });
  };

  const isCastLate = (c: PlannedCast) => {
    const el = elementMap.get(Number(c.element_id));
    const pr = el?.project_id != null ? projectMap.get(Number(el.project_id)) : undefined;
    const due = el?.due_date ?? pr?.due_date ?? null;
    return Boolean(due && c.cast_date > due);
  };

  const filteredCasts = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return casts.filter((c) => {
      if (bedFilterRaw !== "all" && Number(bedFilterRaw) !== Number(c.bed_id)) return false;
      if (statusFilter !== "all" && (c.status ?? "planned") !== statusFilter) return false;
      if (lateOnly && !isCastLate(c)) return false;
      if (!needle) return true;
      const el = elementMap.get(Number(c.element_id));
      const mark = String(el?.element_mark ?? "").toLowerCase();
      const pid = String(el?.project_id ?? "");
      // Search supports mark, project id, or raw element id for shop-floor workflows.
      return mark.includes(needle) || pid.includes(needle) || String(c.element_id).includes(needle);
    });
  }, [casts, bedFilterRaw, statusFilter, lateOnly, searchTerm, elementMap, projectMap]);

  const plannerStats = useMemo(() => {
    const total = casts.length;
    const planned = casts.filter((c) => (c.status ?? "planned") === "planned").length;
    const completed = casts.filter((c) => c.status === "completed").length;
    const delayed = casts.filter((c) => c.status === "delayed").length;
    const late = casts.filter((c) => isCastLate(c)).length;
    return { total, planned, completed, delayed, late };
  }, [casts, elementMap, projectMap]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledToTodayRef = useRef(false);
  const panStateRef = useRef<{
    isDown: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    pointerId: number | null;
  }>({
    isDown: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    pointerId: null,
  });
  const [isPanning, setIsPanning] = useState(false);

  const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    if (!pan.isDown) return;
    if (pan.pointerId !== e.pointerId) return;
    const capId = pan.pointerId;
    pan.isDown = false;
    pan.pointerId = null;
    setIsPanning(false);
    try {
      e.currentTarget.releasePointerCapture(capId);
    } catch {
      // Ignore if pointer capture is unavailable.
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button, a, input, select, textarea, [role='button']")) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const pan = panStateRef.current;
    pan.isDown = true;
    pan.pointerId = e.pointerId;
    pan.startX = e.clientX;
    pan.startY = e.clientY;
    pan.startScrollLeft = el.scrollLeft;
    pan.startScrollTop = el.scrollTop;
    setIsPanning(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable.
    }
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const pan = panStateRef.current;
    if (!pan.isDown) return;
    if (pan.pointerId !== e.pointerId) return;
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    el.scrollLeft = pan.startScrollLeft - dx;
    el.scrollTop = pan.startScrollTop - dy;
    e.preventDefault();
  };

  const dates = useMemo(() => {
    const unique = new Set(filteredCasts.map((c) => c.cast_date));
    return Array.from(unique).sort();
  }, [filteredCasts]);

  useEffect(() => {
    if (dates.length === 0) return;
    if (hasAutoScrolledToTodayRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const todayIso = todayStr();
    const preferredDate = dates.find((d) => d >= todayIso) ?? dates.at(-1);
    if (!preferredDate) return;
    const targetRow =
      preferredDate === todayIso
        ? todayRowRef.current
        : (container.querySelector(`[data-date-row="${preferredDate}"]`) as HTMLDivElement | null);
    if (!targetRow) return;
    hasAutoScrolledToTodayRef.current = true;
    targetRow.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, [dates]);

  const bedKeys = useMemo(() => {
    const set = new Set<number>();
    beds.forEach((b) => set.add(b.id));
    filteredCasts.forEach((c) => set.add(c.bed_id));
    return Array.from(set).sort((a, b) => a - b);
  }, [beds, filteredCasts]);

  const bedById = useMemo(() => new Map(beds.map((b) => [b.id, b])), [beds]);

  const castsByDateBed = useMemo(() => {
    const m = new Map<string, PlannedCast[]>();
    for (const c of filteredCasts) {
      const key = `${c.cast_date}::${c.bed_id}`;
      const arr = m.get(key) ?? [];
      arr.push(c);
      m.set(key, arr);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.cast_slot_index - b.cast_slot_index);
      m.set(k, arr);
    }
    return m;
  }, [filteredCasts]);

  const plannedCastsCount = useMemo(
    () => casts.filter((c) => (c.status ?? "planned") === "planned").length,
    [casts]
  );

  const delayPreview = useMemo(() => applyDelaysToDraft(casts, beds, delayEvents), [casts, beds, delayEvents]);
  const delayImpact = useMemo(() => {
    const oldRows = casts.map((c) => `${c.id ?? "new"}::${c.element_id}::${c.bed_id}::${c.cast_slot_index}::${c.cast_date}`);
    const newRows = delayPreview.nextCasts.map((c) => `${c.id ?? "new"}::${c.element_id}::${c.bed_id}::${c.cast_slot_index}::${c.cast_date}`);
    const oldSet = new Set(oldRows);
    let changed = 0;
    for (const r of newRows) if (!oldSet.has(r)) changed += 1;
    return changed;
  }, [casts, delayPreview.nextCasts]);

  const addDelayEvent = () => addDelayMutation.mutate();
  const removeDelayEvent = (id: number) => removeDelayMutation.mutate(id);

  const loading =
    generateMutation.isPending ||
    commitMutation.isPending ||
    addDelayMutation.isPending ||
    removeDelayMutation.isPending ||
    (!autoGenerate && rangeCastsQuery.isPending);

  const applyDelayAdjustments = () =>
    setCasts(recomputeWasteMmForCasts(delayPreview.nextCasts, bedById, defaultWasteMm));

  const setQty = (castDate: string, bedId: number, slot: number, rawInput: number) => {
    setCasts((prev) => {
      const row = prev.find(
        (x) => x.cast_date === castDate && x.bed_id === bedId && x.cast_slot_index === slot
      );
      if (!row) return prev;

      const bed = bedById.get(bedId);
      const maxBed = maxPanelsForBed(bed, defaultWasteMm, row.panel_length_mm);

      const el = elementMap.get(Number(row.element_id));
      const orderQty = el?.quantity ?? 0;
      const projected = projectedQtyForElement(row.element_id, prev, dbSumByElement);
      const maxEl = Math.max(0, orderQty - projected + row.quantity);

      const upper = Math.min(maxBed, maxEl);
      // Quantity cannot exceed bed physical capacity or remaining order demand.
      if (upper < 1) {
        return prev;
      }

      const parsed = Number.isFinite(rawInput) && !Number.isNaN(rawInput) ? Math.floor(rawInput) : row.quantity;
      const qty = Math.max(1, Math.min(parsed, upper));

      const used_length_mm = qty * Number(row.panel_length_mm ?? 0);
      const next = prev.map((c) =>
        c.cast_date === castDate && c.bed_id === bedId && c.cast_slot_index === slot
          ? { ...c, quantity: qty, used_length_mm }
          : c
      );
      return recomputeWasteMmForCasts(next, bedById, defaultWasteMm);
    });
  };

  const cardBg = (c: PlannedCast, elementDue?: string | null, projectDue?: string | null) => {
    let background = "#e8f3ff";
    if (c.status === "completed") background = "#d4edda";
    if (c.status === "delayed") background = "#ffd6d6";
    const due = elementDue ?? projectDue;
    if (due && c.cast_date > due) background = "#ffe3e3";
    return background;
  };

  return (
    <Paper sx={{ p: 2, pb: isNarrowPlanner ? 11 : 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Typography variant="h5">Hollowcore Planner</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <TextField label="Start" type="date" size="small" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="End" type="date" size="small" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} />
            <Button variant="text" onClick={refreshPlanner} disabled={loading}>
              Refresh
            </Button>
            <Button variant="outlined" onClick={triggerGenerate} disabled={loading || autoGenerate}>
              {loading ? "Loading..." : "Generate plan"}
            </Button>
            <FormControlLabel
              control={<Switch checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
              label="Auto generate"
            />
            <Button variant="contained" onClick={commit} disabled={loading || plannedCastsCount === 0 || autoGenerate}>
              Commit plan
            </Button>
            <Button variant="text" onClick={() => setDelayDialogOpen(true)} sx={{ textTransform: "none" }}>
              Delay adjustments
            </Button>
            <Button
              variant="text"
              onClick={() => {
                const t = todayStr();
                setStart(t);
                setEnd(addDays(t, 14));
              }}
            >
              Today +14d
            </Button>
            <Button
              variant="text"
              onClick={() => {
                const t = todayStr();
                setStart(t);
                setEnd(addDays(t, 30));
              }}
            >
              Today +30d
            </Button>
          </Stack>
        </Stack>

        {err ? <Alert severity="error">{err}</Alert> : null}
        {commitSummary ? (
          <Alert severity="success" sx={{ py: 0.75 }}>
            Commit successful: inserted <strong>{commitSummary.inserted ?? 0}</strong>, updated{" "}
            <strong>{commitSummary.updated ?? 0}</strong>, deleted <strong>{commitSummary.deleted ?? 0}</strong>.
          </Alert>
        ) : null}

        <Alert severity="info" sx={{ py: 0.75 }}>
          {autoGenerate ? (
            <>
              <strong>Auto generate</strong> is on. Draft casts are regenerated automatically when the date range changes.
              Dashboard and reports use <strong>committed</strong> casts. Click <strong>Commit plan</strong> to save.
            </>
          ) : (
            <>
              <strong>Generate plan</strong> loads a <strong>draft</strong> in this page only. The dashboard and reports use{" "}
              <strong>committed</strong> casts. After you are happy with the draft, click <strong>Commit plan</strong> to save
              it to the database.
            </>
          )}
        </Alert>

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} flexWrap="wrap" useFlexGap gap={1} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField
                select
                size="small"
                label="Bed filter"
                value={bedFilterRaw}
                onChange={(e) => setBedFilterRaw(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">All beds</MenuItem>
                {beds.map((b) => (
                  <MenuItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "planned" | "completed" | "delayed")}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="planned">Planned</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="delayed">Delayed</MenuItem>
              </TextField>
              <TextField
                size="small"
                label="Search mark / element / project"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ minWidth: 0, width: { xs: "100%", md: 280 } }}
              />
              <FormControlLabel
                control={<Switch checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} />}
                label="Late only"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showBedVisualization}
                    onChange={(e) => setShowBedVisualization(e.target.checked)}
                  />
                }
                label="Bed visualization"
              />
              <Button
                variant="text"
                onClick={() => {
                  setBedFilterRaw("all");
                  setStatusFilter("all");
                  setSearchTerm("");
                  setLateOnly(false);
                }}
              >
                Clear filters
              </Button>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Total ${plannerStats.total}`} />
                <Chip size="small" color="primary" label={`Planned ${plannerStats.planned}`} />
                <Chip size="small" color="success" label={`Completed ${plannerStats.completed}`} />
                <Chip size="small" color="warning" label={`Delayed ${plannerStats.delayed}`} />
                <Chip size="small" color="error" label={`Late ${plannerStats.late}`} />
                <Chip size="small" variant="outlined" label={`Showing ${filteredCasts.length}`} />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Dialog open={delayDialogOpen} onClose={() => setDelayDialogOpen(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Delay Adjustments
            </Typography>
            <Button size="small" onClick={() => setDelayDialogOpen(false)}>
              Close
            </Button>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                Register downtime by date and bed, preview the schedule impact, then apply changes to the current draft.
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
                <TextField
                  label="Delay date"
                  type="date"
                  size="small"
                  value={delayDate}
                  onChange={(e) => setDelayDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  select
                  label="Bed"
                  size="small"
                  value={delayBedIdRaw}
                  onChange={(e) => setDelayBedIdRaw(e.target.value)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="all">All beds</MenuItem>
                  {beds.map((b) => (
                    <MenuItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Lost casts (slots)"
                  size="small"
                  type="number"
                  value={delayLostSlots}
                  onChange={(e) => setDelayLostSlots(Math.max(1, Number(e.target.value || 1)))}
                  inputProps={{ min: 1 }}
                  sx={{ maxWidth: 170 }}
                />
                <TextField
                  label="Reason"
                  size="small"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  sx={{ minWidth: 260 }}
                />
                <Button variant="outlined" onClick={addDelayEvent}>
                  Add delay
                </Button>
              </Stack>

              {delayEvents.length > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {delayEvents.map((d) => {
                    const bedLabel = d.bed_id == null ? "All beds" : bedById.get(Number(d.bed_id))?.name ?? `Bed #${d.bed_id}`;
                    return (
                      <Chip
                        key={d.id}
                        label={`${d.date} • ${bedLabel} • -${d.lost_slots} slots${d.reason ? ` • ${d.reason}` : ""}`}
                        onDelete={() => removeDelayEvent(d.id)}
                        color="warning"
                        variant="outlined"
                      />
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No delay events added.
                </Typography>
              )}

              {delayEvents.length > 0 ? (
                <Alert severity="info" sx={{ py: 0.75 }}>
                  Preview impact: <strong>{delayImpact}</strong> row/date changes will be made to this draft.
                  <Button
                    size="small"
                    variant="contained"
                    onClick={applyDelayAdjustments}
                    sx={{ ml: 1.5 }}
                    disabled={delayImpact === 0}
                  >
                    Apply Delay Adjustments
                  </Button>
                </Alert>
              ) : null}

              {delayPreview.overflowWarnings.length > 0 ? (
                <Alert severity="warning" sx={{ py: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Capacity warnings
                  </Typography>
                  {delayPreview.overflowWarnings.map((w) => (
                    <Typography key={w} variant="body2" color="text.secondary">
                      - {w}
                    </Typography>
                  ))}
                </Alert>
              ) : null}
            </Stack>
          </DialogContent>
        </Dialog>

        {unplacedRemaining.length > 0 ? (
          <Alert severity="warning" sx={{ py: 0.75 }}>
            <Typography variant="body2" color="inherit" sx={{ fontWeight: 600, mb: 0.5 }}>
              Not enough capacity in this date range (simulation)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              The generator could not place all remaining units before <strong>{end}</strong> with your current beds (length,
              max casts per day, and margin). Extend the <strong>End</strong> date, add or lengthen beds, or raise{" "}
              <strong>max casts per day</strong> in Hollowcore Beds / Settings — then generate again.
            </Typography>
            <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5 }}>
              {unplacedRemaining.map((u) => (
                <Typography component="li" variant="body2" key={u.element_id}>
                  <strong>{u.element_mark ?? `Element #${u.element_id}`}</strong>: {u.remaining_qty} units still unplaced
                  in this window
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}

        {casts.length === 0 ? (
          <Alert severity="info">
            No casts in this range yet. {autoGenerate ? "Draft generation runs automatically." : "Generate plan to create draft casts."}
          </Alert>
        ) : null}
        {casts.length > 0 && filteredCasts.length === 0 ? (
          <Alert severity="info">No casts match the current filters.</Alert>
        ) : null}

        {dates.length > 0 && (
          <div
            ref={scrollContainerRef}
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: isNarrowPlanner ? "min(70vh, 560px)" : undefined,
              touchAction: enableGridPan ? "none" : "pan-x pan-y",
              cursor: enableGridPan ? (isPanning ? "grabbing" : "grab") : undefined,
              userSelect: isPanning ? "none" : undefined,
            }}
            onPointerDown={enableGridPan ? handlePointerDown : undefined}
            onPointerMove={enableGridPan ? handlePointerMove : undefined}
            onPointerUp={enableGridPan ? endPan : undefined}
            onPointerCancel={enableGridPan ? endPan : undefined}
          >
            <div
              style={{
                width: "max-content",
                display: "grid",
                gridTemplateColumns: `${dateColPx}px repeat(${bedKeys.length}, ${bedColPx}px)`,
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <div style={{ fontWeight: "bold", position: "sticky", left: 0, zIndex: 3, background: "#fff", borderRight: "1px solid #eee" }}>
                Date
              </div>

              {bedKeys.map((bid) => {
                const b = bedById.get(bid);
                return (
                  <div key={`header-${bid}`} style={{ fontWeight: "bold", textAlign: "center" }}>
                    {b?.name ?? `Bed #${bid}`}
                    <div style={{ fontSize: 12, fontWeight: "normal" }}>{b?.length_mm ? `Length: ${b.length_mm}mm` : ""}</div>
                  </div>
                );
              })}

              {dates.map((d) => (
                <React.Fragment key={d}>
                  {(() => {
                    const isToday = d === todayStr();
                    return (
                      <div
                        ref={isToday ? todayRowRef : null}
                        data-date-row={d}
                        style={{
                          fontWeight: "bold",
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: isToday ? "#fff8e1" : "#fff",
                          borderRight: isToday ? "2px solid #f59e0b" : "1px solid #eee",
                          color: isToday ? "#8a5100" : undefined,
                          borderRadius: isToday ? 4 : undefined,
                          paddingLeft: isToday ? 6 : undefined,
                        }}
                      >
                        {d}
                        {isToday && <div style={{ fontSize: 11, fontWeight: 700 }}>Today</div>}
                      </div>
                    );
                  })()}
                  {bedKeys.map((bid) => {
                    const rows = castsByDateBed.get(`${d}::${bid}`) ?? [];
                    const bed = bedById.get(bid);
                    const bedLength = Math.max(0, Number(bed?.length_mm ?? 0));
                    const usedLength = rows.reduce((acc, c) => acc + Math.max(0, Number(c.used_length_mm ?? 0)), 0);
                    const freeLength = Math.max(0, bedLength - usedLength);
                    const overflowLength = Math.max(0, usedLength - bedLength);
                    return (
                      <div key={`cell-${d}-${bid}`} style={{ minHeight: 60, padding: 4, border: "1px solid #eee" }}>
                        {showBedVisualization && bedLength > 0 ? (
                          <Box sx={{ mb: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Used {(usedLength / 1000).toFixed(1)}m / {(bedLength / 1000).toFixed(1)}m
                              </Typography>
                              <Chip
                                size="small"
                                color={overflowLength > 0 ? "error" : "default"}
                                label={`${((usedLength / bedLength) * 100).toFixed(1)}%`}
                              />
                            </Stack>
                            <Box
                              sx={{
                                position: "relative",
                                height: 32,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                                overflow: "hidden",
                                bgcolor: "background.paper",
                              }}
                            >
                              {Array.from({ length: Math.floor(bedLength / 10000) + 1 }).map((_, i) => (
                                <Box
                                  key={`mark-${d}-${bid}-${i}`}
                                  sx={{
                                    position: "absolute",
                                    top: 0,
                                    bottom: 0,
                                    left: `${Math.min(100, (i * 10000 * 100) / bedLength)}%`,
                                    borderLeft: "1px dashed",
                                    borderColor: "divider",
                                    opacity: 0.4,
                                  }}
                                />
                              ))}
                              {rows.map((c) => {
                                const el = elementMap.get(Number(c.element_id));
                                const segmentLength = Math.max(0, Number(c.used_length_mm ?? 0));
                                const segmentPct = Math.min(100, (segmentLength * 100) / bedLength);
                                const offsetLength = rows
                                  .filter((r) => r.cast_slot_index < c.cast_slot_index)
                                  .reduce((acc, r) => acc + Math.max(0, Number(r.used_length_mm ?? 0)), 0);
                                const leftPct = Math.min(100, (offsetLength * 100) / bedLength);
                                const bgColor =
                                  c.status === "completed"
                                    ? "success.light"
                                    : c.status === "delayed"
                                      ? "warning.light"
                                      : "primary.light";
                                return (
                                  <Box
                                    key={`viz-${c.cast_date}-${c.bed_id}-${c.cast_slot_index}-${c.id ?? c.element_id}`}
                                    title={`${el?.element_mark ?? `Element #${c.element_id}`} | Qty ${c.quantity} | ${(segmentLength / 1000).toFixed(2)}m | ${c.status ?? "planned"}`}
                                    sx={{
                                      position: "absolute",
                                      top: 4,
                                      bottom: 4,
                                      left: `${leftPct}%`,
                                      width: `${segmentPct}%`,
                                      minWidth: 8,
                                      border: "1px solid",
                                      borderColor: "divider",
                                      borderRadius: 0.75,
                                      bgcolor: bgColor,
                                      px: 0.5,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      overflow: "hidden",
                                      whiteSpace: "nowrap",
                                      textOverflow: "ellipsis",
                                      fontSize: 10,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {el?.element_mark ?? `E${c.element_id}`}
                                  </Box>
                                );
                              })}
                              {freeLength > 0 ? (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    top: 4,
                                    bottom: 4,
                                    left: `${Math.min(100, (usedLength * 100) / bedLength)}%`,
                                    width: `${Math.min(100, (freeLength * 100) / bedLength)}%`,
                                    border: "1px dashed",
                                    borderColor: "text.disabled",
                                    borderRadius: 0.75,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "text.disabled",
                                    fontSize: 10,
                                  }}
                                >
                                  Free
                                </Box>
                              ) : null}
                            </Box>
                          </Box>
                        ) : null}
                        <div style={{ display: "flex", flexWrap: "wrap" }}>
                          {rows.map((c) => {
                            const el = elementMap.get(Number(c.element_id));
                            const pr =
                              el?.project_id != null ? projectMap.get(Number(el.project_id)) : undefined;
                            const bg = cardBg(c, el?.due_date ?? null, pr?.due_date ?? null);
                            const due = el?.due_date ?? pr?.due_date ?? null;
                            const isLate = due ? c.cast_date > due : false;
                            const isLastOnBedDay =
                              rows.length > 0 && rows[rows.length - 1].cast_slot_index === c.cast_slot_index;
                            return (
                              <Card
                                key={`${c.cast_date}-${c.bed_id}-${c.cast_slot_index}-${c.id ?? c.element_id}`}
                                variant="outlined"
                                sx={{
                                  m: 0.75,
                                  minWidth: isNarrowPlanner ? 148 : 180,
                                  borderColor: isLate ? "error.main" : "divider",
                                  bgcolor: bg,
                                }}
                              >
                                <CardContent sx={{ py: 1.25, "&:last-child": { pb: 1.25 } }}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                                        {el?.element_mark ?? `Element #${c.element_id}`}
                                      </Typography>
                                      <Chip label={`${c.quantity} units`} size="small" />
                                      {isLate && <Chip label="Over due" color="error" size="small" />}
                                      {c.status === "completed" && <Chip label="Completed" color="success" size="small" />}
                                    </Stack>

                                    <Typography variant="body2" color="text.secondary" noWrap>
                                      {el?.element_type ?? "Hollowcore"}
                                      {pr ? ` • ${pr.project_name}` : ""}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Project: {pr?.project_name ?? (el?.project_id ? `#${el.project_id}` : "-")}
                                    </Typography>

                                    {(() => {
                                      const bed = bedById.get(bid);
                                      const maxBed = maxPanelsForBed(bed, defaultWasteMm, c.panel_length_mm);
                                      const orderQty = el?.quantity ?? 0;
                                      const projected = projectedQtyForElement(c.element_id, casts, dbSumByElement);
                                      const maxEl = Math.max(0, orderQty - projected + c.quantity);
                                      const maxAllowed = Math.min(maxBed, maxEl);
                                      return (
                                        <>
                                          <TextField
                                            label="Qty"
                                            size="small"
                                            type="number"
                                            value={c.quantity}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              const n = v === "" ? NaN : Number(v);
                                              setQty(c.cast_date, c.bed_id, c.cast_slot_index, n);
                                            }}
                                            inputProps={
                                              maxAllowed >= 1 ? { min: 1, max: maxAllowed } : { min: 1 }
                                            }
                                            sx={{ mt: 0.25, maxWidth: 120 }}
                                          />
                                          <Typography variant="caption" color="text.secondary" display="block">
                                            Max {maxAllowed} (bed {maxBed}, order {maxEl})
                                          </Typography>
                                        </>
                                      );
                                    })()}

                                    <Typography variant="caption" color="text.secondary">
                                      {c.panel_length_mm}mm • {c.slab_thickness_mm}mm •{" "}
                                      {isLastOnBedDay ? `Bed free ${c.waste_mm}mm` : `Strip after ${c.waste_mm}mm`}
                                    </Typography>

                                    {el?.requires_cubes && c.batch_id ? (
                                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                        <Chip label={`Cube ref: ${c.batch_id}`} color="info" size="small" />
                                        {(() => {
                                          const st = qcStatus[c.batch_id!];
                                          if (!st) return <Chip label="QC: Pending" color="warning" size="small" />;
                                          if (st.passed === true) return <Chip label={`QC: PASS${st.age_days ? ` (${st.age_days}d)` : ""}`} color="success" size="small" />;
                                          if (st.passed === false) return <Chip label={`QC: FAIL${st.age_days ? ` (${st.age_days}d)` : ""}`} color="error" size="small" />;
                                          return <Chip label="QC: Pending" color="warning" size="small" />;
                                        })()}
                                      </Stack>
                                    ) : null}
                                    {c.batch_id ? (
                                      <Chip
                                        label={qcStatus[c.batch_id]?.cut_allowed ? "Cut allowed" : "Cut blocked (1d pending/fail)"}
                                        color={qcStatus[c.batch_id]?.cut_allowed ? "success" : "warning"}
                                        size="small"
                                      />
                                    ) : null}
                                    {(() => {
                                      if (!c.id) return null;
                                      const statusNow = c.status ?? "planned";
                                      const st = c.batch_id ? qcStatus[c.batch_id] : undefined;
                                      const busy = castActionBusy === c.id || loading;
                                      return (
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={busy || statusNow !== "planned"}
                                            onClick={() => void runCastAction(c.id!, "mark-cast")}
                                          >
                                            Mark cast
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={
                                              busy ||
                                              !["cast", "hold_qc_1d_fail"].includes(statusNow) ||
                                              !Boolean(st?.cut_allowed)
                                            }
                                            onClick={() => void runCastAction(c.id!, "mark-cut")}
                                          >
                                            Mark cut
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            disabled={busy || !["cast", "hold_qc_1d_fail"].includes(statusNow)}
                                            onClick={() => void requestRetest(c.id!)}
                                          >
                                            Request retest
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            disabled={busy || statusNow !== "hold_qc_1d_fail" || !isAdmin}
                                            onClick={() => void markCutOverride(c.id!)}
                                          >
                                            Admin override
                                          </Button>
                                        </Stack>
                                      );
                                    })()}

                                    {due ? (
                                      <Typography variant="caption" color={isLate ? "error.main" : "text.secondary"}>
                                        Due: {due}
                                      </Typography>
                                    ) : null}
                                    {c.status ? <Typography variant="caption">Status: {c.status}</Typography> : null}
                                  </Stack>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {isNarrowPlanner ? (
          <Box
            sx={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "center",
              p: 1.25,
              px: 2,
              pb: "max(12px, env(safe-area-inset-bottom, 0px))",
              bgcolor: "background.paper",
              borderTop: 1,
              borderColor: "divider",
              zIndex: theme.zIndex.appBar,
              boxShadow: 3,
            }}
          >
            <Button size="small" variant="outlined" onClick={refreshPlanner} disabled={loading}>
              Refresh
            </Button>
            <Button size="small" variant="outlined" onClick={triggerGenerate} disabled={loading || autoGenerate}>
              Generate
            </Button>
            <Button size="small" variant="contained" onClick={commit} disabled={loading || plannedCastsCount === 0 || autoGenerate}>
              Commit
            </Button>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}

