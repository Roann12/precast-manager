import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import api from "../api/client";
import {
  ELEMENTS_ALL_KEY,
  PROJECTS_OPTIONS_KEY,
  fetchElementsAll,
  fetchProjectsOptions,
} from "./elementsQuery";
import {
  HOLLOWCORE_SETTINGS_KEY,
  fetchHollowcoreSettings,
  hollowcoreCastsRangeKey,
  fetchHollowcoreCastsRange,
  type HollowcoreFactorySettings,
} from "./hollowcoreQuery";
import { YARD_LOCATIONS_KEY, fetchYardLocations } from "./yardQuery";
import { useNotify } from "../notifications/NotifyContext";

const toLocalISODate = (d: Date = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function Hollowcore() {
  const notify = useNotify();
  const qc = useQueryClient();

  const elementsQuery = useQuery({
    queryKey: ELEMENTS_ALL_KEY,
    queryFn: fetchElementsAll,
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

  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });

  const [fromDate, setFromDate] = useState<string>(toLocalISODate());
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return toLocalISODate(d);
  });

  const castsQuery = useQuery({
    queryKey: hollowcoreCastsRangeKey(fromDate, toDate),
    queryFn: () => fetchHollowcoreCastsRange(fromDate, toDate),
    enabled: Boolean(fromDate && toDate),
  });

  const elements = useMemo(() => {
    const all = elementsQuery.data ?? [];
    return all.filter((e) => e.panel_length_mm != null && e.slab_thickness_mm != null);
  }, [elementsQuery.data]);

  const locations = locationsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const casts = castsQuery.data ?? [];

  const [draft, setDraft] = useState<HollowcoreFactorySettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setDraft((d) => d ?? settingsQuery.data!);
    }
  }, [settingsQuery.data]);

  const [locationId, setLocationId] = useState<number | "">("");
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState<number | null>(null);

  const batchIds = useMemo(
    () => Array.from(new Set(casts.map((c) => c.batch_id).filter((x): x is string => Boolean(x)))),
    [casts]
  );

  const batchIdsKey = batchIds.sort().join(",");

  const qcStatusQuery = useQuery({
    queryKey: ["qc", "status", "hollowcore", batchIdsKey] as const,
    queryFn: async () => {
      const r = await api.get<Record<string, { passed: boolean | null }>>("/qc/status", {
        params: { batch_ids: batchIdsKey },
      });
      return r.data ?? {};
    },
    enabled: batchIdsKey.length > 0,
    staleTime: 30_000,
  });

  const qcStatus = batchIdsKey.length > 0 ? (qcStatusQuery.data ?? {}) : {};

  const invalidateHollowcore = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ELEMENTS_ALL_KEY }),
      qc.invalidateQueries({ queryKey: HOLLOWCORE_SETTINGS_KEY }),
      qc.invalidateQueries({ queryKey: ["hollowcore", "casts"] }),
    ]);

  const updateDraftNumber = (name: keyof HollowcoreFactorySettings, value: string) => {
    if (!draft) return;
    const n = value === "" ? 0 : Number(value);
    setDraft({ ...draft, [name]: n });
  };

  const saveSettings = async () => {
    if (!draft) return;
    await api.put("/hollowcore/settings", draft);
    await invalidateHollowcore();
    await castsQuery.refetch();
  };

  const generatePlan = async () => {
    setGenerating(true);
    try {
      await api.post("/hollowcore/generate");
      await castsQuery.refetch();
    } finally {
      setGenerating(false);
    }
  };

  const completeOne = async (castId: number) => {
    if (locationId === "") return;
    setCompleting(castId);
    try {
      await api.patch(`/hollowcore/casts/${castId}/complete`, { location_id: locationId });
      await invalidateHollowcore();
      await castsQuery.refetch();
    } catch (err) {
      console.error(err);
      notify.error("Failed to complete cast");
    } finally {
      setCompleting(null);
    }
  };

  const elementById = useMemo(() => new Map(elements.map((e) => [e.id, e] as const)), [elements]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p] as const)), [projects]);

  const groupedByDay = useMemo(() => {
    const map: Record<string, typeof casts> = {};
    for (const c of casts) {
      map[c.cast_date] ||= [];
      map[c.cast_date].push(c);
    }
    const days = Object.keys(map).sort();
    return days.map((d) => ({ day: d, items: map[d] }));
  }, [casts]);

  const pageLoading =
    elementsQuery.isPending ||
    locationsQuery.isPending ||
    settingsQuery.isPending ||
    projectsQuery.isPending ||
    castsQuery.isPending;

  if (pageLoading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="h5">Hollowcore Planning</Typography>
            <Typography variant="body2" color="text.secondary">
              Configure beds, generate cast grid, and mark casts complete.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button variant="outlined" onClick={() => setShowSettings((v) => !v)}>
              {showSettings ? "Close settings" : "Settings"}
            </Button>
            <Button variant="contained" onClick={generatePlan} disabled={generating}>
              {generating ? "Generating..." : "Generate Hollowcore Plan"}
            </Button>
          </Stack>
        </Stack>

        {showSettings ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              Hollowcore Settings
            </Typography>
            {!draft || !settingsQuery.data ? (
              <Typography variant="body2" color="text.secondary">
                Loading settings...
              </Typography>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Bed margin each end (mm)"
                    type="number"
                    size="small"
                    fullWidth
                    helperText="Reserved at each end of the bed."
                    value={draft.default_waste_mm}
                    onChange={(e) => updateDraftNumber("default_waste_mm", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Default casts/day"
                    type="number"
                    size="small"
                    fullWidth
                    value={draft.default_casts_per_day}
                    onChange={(e) => updateDraftNumber("default_casts_per_day", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Cutting strength (MPa)"
                    type="number"
                    size="small"
                    fullWidth
                    value={draft.cutting_strength_mpa}
                    onChange={(e) => updateDraftNumber("cutting_strength_mpa", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label="Final strength (MPa)"
                    type="number"
                    size="small"
                    fullWidth
                    value={draft.final_strength_mpa}
                    onChange={(e) => updateDraftNumber("final_strength_mpa", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={saveSettings}>
                      Save settings
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => {
                        if (settingsQuery.data) setDraft(settingsQuery.data);
                        setShowSettings(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            )}
          </Paper>
        ) : null}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              label="From"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Select
                size="small"
                value={locationId}
                displayEmpty
                onChange={(e: SelectChangeEvent<number | "">) =>
                  setLocationId(e.target.value === "" ? "" : Number(e.target.value))
                }
                sx={{ minWidth: 280 }}
              >
                <MenuItem value="">Select yard location…</MenuItem>
                {locations.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="body2" color="text.secondary">
                Used when you complete casts.
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {groupedByDay.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hollowcore casts in this date range.
          </Typography>
        ) : (
          groupedByDay.map(({ day, items }) => (
            <Box key={day}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                {day}
              </Typography>
              <Grid container spacing={2}>
                {items
                  .slice()
                  .sort((a, b) => a.bed_number - b.bed_number || a.cast_slot_index - b.cast_slot_index)
                  .map((c) => {
                    const el = elementById.get(c.element_id);
                    const due = el?.due_date ?? (el ? projectById.get(el.project_id)?.due_date ?? null : null);
                    const isLate = Boolean(due && c.cast_date > due);
                    const qcs = c.batch_id ? qcStatus[c.batch_id] : undefined;
                    const qcChip =
                      !c.batch_id ? (
                        <Chip size="small" label="QC: N/A" />
                      ) : qcs?.passed === true ? (
                        <Chip size="small" color="success" label="QC: PASS" />
                      ) : qcs?.passed === false ? (
                        <Chip size="small" color="error" label="QC: FAIL" />
                      ) : (
                        <Chip size="small" label="QC: Pending" />
                      );

                    return (
                      <Grid item xs={12} md={6} lg={4} key={c.id}>
                        <Card
                          variant="outlined"
                          sx={{
                            borderColor: isLate ? "error.main" : undefined,
                            borderWidth: isLate ? 2 : undefined,
                          }}
                        >
                          <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                              <Box>
                                <Typography variant="h6">
                                  Bed {c.bed_number} • Slot {c.cast_slot_index}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {el ? el.element_mark : `Element #${c.element_id}`} • {c.quantity} panels
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Thickness {c.slab_thickness_mm}mm • Length {c.panel_length_mm}mm
                                </Typography>
                                {c.batch_id && (
                                  <Typography variant="caption" color="text.secondary">
                                    Cube ref: {c.batch_id}
                                  </Typography>
                                )}
                                {isLate && (
                                  <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                                    Cast is past due ({due ?? "-"})
                                  </Typography>
                                )}
                              </Box>
                              <Box>{qcChip}</Box>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                disabled={c.status === "completed" || locationId === "" || completing === c.id}
                                onClick={() => completeOne(c.id).catch(console.error)}
                              >
                                {c.status === "completed"
                                  ? "Completed"
                                  : completing === c.id
                                    ? "Completing..."
                                    : "Complete"}
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
              </Grid>
            </Box>
          ))
        )}

        {casts.length > 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Note: QC cube refs are only generated for elements where <b>Test cubes required</b> is enabled.
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
