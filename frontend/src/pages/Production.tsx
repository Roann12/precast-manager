import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  Checkbox,
  FormControlLabel,
  Box,
  CircularProgress,
  LinearProgress,
  Alert,
} from "@mui/material";
import api from "../api/client";
import type { ProductionSchedule } from "../types/api";
import WetcastingActivityFeed from "../components/WetcastingActivityFeed";
import {
  ELEMENTS_ALL_KEY,
  ELEMENTS_PREFAB_LIST_KEY,
  MOULDS_LIST_KEY,
  PROJECTS_OPTIONS_KEY,
  fetchElementsAll,
  fetchMouldsList,
  fetchProjectsOptions,
} from "./elementsQuery";
import { PRODUCTION_SCHEDULE_KEY, fetchProductionSchedule } from "./productionQuery";
import { YARD_LOCATIONS_KEY, fetchYardLocations } from "./yardQuery";
import { useNotify } from "../notifications/NotifyContext";

export default function Production() {
  const notify = useNotify();
  const qc = useQueryClient();

  const scheduleQuery = useQuery({
    queryKey: PRODUCTION_SCHEDULE_KEY,
    queryFn: fetchProductionSchedule,
  });

  const elementsAllQuery = useQuery({
    queryKey: ELEMENTS_ALL_KEY,
    queryFn: fetchElementsAll,
  });

  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });

  const mouldsQuery = useQuery({
    queryKey: MOULDS_LIST_KEY,
    queryFn: fetchMouldsList,
    staleTime: 60_000,
  });

  const locationsQuery = useQuery({
    queryKey: YARD_LOCATIONS_KEY,
    queryFn: fetchYardLocations,
    staleTime: 60_000,
  });

  const items = scheduleQuery.data ?? [];
  const elements = elementsAllQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const moulds = mouldsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  const pageLoading =
    scheduleQuery.isPending ||
    elementsAllQuery.isPending ||
    projectsQuery.isPending ||
    mouldsQuery.isPending ||
    locationsQuery.isPending;

  const refetchingSchedule = scheduleQuery.isFetching && !scheduleQuery.isPending;

  const refreshAfterComplete = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: PRODUCTION_SCHEDULE_KEY }),
      qc.invalidateQueries({ queryKey: ELEMENTS_ALL_KEY }),
      qc.invalidateQueries({ queryKey: ELEMENTS_PREFAB_LIST_KEY }),
    ]);

  const [locationId, setLocationId] = useState<number | "">("");
  const [day, setDay] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [completing, setCompleting] = useState(false);

  const batchIdsKey = useMemo(() => {
    const todays = items.filter((s) => s.production_date === day);
    const batchIds = todays.map((s) => s.batch_id).filter((x): x is string => Boolean(x));
    return Array.from(new Set(batchIds)).sort().join(",");
  }, [items, day]);

  const qcStatusQuery = useQuery({
    queryKey: ["qc", "status", batchIdsKey] as const,
    queryFn: async () => {
      const r = await api.get<Record<string, { passed: boolean | null; age_days?: number | null }>>("/qc/status", {
        params: { batch_ids: batchIdsKey },
      });
      return r.data ?? {};
    },
    enabled: batchIdsKey.length > 0,
    staleTime: 30_000,
  });

  const qcStatus = batchIdsKey.length > 0 ? (qcStatusQuery.data ?? {}) : {};

  const elementById = new Map(elements.map((e) => [e.id, e] as const));
  const projectById = new Map(projects.map((p) => [p.id, p] as const));
  const mouldById = new Map(moulds.map((m) => [m.id, m] as const));

  const todays = items.filter((s) => s.production_date === day);
  const byMould: Record<number, ProductionSchedule[]> = {};
  for (const s of todays) {
    byMould[s.mould_id] ||= [];
    byMould[s.mould_id].push(s);
  }

  const mouldIds = Object.keys(byMould)
    .map(Number)
    .sort((a, b) => (mouldById.get(a)?.name ?? "").localeCompare(mouldById.get(b)?.name ?? ""));

  const handleComplete = async (scheduleId: number) => {
    if (locationId === "") {
      notify.warning("Select a yard location first");
      return;
    }
    try {
      await api.post("/production/complete", null, {
        params: { schedule_id: scheduleId, location_id: Number(locationId) },
      });
      await refreshAfterComplete();
    } catch (err) {
      notify.error("Failed to complete production");
      console.error(err);
    }
  };

  const completeSelected = async () => {
    if (locationId === "") {
      notify.warning("Select a yard location first");
      return;
    }
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    if (ids.length === 0) return;

    if (!window.confirm(`Complete ${ids.length} cast(s) and move to yard?`)) return;

    setCompleting(true);
    try {
      for (const id of ids) {
        await api.post("/production/complete", null, {
          params: { schedule_id: id, location_id: Number(locationId) },
        });
      }
      setSelected({});
      await refreshAfterComplete();
    } catch (err) {
      notify.error("Failed to complete selected casts");
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      {refetchingSchedule ? <LinearProgress sx={{ mb: 2, mt: -1, borderRadius: 1 }} /> : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <div>
          <Typography variant="h5">Production Line</Typography>
          <Typography variant="body2" color="text.secondary">
            Grouped by mould — select casts and mark complete.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} alignItems="center">
          <WetcastingActivityFeed section="production" />
          <Button variant="outlined" onClick={() => setDay(new Date().toISOString().slice(0, 10))}>
            Today
          </Button>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Stack>
      </Stack>

      {scheduleQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load production schedule.
        </Alert>
      ) : null}
      {elementsAllQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load elements.
        </Alert>
      ) : null}
      {projectsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load projects.
        </Alert>
      ) : null}
      {mouldsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load moulds.
        </Alert>
      ) : null}
      {locationsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load yard locations.
        </Alert>
      ) : null}

      {pageLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center" }} flexWrap="wrap">
            <TextField
              label="Move completed items to"
              size="small"
              select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">Select yard location…</MenuItem>
              {locations.map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary">
              This location will be used when you click “Complete”.
            </Typography>
            <Button
              variant="contained"
              color="success"
              disabled={completing || Object.values(selected).every((v) => !v)}
              onClick={completeSelected}
            >
              Complete selected
            </Button>
          </Stack>

          {todays.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No casts scheduled for this date.
            </Typography>
          )}

          <Grid container spacing={2}>
            {mouldIds.map((mouldId) => {
              const mould = mouldById.get(mouldId);
              const list = byMould[mouldId] ?? [];
              const used = list.reduce((sum, s) => sum + s.quantity, 0);
              const cap = mould?.capacity ?? 0;

              return (
                <Grid key={mouldId} item xs={12} md={6} lg={4}>
                  <Card variant="outlined" sx={{ height: "100%" }}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <div>
                          <Typography variant="h6">{mould?.name ?? `Mould #${mouldId}`}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {mould?.mould_type ?? ""}
                            {mould ? ` • cycle ${mould.cycle_time_hours}h` : ""}
                          </Typography>
                        </div>
                        {cap > 0 && (
                          <Chip
                            label={`${used}/${cap}`}
                            color={used > cap ? "error" : used === cap ? "warning" : "default"}
                            size="small"
                          />
                        )}
                      </Stack>

                      <Stack spacing={1}>
                        {list
                          .slice()
                          .sort((a, b) => a.id - b.id)
                          .map((s) => {
                            const el = elementById.get(s.element_id);
                            const proj = el ? projectById.get(el.project_id) : undefined;
                            const due = el?.due_date ?? proj?.due_date ?? null;
                            const isLate = due ? s.production_date > due : false;
                            const isDone = s.status === "completed";

                            return (
                              <Card
                                key={s.id}
                                variant="outlined"
                                sx={{
                                  borderColor: isLate ? "error.main" : "divider",
                                  bgcolor: isDone ? "success.50" : "background.paper",
                                }}
                              >
                                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <FormControlLabel
                                          sx={{ mr: 1 }}
                                          control={
                                            <Checkbox
                                              checked={Boolean(selected[s.id])}
                                              onChange={(e) =>
                                                setSelected((prev) => ({ ...prev, [s.id]: e.target.checked }))
                                              }
                                              disabled={isDone || completing}
                                            />
                                          }
                                          label=""
                                        />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                                          {el?.element_mark ?? `Element #${s.element_id}`}
                                        </Typography>
                                        <Chip label={`${s.quantity} units`} size="small" />
                                        {isLate && <Chip label="Over due" color="error" size="small" />}
                                        {isDone && <Chip label="Completed" color="success" size="small" />}
                                        {el?.requires_cubes && s.batch_id && (
                                          <Chip
                                            label={`Cube ref: ${s.batch_id}`}
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
                                        )}
                                        {el?.requires_cubes && s.batch_id && (
                                          (() => {
                                            const st = qcStatus[s.batch_id];
                                            if (!st) return <Chip label="QC: Pending" color="warning" size="small" />;
                                            if (st.passed === true)
                                              return (
                                                <Chip
                                                  label={`QC: PASS${st.age_days ? ` (${st.age_days}d)` : ""}`}
                                                  color="success"
                                                  size="small"
                                                />
                                              );
                                            if (st.passed === false)
                                              return (
                                                <Chip
                                                  label={`QC: FAIL${st.age_days ? ` (${st.age_days}d)` : ""}`}
                                                  color="error"
                                                  size="small"
                                                />
                                              );
                                            return <Chip label="QC: Pending" color="warning" size="small" />;
                                          })()
                                        )}
                                      </Stack>
                                      <Typography variant="body2" color="text.secondary" noWrap>
                                        {el?.element_type ?? ""}
                                        {proj ? ` • ${proj.project_name}` : ""}
                                      </Typography>
                                      <Typography variant="caption" color={isLate ? "error.main" : "text.secondary"}>
                                        Due: {due ?? "-"}
                                      </Typography>
                                    </Stack>

                                    <Button
                                      variant="contained"
                                      color="success"
                                      size="large"
                                      disabled={isDone || completing || locationId === ""}
                                      onClick={() => handleComplete(s.id)}
                                      sx={{ minWidth: 120 }}
                                    >
                                      Complete
                                    </Button>
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
        </>
      )}
    </Paper>
  );
}
