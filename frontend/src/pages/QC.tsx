// File overview: Page component and UI logic for pages/QC.tsx.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import * as XLSX from "xlsx";
import api from "../api/client";
import type { Project } from "../types/api";
import { PROJECTS_OPTIONS_KEY, fetchProjectsOptions } from "./elementsQuery";
import {
  QC_QUEUE_KEY,
  fetchQcQueue,
  qcMixStatsKey,
  fetchQcMixStats,
  qcProjectResultsKey,
  fetchQcProjectResults,
  qcTestsKey,
  fetchQcTests,
} from "./qcQuery";
import { useNotify } from "../notifications/NotifyContext";

const toLocalISODate = (d: Date = new Date()) => {
  // Convert Date -> YYYY-MM-DD using local timezone (avoid UTC shift from toISOString()).
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toDateOnlyValue = (s: string) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

type QcDueItem = {
  schedule_id: number;
  production_date: string;
  due_date: string;
  age_days: number;
  quantity: number;
  batch_id: string;
  element_id: number;
  element_mark: string;
  element_type: string;
  concrete_strength_mpa: number | null;
  required_strength_mpa?: number | null;
  mix_design_id?: number | null;
  mix_design_name?: string | null;
  project_id: number;
  project_name: string;
  is_retest?: boolean;
};

type QualityTestRow = {
  id: number;
  element_id: number;
  batch_id: string | null;
  test_type: string;
  result: string;
  age_days: number | null;
  cube1_weight_kg?: number | null;
  cube1_strength_mpa?: number | null;
  cube2_weight_kg?: number | null;
  cube2_strength_mpa?: number | null;
  cube3_weight_kg?: number | null;
  cube3_strength_mpa?: number | null;
  avg_strength_mpa?: number | null;
  measured_strength_mpa: number | null;
  required_strength_mpa: number | null;
  passed: boolean | null;
  test_date: string;
  notes: string | null;
};

type QcDueResponse = {
  overdue: QcDueItem[];
  today: QcDueItem[];
  tomorrow: QcDueItem[];
  today_date: string;
  tomorrow_date: string;
};

type MixStats = {
  mix_design_id: number;
  mix_design_name: string | null;
  target_strength_mpa: number | null;
  age_7: { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null; pass_rate: number | null };
  age_28: { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null; pass_rate: number | null };
};

type QcProjectResultRow = QualityTestRow & {
  element_mark: string;
  element_type: string;
  project_id: number;
  project_name: string;
  cast_date: string | null;
  due_date: string | null;
};

// Inputs: caller state/arguments related to qc.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function QC() {
  const notify = useNotify();
  const qc = useQueryClient();

  const dueQuery = useQuery({
    queryKey: QC_QUEUE_KEY,
    queryFn: fetchQcQueue,
  });
  const due = (dueQuery.data ?? null) as QcDueResponse | null;

  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });
  const projects = projectsQuery.data ?? [];

  const [selected, setSelected] = useState<QcDueItem | null>(null);

  const batchId = selected?.batch_id ?? "";
  const testsQuery = useQuery({
    queryKey: qcTestsKey(batchId || "__none__"),
    queryFn: () => fetchQcTests(batchId),
    enabled: Boolean(batchId),
  });
  const tests = (testsQuery.data ?? []) as QualityTestRow[];

  const mixDesignId = selected?.mix_design_id;
  const mixStatsQuery = useQuery({
    queryKey: mixDesignId != null ? qcMixStatsKey(mixDesignId) : ["qc", "mix-stats", "none"],
    queryFn: () => fetchQcMixStats(mixDesignId!),
    enabled: mixDesignId != null,
  });
  const mixStats = (mixStatsQuery.data ?? null) as MixStats | null;

  const [projectForResults, setProjectForResults] = useState<number | "">("");
  const [resultsProjectId, setResultsProjectId] = useState<number | null>(null);

  const projectResultsQuery = useQuery({
    queryKey: resultsProjectId != null ? qcProjectResultsKey(resultsProjectId) : ["qc", "results", "idle"],
    queryFn: () => fetchQcProjectResults(resultsProjectId!),
    enabled: resultsProjectId != null,
  });
  const projectResults = (projectResultsQuery.data ?? []) as QcProjectResultRow[];
  const projectResultsLoading = projectResultsQuery.isFetching;

  const [ageDays, setAgeDays] = useState<number>(7);
  const [cube1Weight, setCube1Weight] = useState<string>("");
  const [cube1Strength, setCube1Strength] = useState<string>("");
  const [cube2Weight, setCube2Weight] = useState<string>("");
  const [cube2Strength, setCube2Strength] = useState<string>("");
  const [cube3Weight, setCube3Weight] = useState<string>("");
  const [cube3Strength, setCube3Strength] = useState<string>("");
  const [testDate, setTestDate] = useState<string>(toLocalISODate());
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const queueItemLabel = (i: QcDueItem, includeDueDate = false) => {
    const retestPrefix = i.is_retest ? "[Retest] " : "";
    const duePart = includeDueDate ? ` • DUE ${i.due_date}` : "";
    return `${retestPrefix}${i.age_days}d • ${i.batch_id} • ${i.project_name} • ${i.element_mark}${duePart} • cast ${i.production_date}`;
  };

  useEffect(() => {
    if (projects.length > 0 && projectForResults === "") {
      setProjectForResults(projects[0].id);
    }
  }, [projects, projectForResults]);

  const exportProjectResultsToExcel = () => {
    if (projectForResults === "") return;
    if (projectResults.length === 0) return;

    const rows = projectResults.map((r) => ({
      "Project": r.project_name,
      "Test Date": r.test_date,
      "Batch ID": r.batch_id ?? "",
      "Element Mark": r.element_mark,
      "Element Type": r.element_type,
      "Age (days)": r.age_days ?? "",
      "Test Type": r.test_type,
      "Cast Date": r.cast_date ?? "",
      "Due Date": r.due_date ?? "",
      "Cube1 Weight (kg)": r.cube1_weight_kg ?? "",
      "Cube1 Strength (MPa)": r.cube1_strength_mpa ?? "",
      "Cube2 Weight (kg)": r.cube2_weight_kg ?? "",
      "Cube2 Strength (MPa)": r.cube2_strength_mpa ?? "",
      "Cube3 Weight (kg)": r.cube3_weight_kg ?? "",
      "Cube3 Strength (MPa)": r.cube3_strength_mpa ?? "",
      "Avg Strength (MPa)": r.avg_strength_mpa ?? "",
      "Measured Strength (MPa)": r.measured_strength_mpa ?? "",
      "Required Strength (MPa)": r.required_strength_mpa ?? "",
      "Passed": r.passed === true ? "PASS" : r.passed === false ? "FAIL" : "PENDING",
      "Notes": r.notes ?? "",
      "Result": r.result,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QC Results");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `qc-results-project-${projectForResults}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const passPreview = useMemo<"pass" | "pending" | "fail" | null>(() => {
    if (!selected) return null;
    const req = selected.required_strength_mpa ?? selected.concrete_strength_mpa;
    const s1 = cube1Strength === "" ? null : Number(cube1Strength);
    const s2 = cube2Strength === "" ? null : Number(cube2Strength);
    const s3 = cube3Strength === "" ? null : Number(cube3Strength);
    if (req == null || s1 == null || s2 == null || s3 == null) return null;
    if ([s1, s2, s3].some((v) => Number.isNaN(v))) return null;
    const avg = (s1 + s2 + s3) / 3;
    if (avg >= req) return "pass";
    if (selected.age_days === 7) return "pending";
    return "fail";
  }, [cube1Strength, cube2Strength, cube3Strength, selected]);

  const avgPreview = useMemo(() => {
    const s1 = cube1Strength === "" ? null : Number(cube1Strength);
    const s2 = cube2Strength === "" ? null : Number(cube2Strength);
    const s3 = cube3Strength === "" ? null : Number(cube3Strength);
    if (s1 == null || s2 == null || s3 == null) return null;
    if ([s1, s2, s3].some((v) => Number.isNaN(v))) return null;
    return (s1 + s2 + s3) / 3;
  }, [cube1Strength, cube2Strength, cube3Strength]);

  const eligible = useMemo(() => {
    if (!selected) return false;
    // Hollowcore 1-day can be entered on cast day (hours-based in practice).
    if (ageDays === 1) return true;
    const t = toDateOnlyValue(testDate);
    const due = toDateOnlyValue(selected.due_date);
    if (t == null || due == null) return false;
    return t >= due;
  }, [selected, testDate, ageDays]);

  const submit = async () => {
    if (!selected) return;
    const w1 = cube1Weight === "" ? null : Number(cube1Weight);
    const w2 = cube2Weight === "" ? null : Number(cube2Weight);
    const w3 = cube3Weight === "" ? null : Number(cube3Weight);
    const s1 = cube1Strength === "" ? null : Number(cube1Strength);
    const s2 = cube2Strength === "" ? null : Number(cube2Strength);
    const s3 = cube3Strength === "" ? null : Number(cube3Strength);
    if ([w1, w2, w3, s1, s2, s3].some((v) => v == null || Number.isNaN(v as number))) {
      notify.warning("Please enter all 3 cube weights and strengths.");
      return;
    }
    if (!eligible) {
      notify.warning(`Too early. Earliest test date: ${selected.due_date}`);
      return;
    }

    try {
      setSaving(true);
      await api.post("/qc/tests", {
        element_id: selected.element_id,
        batch_id: selected.batch_id,
        age_days: ageDays,
        cube1_weight_kg: w1,
        cube1_strength_mpa: s1,
        cube2_weight_kg: w2,
        cube2_strength_mpa: s2,
        cube3_weight_kg: w3,
        cube3_strength_mpa: s3,
        test_date: testDate,
        notes: notes.trim() ? notes : null,
      });

      setCube1Weight("");
      setCube1Strength("");
      setCube2Weight("");
      setCube2Strength("");
      setCube3Weight("");
      setCube3Strength("");
      setNotes("");
      const mid = selected.mix_design_id;
      await Promise.all([
        qc.invalidateQueries({ queryKey: QC_QUEUE_KEY }),
        qc.invalidateQueries({ queryKey: qcTestsKey(selected.batch_id) }),
        mid != null ? qc.invalidateQueries({ queryKey: qcMixStatsKey(mid) }) : Promise.resolve(),
        resultsProjectId != null ? qc.invalidateQueries({ queryKey: qcProjectResultsKey(resultsProjectId) }) : Promise.resolve(),
      ]);
      notify.success("QC result saved.");
    } catch (e) {
      notify.error(
        (e as any)?.response?.data?.detail ||
          (e as any)?.response?.data?.message ||
          (e as any)?.message ||
          "Failed to save QC result."
      );
    } finally {
      setSaving(false);
    }
  };

  const pick = (item: QcDueItem) => {
    setSelected(item);
    setAgeDays(item.age_days);
    setTestDate(toLocalISODate());
    setCube1Weight("");
    setCube1Strength("");
    setCube2Weight("");
    setCube2Strength("");
    setCube3Weight("");
    setCube3Strength("");
    setNotes("");
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack>
          <Typography variant="h5">QC</Typography>
          <Typography variant="body2" color="text.secondary">
            Lab worklist — cubes due today and tomorrow.
          </Typography>
        </Stack>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Overdue (missed crushes)
              </Typography>
              {(due?.overdue?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing overdue.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {(due?.overdue ?? []).map((i) => (
                    <Button
                      key={`${i.batch_id}-${i.age_days}-${i.due_date}`}
                      color="error"
                      variant={
                        selected?.batch_id === i.batch_id &&
                        selected?.age_days === i.age_days &&
                        selected?.due_date === i.due_date
                          ? "contained"
                          : "outlined"
                      }
                      onClick={() => pick(i)}
                      sx={{ justifyContent: "flex-start" }}
                    >
                      {queueItemLabel(i, true)}
                    </Button>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Crush today ({due?.today_date ?? "..."})
              </Typography>
              {(due?.today?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing due today.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {due!.today.map((i) => (
                    <Button
                      key={`${i.batch_id}-${i.age_days}`}
                      color={i.is_retest ? "warning" : "primary"}
                      variant={selected?.batch_id === i.batch_id && selected?.age_days === i.age_days ? "contained" : "outlined"}
                      onClick={() => pick(i)}
                      sx={{ justifyContent: "flex-start" }}
                    >
                      {queueItemLabel(i)}
                    </Button>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Crush tomorrow ({due?.tomorrow_date ?? "..."})
              </Typography>
              {(due?.tomorrow?.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nothing due tomorrow.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {due!.tomorrow.map((i) => (
                    <Button
                      key={`${i.batch_id}-${i.age_days}`}
                      color={i.is_retest ? "warning" : "primary"}
                      variant={selected?.batch_id === i.batch_id && selected?.age_days === i.age_days ? "contained" : "outlined"}
                      onClick={() => pick(i)}
                      sx={{ justifyContent: "flex-start" }}
                    >
                      {queueItemLabel(i)}
                    </Button>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12}>
            {selected ? (
              <Alert severity="info">
                Selected: {selected.age_days}d • {selected.batch_id} • {selected.project_name} • {selected.element_type}{" "}
                {selected.element_mark} • req {(selected.required_strength_mpa ?? selected.concrete_strength_mpa) ?? "-"} MPa • earliest {selected.due_date}
                {selected.mix_design_name ? ` • mix: ${selected.mix_design_name}` : ""}
              </Alert>
            ) : (
              <Alert severity="warning">Pick a cube batch from Today/Tomorrow to enter results.</Alert>
            )}
          </Grid>
        </Grid>

        {mixStats && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Mix stats: {mixStats.mix_design_name ?? `Mix #${mixStats.mix_design_id}`}
              {mixStats.target_strength_mpa != null ? ` • target ${mixStats.target_strength_mpa} MPa` : ""}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  7-day
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  n={mixStats.age_7.n} • mean={mixStats.age_7.mean ?? "-"} • SD={mixStats.age_7.sd ?? "-"} • min=
                  {mixStats.age_7.min ?? "-"} • max={mixStats.age_7.max ?? "-"} • pass=
                  {mixStats.age_7.pass_rate != null ? `${Math.round(mixStats.age_7.pass_rate * 100)}%` : "-"}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  28-day
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  n={mixStats.age_28.n} • mean={mixStats.age_28.mean ?? "-"} • SD={mixStats.age_28.sd ?? "-"} • min=
                  {mixStats.age_28.min ?? "-"} • max={mixStats.age_28.max ?? "-"} • pass=
                  {mixStats.age_28.pass_rate != null ? `${Math.round(mixStats.age_28.pass_rate * 100)}%` : "-"}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Enter cube test result
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={2}>
              <TextField
                label="Age (days)"
                size="small"
                select
                fullWidth
                value={ageDays}
                onChange={(e) => setAgeDays(Number(e.target.value))}
                disabled
              >
                <MenuItem value={1}>1</MenuItem>
                <MenuItem value={7}>7</MenuItem>
                <MenuItem value={28}>28</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                label="Test date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                inputProps={selected ? { min: selected.due_date } : undefined}
                helperText={selected ? (ageDays === 1 ? "Earliest: same cast day (hours-based)" : `Earliest: ${selected.due_date}`) : ""}
              />
            </Grid>
            <Grid item xs={12} md={7.5}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Cube 1 weight (kg)"
                    size="small"
                    fullWidth
                    value={cube1Weight}
                    onChange={(e) => setCube1Weight(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                  <TextField
                    label="Cube 1 strength (MPa)"
                    size="small"
                    fullWidth
                    sx={{ mt: 1 }}
                    value={cube1Strength}
                    onChange={(e) => setCube1Strength(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Cube 2 weight (kg)"
                    size="small"
                    fullWidth
                    value={cube2Weight}
                    onChange={(e) => setCube2Weight(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                  <TextField
                    label="Cube 2 strength (MPa)"
                    size="small"
                    fullWidth
                    sx={{ mt: 1 }}
                    value={cube2Strength}
                    onChange={(e) => setCube2Strength(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Cube 3 weight (kg)"
                    size="small"
                    fullWidth
                    value={cube3Weight}
                    onChange={(e) => setCube3Weight(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                  <TextField
                    label="Cube 3 strength (MPa)"
                    size="small"
                    fullWidth
                    sx={{ mt: 1 }}
                    value={cube3Strength}
                    onChange={(e) => setCube3Strength(e.target.value)}
                    disabled={!selected || !eligible}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                label="Required (MPa)"
                size="small"
                fullWidth
                value={(selected?.required_strength_mpa ?? selected?.concrete_strength_mpa) ?? ""}
                disabled
              />
              <TextField
                label="Average (MPa)"
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                value={avgPreview != null ? avgPreview.toFixed(2) : ""}
                disabled
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Notes"
                size="small"
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!selected || !eligible}
              />
            </Grid>
            <Grid item xs={12}>
              {selected && passPreview != null && (
                <Alert
                  severity={passPreview === "pass" ? "success" : passPreview === "fail" ? "error" : "info"}
                  sx={{ mb: 1 }}
                >
                  {passPreview === "pass" && "PASS (auto-calculated vs required MPa)"}
                  {passPreview === "fail" && "FAIL (auto-calculated vs required MPa)"}
                  {passPreview === "pending" && "Below required MPa at 7 days (recorded as pending, not fail)."}
                </Alert>
              )}
              {!eligible && selected && ageDays !== 1 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Too early to capture results. You can only enter a {selected.age_days}-day result on/after {selected.due_date}.
                </Alert>
              )}
              <Button variant="contained" disabled={!selected || !eligible || saving} onClick={() => void submit()}>
                {saving ? "Saving..." : "Save result"}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Results for selected batch
          </Typography>
          {tests.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No results yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {tests.map((t) => (
                <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {t.test_type} • {t.test_date}
                    {t.age_days != null ? ` • ${t.age_days}d` : ""}
                  </Typography>
                  <Typography variant="body2">
                    Avg:{" "}
                    {t.avg_strength_mpa != null
                      ? `${t.avg_strength_mpa} MPa`
                      : t.measured_strength_mpa != null
                      ? `${t.measured_strength_mpa} MPa`
                      : t.result}
                    {t.required_strength_mpa != null ? ` (req ${t.required_strength_mpa} MPa)` : ""}
                    {t.passed === true ? " • PASS" : t.passed === false ? " • FAIL" : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cubes:{" "}
                    {(t.cube1_strength_mpa ?? "-") + " / " + (t.cube2_strength_mpa ?? "-") + " / " + (t.cube3_strength_mpa ?? "-")}
                    {" • Weights (kg): "}
                    {(t.cube1_weight_kg ?? "-") + " / " + (t.cube2_weight_kg ?? "-") + " / " + (t.cube3_weight_kg ?? "-")}
                  </Typography>
                  {t.notes ? (
                    <Typography variant="caption" color="text.secondary">
                      Notes: {t.notes}
                    </Typography>
                  ) : null}
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            QC results for project (view + export)
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
            <TextField
              label="Project"
              size="small"
              select
              value={projectForResults}
              onChange={(e) => {
                const next = e.target.value === "" ? "" : Number(e.target.value);
                setProjectForResults(next);
                setResultsProjectId(null);
              }}
              sx={{ minWidth: 260 }}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.project_name}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="outlined"
              onClick={() => {
                if (projectForResults === "") return;
                setResultsProjectId(Number(projectForResults));
              }}
              disabled={projectForResults === "" || projectResultsLoading}
            >
              {projectResultsLoading ? "Loading..." : "View results"}
            </Button>

            <Button
              variant="contained"
              onClick={() => exportProjectResultsToExcel()}
              disabled={projectResults.length === 0}
            >
              Export to Excel
            </Button>
          </Stack>

          {projectResultsLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading results...
            </Typography>
          ) : projectResults.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No QC results loaded for this project.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Test date</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Element</TableCell>
                  <TableCell align="right">Age</TableCell>
                  <TableCell align="right">Measured (MPa)</TableCell>
                  <TableCell align="right">Required (MPa)</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.test_date}</TableCell>
                    <TableCell>{r.batch_id ?? ""}</TableCell>
                    <TableCell>
                      {r.element_mark} ({r.element_type})
                    </TableCell>
                    <TableCell align="right">{r.age_days ?? ""}</TableCell>
                    <TableCell align="right">{r.measured_strength_mpa ?? ""}</TableCell>
                    <TableCell align="right">{r.required_strength_mpa ?? ""}</TableCell>
                    <TableCell>
                      {r.passed === true ? "PASS" : r.passed === false ? "FAIL" : "PENDING"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Paper>
  );
}

