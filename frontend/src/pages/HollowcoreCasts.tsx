// File overview: Page component and UI logic for pages/HollowcoreCasts.tsx.
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  ELEMENTS_INCLUDE_INACTIVE_KEY,
  PROJECTS_OPTIONS_KEY,
  fetchElementsIncludeInactive,
  fetchProjectsOptions,
} from "./elementsQuery";
import {
  HOLLOWCORE_BEDS_KEY,
  HOLLOWCORE_CASTS_REGISTRY_KEY,
  HOLLOWCORE_SETTINGS_KEY,
  fetchHollowcoreBeds,
  fetchHollowcoreSettings,
  hollowcoreCastsDayKey,
  fetchHollowcoreCastsForDay,
} from "./hollowcoreQuery";
import { YARD_LOCATIONS_KEY, fetchYardLocations } from "./yardQuery";

type Bed = { id: number; name: string; length_mm?: number };
type Cast = {
  id: number;
  cast_date: string;
  bed_id?: number | null;
  element_id: number;
  quantity: number;
  cast_slot_index?: number;
  panel_length_mm?: number;
  used_length_mm?: number;
  status: "planned" | "cast" | "cut" | "completed" | string;
  batch_id?: string | null;
};
type ElementRow = {
  id: number;
  element_mark?: string | null;
  project_id?: number | null;
  element_type?: string | null;
  due_date?: string | null;
  requires_cubes?: boolean;
};
type ProjectRow = { id: number; project_name?: string | null; due_date?: string | null };
type LocationRow = { id: number; name: string };

const todayStr = () => new Date().toISOString().slice(0, 10);
// Inputs: unknown error object and fallback message.
// Process: tries API-specific fields first, then generic error message.
// Output: user-safe message string for UI feedback.
function formatError(err: unknown, fallback: string) {
  const anyErr = err as any;
  return anyErr?.response?.data?.detail || anyErr?.response?.data?.message || anyErr?.message || fallback;
}

// Inputs: caller state/arguments related to status chip color.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function statusChipColor(status: string): "default" | "warning" | "info" | "success" | "error" {
  if (status === "planned") return "default";
  if (status === "cast") return "info";
  if (status === "cut") return "warning";
  if (status === "completed") return "success";
  if (status === "hold_qc_1d_fail") return "error";
  return "default";
}

// Inputs: caller state/arguments related to status segment bg.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function statusSegmentBg(status: string): string {
  if (status === "completed") return "#C8E6C9";
  if (status === "cut") return "#FFE0B2";
  if (status === "cast") return "#BBDEFB";
  if (status === "planned") return "#ECEFF1";
  if (status === "hold_qc_1d_fail") return "#FFCDD2";
  return "#F5F5F5";
}

// Inputs: caller state/arguments related to status segment border.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function statusSegmentBorder(status: string): string {
  if (status === "completed") return "#2E7D32";
  if (status === "cut") return "#EF6C00";
  if (status === "cast") return "#1565C0";
  if (status === "hold_qc_1d_fail") return "#B71C1C";
  return "#90A4AE";
}

// Inputs: caller state/arguments related to cast length metric mm.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function castLengthMetricMm(c: Cast): number {
  // Visual length fallback chain: explicit used length -> panel length * qty -> heuristic.
  const used = Number(c.used_length_mm ?? 0);
  if (used > 0) return used;
  const panelLen = Number(c.panel_length_mm ?? 0);
  if (panelLen > 0) return Math.max(1, panelLen * Number(c.quantity ?? 1));
  return Math.max(1, Number(c.quantity ?? 1) * 1000);
}

/** Settings value: trim reserved at each end of the bed (mm). */
function clampMarginPerSideMm(bedLengthMm: number, marginMm: number): number {
  const m = Math.max(0, marginMm);
  if (bedLengthMm <= 0) return m;
  return Math.min(m, Math.floor(bedLengthMm / 2));
}

// Inputs: caller state/arguments related to panel length mm for cast.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function panelLengthMmForCast(c: Cast): number {
  const pl = Number(c.panel_length_mm ?? 0);
  if (pl > 0) return pl;
  const u = Number(c.used_length_mm ?? 0);
  const q = Math.max(1, Number(c.quantity ?? 1));
  return Math.max(1, Math.round(u / q));
}

// Inputs: caller state/arguments related to hollowcore bed layout strip.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function HollowcoreBedLayoutStrip({
  bedLengthMm,
  wasteMarginPerSideMm,
  rows,
  elementMap,
}: {
  bedLengthMm: number;
  wasteMarginPerSideMm: number;
  rows: Cast[];
  elementMap: Map<number, ElementRow>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const drag = useRef({ startX: 0, scrollLeft: 0 });
  const [grabbing, setGrabbing] = useState(false);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Click-and-drag horizontal panning for dense bed strips.
    if (!scrollRef.current || e.button !== 0) return;
    drag.current = { startX: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
    scrollRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setGrabbing(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.startX);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (scrollRef.current?.hasPointerCapture(e.pointerId)) {
      scrollRef.current.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    setGrabbing(false);
  };

  const marginMm = clampMarginPerSideMm(bedLengthMm, wasteMarginPerSideMm);
  const pxPerMm = 0.02;
  const innerWidthPx = Math.max(720, Math.round(bedLengthMm * pxPerMm));

  const pct = (mm: number) => Math.min(100, Math.max(0, (mm / bedLengthMm) * 100));

  type PanelSeg = { cast: Cast; index: number; lengthMm: number; offsetMm: number };
  const panels: PanelSeg[] = [];
  let cursorMm = marginMm;
  for (const c of rows) {
    // Expand one cast row into per-panel segments so each unit is visible.
    const panelLen = panelLengthMmForCast(c);
    const qty = Math.max(1, Number(c.quantity ?? 1));
    for (let i = 0; i < qty; i += 1) {
      panels.push({ cast: c, index: i + 1, lengthMm: panelLen, offsetMm: cursorMm });
      cursorMm += panelLen;
    }
  }
  const contentEndMm = cursorMm;
  const freeMidMm = Math.max(0, bedLengthMm - marginMm - contentEndMm);

  const tickCount = Math.max(1, Math.floor(bedLengthMm / 10000) + 1);

  return (
    <Box
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      sx={{
        overflowX: "auto",
        overflowY: "hidden",
        cursor: grabbing ? "grabbing" : "grab",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.50",
        maxWidth: "100%",
        touchAction: "pan-x",
        userSelect: grabbing ? "none" : undefined,
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: 184,
          minWidth: innerWidthPx,
          borderRadius: 1,
          bgcolor: "background.paper",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        {Array.from({ length: tickCount }).map((_, i) => {
          const atMm = i * 10000;
          if (atMm > bedLengthMm) return null;
          return (
            <Box
              key={`meter-${i}`}
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${pct(atMm)}%`,
                borderLeft: "1px dashed",
                borderColor: "divider",
                opacity: 0.45,
              }}
            >
              <Typography
                variant="caption"
                sx={{ position: "absolute", top: 4, left: 4, fontSize: 10, color: "text.disabled", whiteSpace: "nowrap" }}
              >
                {(atMm / 1000).toFixed(0)}m
              </Typography>
            </Box>
          );
        })}

        {marginMm > 0 ? (
          <Box
            sx={{
              position: "absolute",
              top: 26,
              bottom: 10,
              left: 0,
              width: `${pct(marginMm)}%`,
              border: "1px dashed",
              borderColor: "warning.main",
              borderRadius: 1,
              bgcolor: "rgba(255,152,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 0.25,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 9, color: "warning.dark", textAlign: "center", lineHeight: 1.1 }}>
              Margin
              <br />
              {(marginMm / 1000).toFixed(1)}m
            </Typography>
          </Box>
        ) : null}

        {marginMm > 0 ? (
          <Box
            sx={{
              position: "absolute",
              top: 26,
              bottom: 10,
              left: `${pct(bedLengthMm - marginMm)}%`,
              width: `${pct(marginMm)}%`,
              border: "1px dashed",
              borderColor: "warning.main",
              borderRadius: 1,
              bgcolor: "rgba(255,152,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 0.25,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 9, color: "warning.dark", textAlign: "center", lineHeight: 1.1 }}>
              Margin
              <br />
              {(marginMm / 1000).toFixed(1)}m
            </Typography>
          </Box>
        ) : null}

          {panels.map((p) => {
            const el = elementMap.get(Number(p.cast.element_id));
            const mark = el?.element_mark ?? `E${p.cast.element_id}`;
            const wPct = Math.max(0.35, pct(p.lengthMm));
          return (
            <Box
              key={`panel-${p.cast.id}-${p.index}`}
              title={`${mark} panel ${p.index}/${p.cast.quantity} • ${(p.lengthMm / 1000).toFixed(2)}m • ${p.cast.status}`}
              sx={{
                position: "absolute",
                top: 26,
                bottom: 10,
                left: `${pct(p.offsetMm)}%`,
                width: `${wPct}%`,
                minWidth: 26,
                border: "1px solid",
                borderColor: statusSegmentBorder(p.cast.status),
                bgcolor: statusSegmentBg(p.cast.status),
                px: 0.35,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                borderTop: "3px solid",
                borderTopColor: statusSegmentBorder(p.cast.status),
                borderRadius: 0.5,
                boxSizing: "border-box",
                zIndex: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  fontSize: 11,
                  lineHeight: 1.05,
                  textAlign: "center",
                  px: 0.2,
                  whiteSpace: "normal",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {mark}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.05, mt: 0.15 }} noWrap>
                #{p.index}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1, display: { xs: "none", sm: "block" } }} noWrap>
                {(p.lengthMm / 1000).toFixed(2)}m
              </Typography>
            </Box>
          );
        })}

        {freeMidMm > 0 ? (
          <Box
            sx={{
              position: "absolute",
              top: 26,
              bottom: 10,
              left: `${pct(contentEndMm)}%`,
              width: `${pct(freeMidMm)}%`,
              border: "1px dashed",
              borderColor: "text.disabled",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.disabled",
              fontSize: 11,
              fontStyle: "italic",
              bgcolor: "rgba(255,255,255,0.5)",
            }}
          >
            Free strip
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

/** Fallback when bed length is unknown: proportional strip without margin model. */
function HollowcoreBedLayoutFallback({
  rows,
  elementMap,
}: {
  rows: Cast[];
  elementMap: Map<number, ElementRow>;
}) {
  const totalUsedMm = rows.reduce((acc, c) => acc + castLengthMetricMm(c), 0);
  const visualTotalMm = Math.max(totalUsedMm, 1);
  const pxPerMm = 0.014;
  const innerWidthPx = Math.max(640, Math.round(visualTotalMm * pxPerMm));

  type PanelSeg = { cast: Cast; index: number; lengthMm: number; offsetMm: number };
  const panels: PanelSeg[] = [];
  let cursorMm = 0;
  for (const c of rows) {
    const panelLen = panelLengthMmForCast(c);
    const qty = Math.max(1, Number(c.quantity ?? 1));
    for (let i = 0; i < qty; i += 1) {
      panels.push({ cast: c, index: i + 1, lengthMm: panelLen, offsetMm: cursorMm });
      cursorMm += panelLen;
    }
  }

  const pct = (mm: number) => Math.min(100, Math.max(0, (mm / visualTotalMm) * 100));
  const tickCount = Math.max(1, Math.floor(visualTotalMm / 10000) + 1);

  return (
    <Box sx={{ overflowX: "auto", maxWidth: "100%", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ position: "relative", height: 120, minWidth: innerWidthPx, bgcolor: "background.paper", borderRadius: 1 }}>
        {Array.from({ length: tickCount }).map((_, i) => {
          const atMm = i * 10000;
          if (atMm > visualTotalMm) return null;
          return (
            <Box
              key={`fb-${i}`}
              sx={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${pct(atMm)}%`,
                borderLeft: "1px dashed",
                borderColor: "divider",
                opacity: 0.35,
              }}
            >
              <Typography variant="caption" sx={{ position: "absolute", top: 2, left: 2, fontSize: 10, color: "text.disabled" }}>
                {(atMm / 1000).toFixed(0)}m
              </Typography>
            </Box>
          );
        })}
        {panels.map((p) => {
          const el = elementMap.get(Number(p.cast.element_id));
          const mark = el?.element_mark ?? `E${p.cast.element_id}`;
          return (
            <Box
              key={`fb-panel-${p.cast.id}-${p.index}`}
              sx={{
                position: "absolute",
                top: 22,
                bottom: 8,
                left: `${pct(p.offsetMm)}%`,
                width: `${Math.max(0.5, pct(p.lengthMm))}%`,
                minWidth: 6,
                border: "1px solid",
                borderColor: statusSegmentBorder(p.cast.status),
                bgcolor: statusSegmentBg(p.cast.status),
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                borderTop: "3px solid",
                borderTopColor: statusSegmentBorder(p.cast.status),
                borderRadius: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10 }} noWrap>
                {mark} #{p.index}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// Inputs: caller state/arguments related to hollowcore casts.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function HollowcoreCasts() {
  const { user } = useAuth();
  const isAdmin = String(user?.role ?? "").toLowerCase() === "admin";
  const qc = useQueryClient();
  const [day, setDay] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState<string>("");

  const bedsQuery = useQuery({ queryKey: HOLLOWCORE_BEDS_KEY, queryFn: fetchHollowcoreBeds });
  const elementsQuery = useQuery({
    queryKey: ELEMENTS_INCLUDE_INACTIVE_KEY,
    queryFn: fetchElementsIncludeInactive,
  });
  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });
  const locationsQuery = useQuery({
    queryKey: YARD_LOCATIONS_KEY,
    queryFn: fetchYardLocations,
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({
    queryKey: HOLLOWCORE_SETTINGS_KEY,
    queryFn: fetchHollowcoreSettings,
  });

  const castsQuery = useQuery({
    queryKey: hollowcoreCastsDayKey(day, statusFilter),
    queryFn: () => fetchHollowcoreCastsForDay(day, statusFilter),
    enabled: Boolean(day),
  });

  const beds = bedsQuery.data ?? [];
  const elements = (elementsQuery.data ?? []) as ElementRow[];
  const projects = (projectsQuery.data ?? []) as ProjectRow[];
  const locations = (locationsQuery.data ?? []) as LocationRow[];
  const casts = castsQuery.data ?? [];
  const wasteMarginPerSideMm = Number(settingsQuery.data?.default_waste_mm ?? 2000);

  const [locationId, setLocationId] = useState<number | "">("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const batchIdsKey = useMemo(() => {
    const batchIds = casts.map((c) => c.batch_id).filter((x): x is string => Boolean(x));
    return Array.from(new Set(batchIds)).sort().join(",");
  }, [casts]);

  const qcStatusQuery = useQuery({
    queryKey: ["qc", "status", "hc-casts", batchIdsKey] as const,
    queryFn: async () => {
      const r = await api.get<
        Record<string, { passed: boolean | null; age_days?: number | null; ages?: Record<string, boolean | null>; cut_allowed?: boolean }>
      >("/qc/status", {
        params: { batch_ids: batchIdsKey },
      });
      return r.data ?? {};
    },
    enabled: batchIdsKey.length > 0,
    // Short staleness keeps QC gate decisions responsive while operators work.
    staleTime: 30_000,
  });

  const qcStatus = batchIdsKey.length > 0 ? (qcStatusQuery.data ?? {}) : {};

  const refreshCasts = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: hollowcoreCastsDayKey(day, statusFilter) }),
      qc.invalidateQueries({ queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY }),
    ]);

  const bedMap = useMemo(() => new Map(beds.map((b) => [Number(b.id), b.name] as const)), [beds]);
  const elementMap = useMemo(
    () => new Map(elements.map((e) => [Number(e.id), e] as const)),
    [elements]
  );
  const projectMap = useMemo(
    () => new Map(projects.map((p) => [Number(p.id), p] as const)),
    [projects]
  );

  const loading = castsQuery.isFetching;

  const byBed: Record<number, Cast[]> = {};
  for (const c of casts) {
    // Group once so rendering can iterate bed-by-bed.
    const key = c.bed_id ?? 0;
    byBed[key] ||= [];
    byBed[key].push(c);
  }
  const bedIds = Object.keys(byBed)
    .map(Number)
    .sort((a, b) => (bedMap.get(a) ?? `Bed #${a}`).localeCompare(bedMap.get(b) ?? `Bed #${b}`));

  const markCast = async (id: number) => {
    try {
      setProcessing(true);
      setErr(null);
      await api.post(`/hollowcore/casts/${id}/mark-cast`);
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to mark cast"));
    } finally {
      setProcessing(false);
    }
  };

  const complete = async (id: number) => {
    if (!locationId) {
      setErr("Select a yard location first");
      return;
    }
    try {
      setProcessing(true);
      setErr(null);
      await api.post(`/hollowcore/casts/${id}/complete`, { location_id: locationId });
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to complete cast"));
    } finally {
      setProcessing(false);
    }
  };

  const markCut = async (id: number) => {
    try {
      setProcessing(true);
      setErr(null);
      await api.post(`/hollowcore/casts/${id}/mark-cut`);
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to mark cut"));
    } finally {
      setProcessing(false);
    }
  };

  const requestRetest = async (id: number) => {
    const reason = window.prompt("Retest reason (required):", "1-day failed, priority retest requested");
    if (!reason || !reason.trim()) return;
    try {
      setProcessing(true);
      setErr(null);
      await api.post(`/hollowcore/casts/${id}/request-retest`, { reason: reason.trim() });
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to request retest"));
    } finally {
      setProcessing(false);
    }
  };

  const markCutOverride = async (id: number) => {
    const reason = window.prompt("Override reason (required):", "Approved conditional release");
    if (!reason || !reason.trim()) return;
    if (!window.confirm("Proceed with admin override and mark this cast as cut?")) return;
    try {
      setProcessing(true);
      setErr(null);
      await api.post(`/hollowcore/casts/${id}/mark-cut-override`, { reason: reason.trim() });
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to override cut"));
    } finally {
      setProcessing(false);
    }
  };

  const completeSelected = async () => {
    if (!locationId) {
      setErr("Select a yard location first");
      return;
    }
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (ids.length === 0) return;
    if (!window.confirm(`Complete ${ids.length} cast(s) and move to yard?`)) return;
    try {
      setProcessing(true);
      setErr(null);
      // Sequential API calls preserve predictable failure behavior per cast.
      for (const id of ids) {
        await api.post(`/hollowcore/casts/${id}/complete`, { location_id: locationId });
      }
      setSelected({});
      await refreshCasts();
    } catch (e) {
      setErr(formatError(e, "Failed to complete selected casts"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <div>
            <Typography variant="h5">Hollowcore Casts</Typography>
            <Typography variant="body2" color="text.secondary">
              Grouped by bed — select casts and mark complete.
            </Typography>
          </div>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" onClick={() => setDay(todayStr())}>
              Today
            </Button>
            <TextField label="Date" type="date" size="small" value={day} onChange={(e) => setDay(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 160 }}
            select
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="planned">Planned</MenuItem>
            <MenuItem value="cast">Cast</MenuItem>
            <MenuItem value="hold_qc_1d_fail">Hold (1d fail)</MenuItem>
            <MenuItem value="cut">Cut</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>
          <Button variant="outlined" onClick={() => void castsQuery.refetch()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <TextField
            label="Yard location (for Complete)"
            size="small"
            select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">Select...</MenuItem>
            {locations.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            This location will be used when you click "Complete".
          </Typography>
          <Button
            variant="contained"
            color="success"
            disabled={processing || Object.values(selected).every((v) => !v)}
            onClick={completeSelected}
          >
            Complete selected
          </Button>
        </Stack>

        {err ? <Alert severity="error">{err}</Alert> : null}

        {casts.length === 0 ? <Typography color="text.secondary">No casts scheduled for this date.</Typography> : null}

        <Grid container spacing={2}>
          {bedIds.map((bedId) => {
            const rows = (byBed[bedId] ?? [])
              .slice()
              .sort((a, b) => (Number(a.cast_slot_index ?? a.id) - Number(b.cast_slot_index ?? b.id)));
            const bedRow = beds.find((b) => Number(b.id) === Number(bedId));
            const bedLengthMm = Math.max(0, Number(bedRow?.length_mm ?? 0));
            const totalUsedMetricMm = rows.reduce((acc, c) => acc + castLengthMetricMm(c), 0);
            const marginAppliedMm = clampMarginPerSideMm(bedLengthMm, wasteMarginPerSideMm);
            const usableStripMm = Math.max(0, bedLengthMm - 2 * marginAppliedMm);
            const freeInStripMm = Math.max(0, usableStripMm - totalUsedMetricMm);
            const trimTotalMm = bedLengthMm > 0 ? 2 * marginAppliedMm : 0;
            const totalQty = rows.reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            const completedQty = rows
              .filter((c) => c.status === "completed")
              .reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            const castQty = rows.filter((c) => c.status === "cast").reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            const cutQty = rows.filter((c) => c.status === "cut").reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            const holdQty = rows
              .filter((c) => c.status === "hold_qc_1d_fail")
              .reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            const plannedQty = rows
              .filter((c) => c.status === "planned")
              .reduce((acc, c) => acc + Number(c.quantity ?? 0), 0);
            return (
              <Grid key={bedId} item xs={12}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="h6">
                        {bedMap.get(bedId) ?? (bedId ? `Bed #${bedId}` : "Unassigned bed")}
                      </Typography>
                      {bedLengthMm > 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right", maxWidth: 560 }}>
                          Used {(totalUsedMetricMm / 1000).toFixed(1)}m • Strip free {(freeInStripMm / 1000).toFixed(1)}m • End margins{" "}
                          {(trimTotalMm / 1000).toFixed(1)}m ({(marginAppliedMm / 1000).toFixed(1)}m + {(marginAppliedMm / 1000).toFixed(1)}m) • Bed{" "}
                          {(bedLengthMm / 1000).toFixed(1)}m
                        </Typography>
                      ) : null}
                    </Stack>
                    <Box sx={{ mt: 1, mb: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
                        <Typography variant="caption" color="text.secondary">
                          Bed layout ({rows.length} cast{rows.length === 1 ? "" : "s"}) — panels left to right; scroll or drag to pan
                        </Typography>
                        <Chip
                          size="small"
                          color={completedQty === totalQty && totalQty > 0 ? "success" : "default"}
                          label={`${totalQty > 0 ? ((completedQty / totalQty) * 100).toFixed(1) : "0.0"}% complete`}
                        />
                      </Stack>
                      {bedLengthMm > 0 ? (
                        <HollowcoreBedLayoutStrip
                          bedLengthMm={bedLengthMm}
                          wasteMarginPerSideMm={wasteMarginPerSideMm}
                          rows={rows}
                          elementMap={elementMap}
                        />
                      ) : (
                        <HollowcoreBedLayoutFallback rows={rows} elementMap={elementMap} />
                      )}
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                        <Chip size="small" color={statusChipColor("planned")} label={`Planned ${plannedQty}`} />
                        <Chip size="small" color={statusChipColor("cast")} label={`Cast ${castQty}`} />
                        <Chip size="small" color={statusChipColor("hold_qc_1d_fail")} label={`Hold ${holdQty}`} />
                        <Chip size="small" color={statusChipColor("cut")} label={`Cut ${cutQty}`} />
                        <Chip size="small" color={statusChipColor("completed")} label={`Completed ${completedQty}`} />
                      </Stack>
                    </Box>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {rows.map((c) => {
                    const el = elementMap.get(Number(c.element_id));
                    const pr =
                      el?.project_id != null ? projectMap.get(Number(el.project_id)) : undefined;
                        const due = el?.due_date ?? pr?.due_date ?? null;
                        const isLate = due ? c.cast_date > due : false;
                        const isDone = c.status === "completed";
                        const st = c.batch_id ? qcStatus[c.batch_id] : undefined;
                        const ages = st?.ages ?? {};
                        const oneDayFailed = ages["1"] === false;
                        const ageChip = (age: "1" | "7" | "28") => {
                          // QC age chips are the gating signal for cut authorization.
                          const v = ages[age];
                          if (v === true) return <Chip label={`${age}d PASS`} color="success" size="small" />;
                          if (v === false) return <Chip label={`${age}d FAIL`} color="error" size="small" />;
                          return <Chip label={`${age}d Pending`} color="warning" size="small" />;
                        };
                        return (
                          <Card
                            key={c.id}
                            variant="outlined"
                            sx={{
                              borderColor: isLate ? "error.main" : "divider",
                              bgcolor: isDone ? "success.50" : "background.paper",
                              borderRadius: 2,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                            }}
                          >
                            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                              <Stack spacing={1}>
                                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <FormControlLabel
                                      sx={{ mr: 1 }}
                                      control={
                                        <Checkbox
                                          checked={Boolean(selected[c.id])}
                                          onChange={(e) => setSelected((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                                          disabled={isDone || processing || c.status !== "cut"}
                                        />
                                      }
                                      label=""
                                    />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                                      {el?.element_mark ?? `Element #${c.element_id}`}
                                    </Typography>
                                    <Chip label={`${c.quantity} units`} size="small" />
                                    {isLate && <Chip label="Over due" color="error" size="small" />}
                                    {isDone && <Chip label="Completed" color="success" size="small" />}
                                  </Stack>

                                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    {el?.requires_cubes && c.batch_id ? (
                                      <Chip
                                        label={`Cube ref: ${c.batch_id}`}
                                        color="info"
                                        size="small"
                                        sx={{
                                          maxWidth: "100%",
                                          height: "auto",
                                          "& .MuiChip-label": {
                                            whiteSpace: "normal",
                                            overflow: "visible",
                                            textOverflow: "clip",
                                            lineHeight: 1.2,
                                            py: 0.25,
                                          },
                                        }}
                                      />
                                    ) : c.batch_id ? (
                                      <Chip
                                        label={`Batch: ${c.batch_id}`}
                                        size="small"
                                        color="info"
                                        sx={{
                                          maxWidth: "100%",
                                          height: "auto",
                                          "& .MuiChip-label": {
                                            whiteSpace: "normal",
                                            overflow: "visible",
                                            textOverflow: "clip",
                                            lineHeight: 1.2,
                                            py: 0.25,
                                          },
                                        }}
                                      />
                                    ) : null}
                                    {c.batch_id ? (
                                      <>{ageChip("1")}{ageChip("7")}{ageChip("28")}</>
                                    ) : null}
                                  </Stack>
                                  <Typography variant="body2" color="text.secondary" noWrap>
                                    {el?.element_type ?? "Hollowcore"}
                                    {pr ? ` • ${pr.project_name}` : ""}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Project: {pr?.project_name ?? (el?.project_id ? `#${el.project_id}` : "-")}
                                  </Typography>
                                  <Typography variant="caption" color={isLate ? "error.main" : "text.secondary"}>
                                    Due: {due ?? "-"}
                                  </Typography>
                                  <Typography variant="caption">Status: {c.status}</Typography>
                                  {(c.status === "hold_qc_1d_fail" || oneDayFailed) && (
                                    <Alert severity="error" sx={{ mt: 0.5 }}>
                                      1-day cube failed. Bed is on HOLD until retest passes or admin override is approved.
                                    </Alert>
                                  )}
                                </Stack>

                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={isDone || processing || c.status !== "planned"}
                                    onClick={() => markCast(c.id)}
                                  >
                                    Mark Cast
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    disabled={isDone || processing || !["cast", "hold_qc_1d_fail"].includes(c.status) || !st?.cut_allowed}
                                    onClick={() => markCut(c.id)}
                                  >
                                    Mark Cut
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    color="warning"
                                    size="small"
                                    disabled={isDone || processing || !["cast", "hold_qc_1d_fail"].includes(c.status)}
                                    onClick={() => requestRetest(c.id)}
                                  >
                                    Request Retest
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    disabled={isDone || processing || c.status !== "hold_qc_1d_fail" || !isAdmin}
                                    onClick={() => markCutOverride(c.id)}
                                  >
                                    Admin Override Cut
                                  </Button>
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    disabled={isDone || processing || locationId === "" || c.status !== "cut"}
                                    onClick={() => complete(c.id)}
                                  >
                                    Complete
                                  </Button>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    </Paper>
  );
}

