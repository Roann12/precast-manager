// File overview: Page component and UI logic for pages/planner.tsx.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  Alert,
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
} from "@mui/material";
import api from "../api/client";
import { isAxiosError } from "axios";
import type { DashboardCalendarItem, Mould } from "../types/api";
import WetcastingActivityFeed from "../components/WetcastingActivityFeed";
import { MOULDS_LIST_KEY, fetchMouldsList } from "./elementsQuery";
import { PLANNER_CALENDAR_KEY, fetchPlannerCalendar } from "./plannerQuery";
import { useNotify } from "../notifications/NotifyContext";

type Schedule = DashboardCalendarItem;

interface AggregatedSchedule {
  id: number;
  mould_id?: number;
  project_id: number;
  project_name: string;
  project_due_date: string | null;
  element_type: string;
  element_mark: string;
  element_due_date: string | null;
  quantity: number;
  status?: string;
  requires_cubes?: boolean;
  batch_id?: string | null;
}

type GroupedByDate = Record<string, Record<string, AggregatedSchedule[]>>;

type DelayEvent = {
  id: number;
  date: string;
  mould_id: number | null; // null => all moulds
  lost_capacity: number; // reduces mould daily capacity
  reason: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const AUTO_PLAN_POLL_MS = 60_000;
const AUTO_PLAN_STORAGE_KEY = "productionPlanner.autoPlanEnabled";
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Inputs: caller state/arguments related to effective capacity for.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function effectiveCapacityFor(mouldId: number | undefined, baseCapacity: number | undefined, date: string, delays: DelayEvent[]): number | undefined {
  if (baseCapacity == null) return undefined;
  const lost = delays
    .filter((d) => d.date === date && (d.mould_id == null || (mouldId != null && Number(d.mould_id) === Number(mouldId))))
    .reduce((s, d) => s + Number(d.lost_capacity ?? 0), 0);
  return Math.max(0, baseCapacity - lost);
}

// Inputs: caller state/arguments related to planner.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Planner() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const calendarQuery = useQuery({
    queryKey: PLANNER_CALENDAR_KEY,
    queryFn: fetchPlannerCalendar,
  });
  const mouldsQuery = useQuery({
    queryKey: MOULDS_LIST_KEY,
    queryFn: fetchMouldsList,
    staleTime: 60_000,
  });
  const calendar = calendarQuery.data ?? [];
  const moulds = mouldsQuery.data ?? [];
  const [planning, setPlanning] = useState(false);
  const [autoPlanEnabled, setAutoPlanEnabled] = useState(false);
  const [unscheduled, setUnscheduled] = useState<
    { element_id: number; element_mark: string; element_type: string; reason: string }[]
  >([]);
  const [qcStatus, setQcStatus] = useState<Record<string, { passed: boolean | null; age_days?: number | null }>>({});
  const [delayEvents, setDelayEvents] = useState<DelayEvent[]>([]);
  const [delayDate, setDelayDate] = useState(todayStr());
  const [delayMouldName, setDelayMouldName] = useState<string>("all");
  const [delayLostCapacity, setDelayLostCapacity] = useState<number>(1);
  const [delayReason, setDelayReason] = useState("");
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [pendingDelayAutoShift, setPendingDelayAutoShift] = useState(false);
  const [delaysLoaded, setDelaysLoaded] = useState(false);
  const [autoPlanLastRunAt, setAutoPlanLastRunAt] = useState<string | null>(null);
  const [autoPlanStatus, setAutoPlanStatus] = useState<string>("Waiting");
  const planningRef = useRef(false);
  const lastInputsSignatureRef = useRef<string>("");
  const initialDelayEnforcementDoneRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AUTO_PLAN_STORAGE_KEY);
      if (raw === "true") setAutoPlanEnabled(true);
    } catch (e) {
      console.error("Failed to restore auto-plan setting", e);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_PLAN_STORAGE_KEY, autoPlanEnabled ? "true" : "false");
    } catch (e) {
      console.error("Failed to persist auto-plan setting", e);
    }
  }, [autoPlanEnabled]);

  useEffect(() => {
    planningRef.current = planning;
  }, [planning]);

  const loadCalendar = async () => {
    const { data } = await calendarQuery.refetch();
    return data ?? [];
  };
  const refreshDashboardOverview = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const loadDelays = async (fromDate?: string, toDate?: string) => {
    try {
      const res = await api.get<any[]>("/planner/delays", {
        params: {
          planner_type: "production",
          from_date: fromDate,
          to_date: toDate,
        },
      });
      setDelayEvents(
        (res.data ?? []).map((d) => ({
          id: Number(d.id),
          date: String(d.delay_date).slice(0, 10),
          mould_id: d.mould_id == null ? null : Number(d.mould_id),
          lost_capacity: Number(d.lost_capacity ?? 1),
          reason: String(d.reason ?? ""),
        }))
      );
      setDelaysLoaded(true);
    } catch (e) {
      console.error(e);
      setDelaysLoaded(true);
    }
  };

  useEffect(() => {
    const batchIds = calendar
      .map((c) => c.batch_id)
      .filter((x): x is string => Boolean(x));
    if (batchIds.length === 0) {
      setQcStatus({});
      return;
    }
    api
      .get<Record<string, { passed: boolean | null; age_days?: number | null }>>("/qc/status", {
        params: { batch_ids: Array.from(new Set(batchIds)).join(",") },
      })
      .then((r) => setQcStatus(r.data ?? {}))
      .catch(() => setQcStatus({}));
  }, [calendar]);

  const grouped: GroupedByDate = useMemo(() => {
    const byDate: GroupedByDate = {};

    for (const item of calendar) {
      const {
        production_date,
        mould,
        mould_id,
        element_mark,
        element_type,
        status,
        quantity,
        id,
        requires_cubes,
        batch_id,
      } = item;

      if (!byDate[production_date]) {
        byDate[production_date] = {};
      }

      if (!byDate[production_date][mould]) {
        byDate[production_date][mould] = [];
      }

      const bucket = byDate[production_date][mould];

      const existing = bucket.find(
        (e) =>
          e.element_mark === element_mark &&
          e.element_type === element_type &&
          e.status === status &&
          (e.batch_id ?? null) === (batch_id ?? null)
      );

      if (existing) {
        existing.quantity += quantity;
      } else {
        bucket.push({
          id,
          mould_id,
          project_id: item.project_id,
          project_name: item.project_name,
          project_due_date: item.project_due_date,
          element_mark,
          element_type,
          element_due_date: item.element_due_date,
          quantity,
          status,
          requires_cubes,
          batch_id,
        });
      }
    }

    return byDate;
  }, [calendar]);

  // Use non-aggregated rows for delay shift simulation so every schedule row
  // is moved correctly (aggregated cards can hide multiple underlying rows).
  const groupedRawForDelayShift: GroupedByDate = useMemo(() => {
    const byDate: GroupedByDate = {};
    for (const item of calendar) {
      if (!byDate[item.production_date]) byDate[item.production_date] = {};
      if (!byDate[item.production_date][item.mould]) byDate[item.production_date][item.mould] = [];
      byDate[item.production_date][item.mould].push({
        id: item.id,
        mould_id: item.mould_id,
        project_id: item.project_id,
        project_name: item.project_name,
        project_due_date: item.project_due_date,
        element_type: item.element_type,
        element_mark: item.element_mark,
        element_due_date: item.element_due_date,
        quantity: item.quantity,
        status: item.status,
        requires_cubes: item.requires_cubes,
        batch_id: item.batch_id,
      });
    }
    return byDate;
  }, [calendar]);

  const dateKeys = Object.keys(grouped).sort();

  useEffect(() => {
    const from = dateKeys.at(0);
    const to = dateKeys.at(-1);
    loadDelays(from, to).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKeys.join("|")]);

  const mouldKeys = useMemo(() => {
    const set = new Set<string>();
    for (const date of Object.keys(grouped)) {
      for (const mouldName of Object.keys(grouped[date])) {
        set.add(mouldName);
      }
    }
    return Array.from(set).sort();
  }, [grouped]);

  const mouldIdByName = useMemo(() => {
    const map: Record<string, { id?: number; capacity?: number }> = {};
    for (const m of moulds) {
      map[m.name] = { id: m.id, capacity: m.capacity };
    }
    // fall back to IDs from calendar if any are missing
    for (const item of calendar) {
      if (!map[item.mould]) {
        map[item.mould] = { id: item.mould_id, capacity: undefined };
      } else if (map[item.mould].id == null && item.mould_id != null) {
        map[item.mould].id = item.mould_id;
      }
    }
    return map;
  }, [calendar, moulds]);

  const delayEventsByDateAndMould = useMemo(() => {
    const map: Record<string, DelayEvent[]> = {};
    for (const d of delayEvents) {
      const key = `${d.date}::${d.mould_id == null ? "all" : String(d.mould_id)}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [delayEvents]);

  const addDelayEvent = () => {
    const lost = Math.max(1, Math.floor(Number(delayLostCapacity) || 0));
    const mouldId = delayMouldName === "all" ? null : (mouldIdByName[delayMouldName]?.id ?? null);
    setPlanning(true);
    api
      .post("/planner/delays", {
        planner_type: "production",
        delay_date: delayDate,
        mould_id: mouldId,
        lost_capacity: lost,
        reason: delayReason.trim() || null,
      })
      .then(() => loadDelays(dateKeys.at(0), dateKeys.at(-1)))
      .then(() => loadCalendar())
      .then(() => refreshDashboardOverview())
      .then(() => setPendingDelayAutoShift(true))
      .then(() => setDelayReason(""))
      .catch((e) => {
        console.error(e);
        notify.error("Failed to add delay");
      })
      .finally(() => setPlanning(false));
  };

  const removeDelayEvent = (id: number) => {
    setPlanning(true);
    api
      .delete(`/planner/delays/${id}`)
      .then(() => loadDelays(dateKeys.at(0), dateKeys.at(-1)))
      .then(() => refreshDashboardOverview())
      .catch((e) => {
        console.error(e);
        notify.error("Failed to delete delay");
      })
      .finally(() => setPlanning(false));
  };

  const delayAutoShiftPreview = useMemo(() => {
    if (delayEvents.length === 0) return { moves: [] as Array<{ scheduleId: number; from: string; to: string; mouldName: string }>, warnings: [] as string[] };

    const byDateMould: Record<string, Record<string, AggregatedSchedule[]>> = groupedRawForDelayShift;
    const dateList = Object.keys(byDateMould).sort();
    const start = (delayEvents.map((d) => d.date).sort()[0] ?? dateList[0] ?? todayStr());

    const moves: Array<{ scheduleId: number; from: string; to: string; mouldName: string }> = [];
    const warnings: string[] = [];
    const plannedStatus = (s?: string) => (s ?? "planned") !== "completed";

    // Work on a mutable copy (just quantities+ids) so we can simulate.
    const sim: Record<string, Record<string, AggregatedSchedule[]>> = {};
    for (const d of Object.keys(byDateMould)) {
      sim[d] = {};
      for (const m of Object.keys(byDateMould[d])) {
        sim[d][m] = (byDateMould[d][m] ?? []).map((x) => ({ ...x }));
      }
    }

    const mouldNames = mouldKeys;
    for (const mouldName of mouldNames) {
      // build list of dates we will walk: from start until last known date + buffer
      const lastKnown = (dateList.at(-1) ?? start);
      const horizonDays = 60;
      const allDates: string[] = [];
      for (let i = 0; i <= horizonDays; i += 1) allDates.push(addDays(start, i));
      // ensure lastKnown is within list
      if (lastKnown > allDates.at(-1)!) {
        const extra = Math.ceil((new Date(lastKnown).getTime() - new Date(allDates.at(-1)!).getTime()) / (1000 * 60 * 60 * 24));
        for (let i = horizonDays + 1; i <= horizonDays + extra + 14; i += 1) allDates.push(addDays(start, i));
      }

      for (const date of allDates) {
        const info = mouldIdByName[mouldName];
        const capBase = info?.capacity;
        const cap = effectiveCapacityFor(info?.id, capBase, date, delayEvents);
        if (cap == null) continue;

        const bucket = (sim[date]?.[mouldName] ?? []);
        // lock completed rows in place
        const locked = bucket.filter((x) => (x.status ?? "planned") === "completed");
        const planned = bucket.filter((x) => plannedStatus(x.status) && (x.status ?? "planned") !== "completed");

        const usedLocked = locked.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
        if (usedLocked > cap) {
          warnings.push(`${mouldName} on ${date}: locked quantity ${usedLocked} exceeds delay-adjusted capacity ${cap}`);
        }
        let available = Math.max(0, cap - usedLocked);

        // if planned overflow, move whole cards (not partial quantities) forward
        const keep: AggregatedSchedule[] = [];
        const overflow: AggregatedSchedule[] = [];
        for (const it of planned) {
          const q = Number(it.quantity ?? 0);
          if (q <= available) {
            keep.push(it);
            available -= q;
          } else {
            overflow.push(it);
          }
        }

        if (overflow.length > 0) {
          // set today's bucket to locked+keep
          if (!sim[date]) sim[date] = {};
          sim[date][mouldName] = [...locked, ...keep];

          // push overflow to next days
          for (const ofl of overflow) {
            let placed = false;
            for (let step = 1; step <= horizonDays; step += 1) {
              const nextDate = addDays(date, step);
              const nextCap = effectiveCapacityFor(info?.id, capBase, nextDate, delayEvents);
              if (nextCap == null) continue;

              const nextBucket = (sim[nextDate]?.[mouldName] ?? []);
              const nextLocked = nextBucket.filter((x) => (x.status ?? "planned") === "completed");
              const nextPlanned = nextBucket.filter((x) => plannedStatus(x.status) && (x.status ?? "planned") !== "completed");
              const nextUsedLocked = nextLocked.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
              let nextAvailable = Math.max(0, nextCap - nextUsedLocked - nextPlanned.reduce((s, it) => s + Number(it.quantity ?? 0), 0));
              if (Number(ofl.quantity ?? 0) <= nextAvailable) {
                if (!sim[nextDate]) sim[nextDate] = {};
                sim[nextDate][mouldName] = [...nextLocked, ...nextPlanned, ofl];
                placed = true;
                moves.push({ scheduleId: ofl.id, from: date, to: nextDate, mouldName });
                break;
              }
            }
            if (!placed) {
              warnings.push(`${mouldName}: could not place schedule #${ofl.id} within ${horizonDays} days after ${date}`);
            }
          }
        }
      }
    }

    return { moves, warnings };
  }, [delayEvents, groupedRawForDelayShift, mouldIdByName, mouldKeys]);

  const applyDelayAutoShift = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (delayAutoShiftPreview.moves.length === 0) return;
    try {
      setPlanning(true);
      for (const mv of delayAutoShiftPreview.moves) {
        const mouldId = mouldIdByName[mv.mouldName]?.id;
        await api.patch(`/production/${mv.scheduleId}`, {
          mould_id: mouldId,
          production_date: mv.to,
        });
      }
      await loadCalendar();
      await refreshDashboardOverview();
    } catch (e) {
      console.error(e);
      if (!silent) {
        notify.error(
          "Failed to apply delay auto-shift. Some items may have moved; please refresh and try again."
        );
      }
    } finally {
      setPlanning(false);
    }
  }, [delayAutoShiftPreview.moves, mouldIdByName, notify, refreshDashboardOverview]);

  const runGenerate = async (
    mode: "generate" | "auto-plan",
    options?: { silent?: boolean; statusLabel?: string }
  ) => {
    const silent = Boolean(options?.silent);
    try {
      setPlanning(true);
      const res = await api.post(`/planner/${mode}`);
      if (res?.data?.unscheduled) setUnscheduled(res.data.unscheduled);
      if (!silent && res?.data?.message) {
        notify.info(String(res.data.message));
      } else if (!silent && res?.data?.scheduled_batches != null) {
        notify.success(`Scheduled batches: ${res.data.scheduled_batches}`);
      }
      await loadCalendar();
      await refreshDashboardOverview();
      // Always queue a delay enforcement pass after generate/auto-plan.
      setPendingDelayAutoShift(true);
      if (mode === "auto-plan") {
        setAutoPlanLastRunAt(new Date().toLocaleTimeString());
        setAutoPlanStatus(options?.statusLabel ?? "Ran");
      }
    } catch (e) {
      if (isAxiosError(e)) {
        const msg =
          (e.response?.data && (e.response.data.detail || e.response.data.error)) ||
          e.message ||
          "Failed to generate production plan";
        if (!silent) notify.error(msg);
        if (mode === "auto-plan") setAutoPlanStatus(`Error: ${msg}`);
      } else {
        if (!silent) notify.error("Failed to generate production plan");
        if (mode === "auto-plan") setAutoPlanStatus("Error");
      }
      console.error(e);
    } finally {
      setPlanning(false);
    }
  };

  useEffect(() => {
    if (!pendingDelayAutoShift) return;
    if (planning) return;
    if (!delaysLoaded) return;
    if (delayAutoShiftPreview.moves.length === 0) {
      setPendingDelayAutoShift(false);
      return;
    }
    setPendingDelayAutoShift(false);
    applyDelayAutoShift({ silent: true }).catch(console.error);
  }, [applyDelayAutoShift, delayAutoShiftPreview.moves.length, delaysLoaded, pendingDelayAutoShift, planning]);

  useEffect(() => {
    // On first ready load, enforce delays once so page changes/login keep delay-adjusted plan.
    if (!delaysLoaded) return;
    if (calendar.length === 0) return;
    if (initialDelayEnforcementDoneRef.current) return;
    initialDelayEnforcementDoneRef.current = true;
    if (delayEvents.length > 0) {
      setPendingDelayAutoShift(true);
    }
  }, [calendar.length, delayEvents.length, delaysLoaded]);

  const getPlanInputSignature = useCallback(async (): Promise<string> => {
    const [projectsRes, elementsRes] = await Promise.all([
      api.get<Array<{ id: number; due_date?: string | null }>>("/projects"),
      api.get<Array<{ id: number; due_date?: string | null; quantity?: number; active?: boolean }>>("/elements/", {
        params: { include_inactive: true },
      }),
    ]);
    const projects = (projectsRes.data ?? [])
      .map((p) => `${p.id}:${p.due_date ?? ""}`)
      .sort()
      .join("|");
    const elements = (elementsRes.data ?? [])
      .map((e) => `${e.id}:${e.due_date ?? ""}:${e.quantity ?? 0}:${e.active == null ? "" : String(e.active)}`)
      .sort()
      .join("|");
    return `${projects}::${elements}`;
  }, []);

  useEffect(() => {
    if (!autoPlanEnabled) {
      setAutoPlanStatus("Off");
      return;
    }

    let isActive = true;
    let pollTimer: number | undefined;

    const initializeAndRun = async () => {
      try {
        setAutoPlanStatus("Running initial auto-plan...");
        const sig = await getPlanInputSignature();
        if (!isActive) return;
        lastInputsSignatureRef.current = sig;
        await runGenerate("auto-plan", { silent: true, statusLabel: "Ran (initial)" });
      } catch (e) {
        console.error(e);
        if (isActive) setAutoPlanStatus("Error reading planner inputs");
      }
    };

    const pollForChanges = async () => {
      if (!isActive) return;
      if (planningRef.current) return;
      try {
        const sig = await getPlanInputSignature();
        if (!isActive) return;
        if (lastInputsSignatureRef.current !== sig) {
          lastInputsSignatureRef.current = sig;
          setAutoPlanStatus("Change detected - re-running auto-plan...");
          await runGenerate("auto-plan", { silent: true, statusLabel: "Ran (change detected)" });
        } else {
          setAutoPlanStatus("Watching for project/element changes");
        }
      } catch (e) {
        console.error(e);
        if (isActive) setAutoPlanStatus("Error checking for changes");
      }
    };

    initializeAndRun().catch(console.error);
    pollTimer = window.setInterval(() => {
      pollForChanges().catch(console.error);
    }, AUTO_PLAN_POLL_MS);

    return () => {
      isActive = false;
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [autoPlanEnabled, getPlanInputSignature]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeData = active.data.current as { scheduleId: number } | undefined;
    const overData = over.data.current as
      | { mould: string; production_date: string; mould_id?: number }
      | undefined;

    if (!activeData || !overData) return;

    try {
      // Client-side capacity guard that also respects delay events.
      const mouldName = overData.mould;
      const capBase = mouldIdByName[mouldName]?.capacity;
      const cap = effectiveCapacityFor(mouldIdByName[mouldName]?.id, capBase, overData.production_date, delayEvents);
      if (cap != null) {
        const items = grouped[overData.production_date]?.[mouldName] ?? [];
        const used = items.reduce((sum, it) => sum + it.quantity, 0);
        const moving = calendar.find((c) => c.id === activeData.scheduleId);
        const movingQty = Number(moving?.quantity ?? 0);
        if (used + movingQty > cap) {
          notify.warning(`Mould capacity exceeded (delay-adjusted cap ${cap}).`);
          return;
        }
      }

      await api.patch(`/production/${activeData.scheduleId}`, {
        mould_id: overData.mould_id,
        production_date: overData.production_date,
      });

      await loadCalendar();
      await refreshDashboardOverview();
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 400) {
        const raw =
          (e.response.data &&
            (e.response.data.detail || e.response.data.error)) ??
          null;
        const msg = String(raw || "Update rejected");
        notify.error(msg);
      } else {
        console.error("Failed to update production schedule", e);
      }
    }
  };

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

    pan.isDown = false;
    pan.pointerId = null;
    setIsPanning(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore (some browsers may throw if capture wasn't set)
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left mouse button only

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Don't pan when interacting with a draggable card.
    if (target.closest('[data-planner-card="true"]')) return;

    // Don't pan when interacting with common controls.
    if (
      target.closest("button, a, input, select, textarea, [role='button']")
    ) {
      return;
    }

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
      // Ignore
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

  useEffect(() => {
    if (dateKeys.length === 0) return;
    if (hasAutoScrolledToTodayRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const todayIso = todayStr();
    const preferredDate =
      dateKeys.find((d) => d >= todayIso) ??
      dateKeys.at(-1);

    if (!preferredDate) return;

    const targetRow =
      preferredDate === todayIso
        ? todayRowRef.current
        : (container.querySelector(`[data-date-row="${preferredDate}"]`) as HTMLDivElement | null);

    if (!targetRow) return;
    hasAutoScrolledToTodayRef.current = true;

    targetRow.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [dateKeys]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Production Planner</Typography>
        <Stack direction="row" spacing={1}>
          <WetcastingActivityFeed section="planner" />
          <Button
            variant="text"
            color="inherit"
            size="small"
            onClick={() => setDelayDialogOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Delay adjustments
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={autoPlanEnabled}
                onChange={(e) => setAutoPlanEnabled(e.target.checked)}
                disabled={planning}
                color="primary"
              />
            }
            label={`Auto plan: ${autoPlanEnabled ? "On" : "Off"}`}
            sx={{ mr: 1 }}
          />
          <Button
            variant="outlined"
            onClick={() => runGenerate(autoPlanEnabled ? "auto-plan" : "generate")}
            disabled={planning}
          >
            {autoPlanEnabled ? "Generate (Auto-plan mode)" : "Generate plan"}
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {autoPlanEnabled
          ? `Auto plan is enabled. It runs immediately, then checks every ${Math.floor(AUTO_PLAN_POLL_MS / 1000)}s for project/element changes. Status: ${autoPlanStatus}${autoPlanLastRunAt ? ` (last run ${autoPlanLastRunAt})` : ""}. Generate also runs auto-plan manually.`
          : "Auto plan is disabled. Generate will run the standard planner."}
      </Typography>

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
              Reduce mould capacity for a day (downtime). Delay shifts are applied automatically when a delay is added.
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
                label="Mould"
                size="small"
                value={delayMouldName}
                onChange={(e) => setDelayMouldName(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="all">All moulds</MenuItem>
                {mouldKeys.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Lost capacity"
                size="small"
                type="number"
                value={delayLostCapacity}
                onChange={(e) => setDelayLostCapacity(Math.max(1, Number(e.target.value || 1)))}
                inputProps={{ min: 1 }}
                sx={{ maxWidth: 160 }}
              />
              <TextField
                label="Reason"
                size="small"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                sx={{ minWidth: 260 }}
              />
              <Button variant="outlined" onClick={addDelayEvent} disabled={planning}>
                Add delay
              </Button>
            </Stack>

            {delayEvents.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {delayEvents.map((d) => {
                  const mouldLabel =
                    d.mould_id == null
                      ? "All moulds"
                      : mouldKeys.find((name) => mouldIdByName[name]?.id === d.mould_id) ?? `Mould #${d.mould_id}`;
                  return (
                    <Chip
                      key={d.id}
                      label={`${d.date} • ${mouldLabel} • -${d.lost_capacity}${d.reason ? ` • ${d.reason}` : ""}`}
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

            {delayAutoShiftPreview.warnings.length > 0 ? (
              <Alert severity="warning" sx={{ py: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Capacity warnings
                </Typography>
                {delayAutoShiftPreview.warnings.map((w) => (
                  <Typography key={w} variant="body2" color="text.secondary">
                    - {w}
                  </Typography>
                ))}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
      </Dialog>

      {unscheduled.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Unscheduled elements
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {unscheduled.map((u) => (
              <Typography key={u.element_id} variant="body2" color="text.secondary">
                <b>{u.element_mark}</b> ({u.element_type}): {u.reason}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      <div
        ref={scrollContainerRef}
        style={{
          overflowX: "auto",
          touchAction: "none",
          cursor: isPanning ? "grabbing" : "grab",
          userSelect: isPanning ? "none" : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {dateKeys.length === 0 && (
            <p style={{ marginTop: 16 }}>No production scheduled yet.</p>
          )}

          {dateKeys.length > 0 && (
            <div
              style={{
                width: "max-content",
                display: "grid",
                gridTemplateColumns: `150px repeat(${mouldKeys.length}, 320px)`,
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              {/* Header row */}
              <div
                style={{
                  fontWeight: "bold",
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  background: "#fff",
                  borderRight: "1px solid #eee",
                }}
              >
                Date
              </div>

              {mouldKeys.map((mouldName) => {
                const info = mouldIdByName[mouldName];
                const capacity = info?.capacity;
                return (
                  <div
                    key={`header-${mouldName}`}
                    style={{ fontWeight: "bold", textAlign: "center" }}
                  >
                    {mouldName}
                    {capacity != null && (
                      <div style={{ fontSize: 12, fontWeight: "normal" }}>
                        Cap: {capacity}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Data rows */}
              {dateKeys.map((date) => (
                <React.Fragment key={date}>
                  {(() => {
                    const isToday = date === todayStr();
                    return (
                  <div
                    ref={isToday ? todayRowRef : null}
                    data-date-row={date}
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
                    {date}
                    {isToday && (
                      <div style={{ fontSize: 11, fontWeight: 700 }}>
                        Today
                      </div>
                    )}
                  </div>
                    );
                  })()}

                  {mouldKeys.map((mouldName) => {
                    const items = grouped[date]?.[mouldName] ?? [];
                    const info = mouldIdByName[mouldName];
                    const capacity = effectiveCapacityFor(info?.id, info?.capacity, date, delayEvents);
                    const allMouldDelays = delayEventsByDateAndMould[`${date}::all`] ?? [];
                    const specificMouldDelays =
                      info?.id != null ? (delayEventsByDateAndMould[`${date}::${info.id}`] ?? []) : [];
                    const cellDelays = [...allMouldDelays, ...specificMouldDelays];
                    const lostTotal = cellDelays.reduce((sum, d) => sum + Number(d.lost_capacity ?? 0), 0);
                    const used = items.reduce((sum, it) => sum + it.quantity, 0);
                    const ratio =
                      capacity && capacity > 0 ? Math.min(used / capacity, 1) : 0;

                    return (
                      <MouldDropZone
                        key={`cell-${date}-${mouldName}`}
                        mould={mouldName}
                        production_date={date}
                        mouldId={mouldIdByName[mouldName]?.id}
                      >
                        <div
                          style={{
                            minHeight: 40,
                            padding: 4,
                            border: "1px solid #eee",
                          }}
                        >
                            {cellDelays.length > 0 && (
                              <div
                                style={{
                                  marginBottom: 6,
                                  padding: "4px 6px",
                                  border: "1px solid #ffcc80",
                                  borderRadius: 4,
                                  background: "#fff8e1",
                                  fontSize: 11,
                                  color: "#8a5100",
                                }}
                              >
                                Delay: -{lostTotal} capacity
                                {cellDelays.some((d) => Boolean(d.reason?.trim())) && (
                                  <div style={{ marginTop: 2, color: "#7a5a1e" }}>
                                    {cellDelays
                                      .map((d) => d.reason?.trim())
                                      .filter((r): r is string => Boolean(r))
                                      .join(" | ")}
                                  </div>
                                )}
                              </div>
                            )}
                            {capacity != null && capacity > 0 && (
                              <div
                                style={{
                                  marginBottom: 4,
                                  fontSize: 11,
                                }}
                              >
                                <div
                                  style={{
                                    height: 8,
                                    background: "#f1f1f1",
                                    borderRadius: 4,
                                    overflow: "hidden",
                                    marginBottom: 2,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${ratio * 100}%`,
                                      height: "100%",
                                      background:
                                        ratio > 1
                                          ? "#ff4d4f"
                                          : ratio > 0.8
                                          ? "#ffa726"
                                          : "#90caf9",
                                    }}
                                  />
                                </div>
                                {used} / {capacity}
                              </div>
                            )}
                          <div style={{ display: "flex", flexWrap: "wrap" }}>
                            {items.map((item) => (
                              <DraggableCard
                                key={item.id}
                                id={item.id}
                                element_mark={item.element_mark}
                                element_type={item.element_type}
                                quantity={item.quantity}
                                status={item.status}
                                production_date={date}
                                mould={mouldName}
                                project_due_date={item.project_due_date}
                                element_due_date={item.element_due_date}
                                requires_cubes={Boolean(item.requires_cubes)}
                                batch_id={item.batch_id ?? null}
                                qc_passed={
                                  item.batch_id ? (qcStatus[item.batch_id]?.passed ?? null) : null
                                }
                                qc_age_days={
                                  item.batch_id ? (qcStatus[item.batch_id]?.age_days ?? null) : null
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </MouldDropZone>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </DndContext>
      </div>
    </Paper>
  );
}

interface DraggableCardProps {
  id: number;
  element_mark: string;
  element_type: string;
  quantity: number;
  status?: string;
  production_date: string;
  mould: string;
  project_due_date: string | null;
  element_due_date: string | null;
  requires_cubes: boolean;
  batch_id: string | null;
  qc_passed: boolean | null;
  qc_age_days: number | null;
}

// Inputs: caller state/arguments related to draggable card.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function DraggableCard(props: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `card-${props.id}`,
    data: { scheduleId: props.id },
  });

  let background = "#e8f3ff";

  if (props.status === "completed") background = "#d4edda";
  if (props.status === "delayed") background = "#ffd6d6";

  const due = props.element_due_date ?? props.project_due_date;
  const isLate = due ? props.production_date > due : false;
  if (isLate) background = "#ffe3e3";

  const style: React.CSSProperties = {
    border: "1px solid #ccc",
    padding: 8,
    margin: 6,
    background,
    borderRadius: 6,
    minWidth: 120,
    cursor: "grab",
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-planner-card="true"
      {...listeners}
      {...attributes}
    >
      <div style={{ fontWeight: "bold" }}>{props.element_mark}</div>
      <div>{props.element_type}</div>
      <div>Qty: {props.quantity}</div>
      {props.requires_cubes && props.batch_id && (
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip label={`Cube ref: ${props.batch_id}`} size="small" color="info" />
          {props.qc_passed === true ? (
            <Chip label={`QC: PASS${props.qc_age_days ? ` (${props.qc_age_days}d)` : ""}`} size="small" color="success" />
          ) : props.qc_passed === false ? (
            <Chip label={`QC: FAIL${props.qc_age_days ? ` (${props.qc_age_days}d)` : ""}`} size="small" color="error" />
          ) : (
            <Chip label="QC: Pending" size="small" color="warning" />
          )}
        </div>
      )}
      {due && (
        <div style={{ fontSize: 11, marginTop: 2, color: isLate ? "#b71c1c" : "#555" }}>
          Due: {due}
        </div>
      )}

      {props.status && (
        <div style={{ fontSize: 12, marginTop: 4 }}>
          Status: {props.status}
        </div>
      )}
    </div>
  );
}

interface MouldDropZoneProps {
  mould: string;
  production_date: string;
  mouldId?: number;
  children: React.ReactNode;
}

// Inputs: caller state/arguments related to mould drop zone.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function MouldDropZone({
  mould,
  production_date,
  mouldId,
  children,
}: MouldDropZoneProps) {
  const { setNodeRef } = useDroppable({
    id: `drop-${production_date}-${mould}`,
    data: {
      mould,
      production_date,
      mould_id: mouldId,
    },
  });

  return <div ref={setNodeRef}>{children}</div>;
}