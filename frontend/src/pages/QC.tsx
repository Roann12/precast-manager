// File overview: Page component and UI logic for pages/QC.tsx.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

const format3Decimals = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? "" : value.toFixed(3);

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

  const pendingResultsQuery = useQuery({
    queryKey: ["qc", "results", "pending-outcomes"],
    queryFn: () => fetchQcProjectResults(undefined),
  });
  const pendingResults = useMemo(() => {
    const todayIso = toLocalISODate();
    return ((pendingResultsQuery.data ?? []) as QcProjectResultRow[]).filter((r) => {
      const rowDate = String(r.test_date ?? "").slice(0, 10);
      return r.passed == null && rowDate !== "" && rowDate <= todayIso;
    });
  }, [pendingResultsQuery.data]);

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<QcProjectResultRow | null>(null);
  const [editCube1Weight, setEditCube1Weight] = useState<string>("");
  const [editCube1Strength, setEditCube1Strength] = useState<string>("");
  const [editCube2Weight, setEditCube2Weight] = useState<string>("");
  const [editCube2Strength, setEditCube2Strength] = useState<string>("");
  const [editCube3Weight, setEditCube3Weight] = useState<string>("");
  const [editCube3Strength, setEditCube3Strength] = useState<string>("");
  const [editTestDate, setEditTestDate] = useState<string>(toLocalISODate());
  const [editNotes, setEditNotes] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);

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

  const editAvgPreview = useMemo(() => {
    const s1 = editCube1Strength === "" ? null : Number(editCube1Strength);
    const s2 = editCube2Strength === "" ? null : Number(editCube2Strength);
    const s3 = editCube3Strength === "" ? null : Number(editCube3Strength);
    if (s1 == null || s2 == null || s3 == null) return null;
    if ([s1, s2, s3].some((v) => Number.isNaN(v))) return null;
    return (s1 + s2 + s3) / 3;
  }, [editCube1Strength, editCube2Strength, editCube3Strength]);

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
        qc.invalidateQueries({ queryKey: ["qc", "results", "pending-outcomes"] }),
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

  const loadTestForEdit = (test: QualityTestRow) => {
    const row = test as QcProjectResultRow;
    setEditingRow(row);
    setEditTestDate(String(row.test_date).slice(0, 10));
    setEditCube1Weight(row.cube1_weight_kg != null ? String(row.cube1_weight_kg) : "");
    setEditCube1Strength(row.cube1_strength_mpa != null ? String(row.cube1_strength_mpa) : "");
    setEditCube2Weight(row.cube2_weight_kg != null ? String(row.cube2_weight_kg) : "");
    setEditCube2Strength(row.cube2_strength_mpa != null ? String(row.cube2_strength_mpa) : "");
    setEditCube3Weight(row.cube3_weight_kg != null ? String(row.cube3_weight_kg) : "");
    setEditCube3Strength(row.cube3_strength_mpa != null ? String(row.cube3_strength_mpa) : "");
    setEditNotes(row.notes ?? "");
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingRow(null);
    setEditCube1Weight("");
    setEditCube1Strength("");
    setEditCube2Weight("");
    setEditCube2Strength("");
    setEditCube3Weight("");
    setEditCube3Strength("");
    setEditNotes("");
  };

  const submitEdit = async () => {
    if (!editingRow) return;
    const w1 = editCube1Weight === "" ? null : Number(editCube1Weight);
    const w2 = editCube2Weight === "" ? null : Number(editCube2Weight);
    const w3 = editCube3Weight === "" ? null : Number(editCube3Weight);
    const s1 = editCube1Strength === "" ? null : Number(editCube1Strength);
    const s2 = editCube2Strength === "" ? null : Number(editCube2Strength);
    const s3 = editCube3Strength === "" ? null : Number(editCube3Strength);
    if ([w1, w2, w3, s1, s2, s3].some((v) => v == null || Number.isNaN(v as number))) {
      notify.warning("Please enter all 3 cube weights and strengths.");
      return;
    }
    try {
      setEditSaving(true);
      await api.patch(`/qc/tests/${editingRow.id}`, {
        cube1_weight_kg: w1,
        cube1_strength_mpa: s1,
        cube2_weight_kg: w2,
        cube2_strength_mpa: s2,
        cube3_weight_kg: w3,
        cube3_strength_mpa: s3,
        test_date: editTestDate,
        notes: editNotes.trim() ? editNotes : null,
      });
      await Promise.all([
        resultsProjectId != null ? qc.invalidateQueries({ queryKey: qcProjectResultsKey(resultsProjectId) }) : Promise.resolve(),
        editingRow.batch_id ? qc.invalidateQueries({ queryKey: qcTestsKey(editingRow.batch_id) }) : Promise.resolve(),
        qc.invalidateQueries({ queryKey: ["qc", "results", "pending-outcomes"] }),
      ]);
      notify.success("QC result updated.");
      closeEditDialog();
    } catch (e) {
      notify.error(
        (e as any)?.response?.data?.detail ||
          (e as any)?.response?.data?.message ||
          (e as any)?.message ||
          "Failed to update QC result."
      );
    } finally {
      setEditSaving(false);
    }
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

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Pending outcomes (not failed at 7-day)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            These are recorded tests with no final PASS/FAIL yet (for example, 7-day results below required strength).
          </Typography>
          {pendingResultsQuery.isFetching ? (
            <Typography variant="body2" color="text.secondary">
              Loading pending outcomes...
            </Typography>
          ) : pendingResults.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No pending outcomes.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Test date</TableCell>
                  <TableCell>Batch</TableCell>
                  <TableCell>Project</TableCell>
                  <TableCell>Element</TableCell>
                  <TableCell align="right">Age</TableCell>
                  <TableCell align="right">Measured (MPa)</TableCell>
                  <TableCell align="right">Required (MPa)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingResults.map((r) => (
                  <TableRow key={`pending-${r.id}`}>
                    <TableCell>{String(r.test_date).slice(0, 10)}</TableCell>
                    <TableCell>{r.batch_id ?? ""}</TableCell>
                    <TableCell>{r.project_name}</TableCell>
                    <TableCell>
                      {r.element_mark} ({r.element_type})
                    </TableCell>
                    <TableCell align="right">{r.age_days ?? ""}</TableCell>
                    <TableCell align="right">{format3Decimals(r.measured_strength_mpa)}</TableCell>
                    <TableCell align="right">{format3Decimals(r.required_strength_mpa)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>

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
                value={avgPreview != null ? avgPreview.toFixed(3) : ""}
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
                      ? `${format3Decimals(t.avg_strength_mpa)} MPa`
                      : t.measured_strength_mpa != null
                      ? `${format3Decimals(t.measured_strength_mpa)} MPa`
                      : t.result}
                    {t.required_strength_mpa != null ? ` (req ${format3Decimals(t.required_strength_mpa)} MPa)` : ""}
                    {t.passed === true ? " • PASS" : t.passed === false ? " • FAIL" : ""}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cubes:{" "}
                    {(t.cube1_strength_mpa != null ? format3Decimals(t.cube1_strength_mpa) : "-") +
                      " / " +
                      (t.cube2_strength_mpa != null ? format3Decimals(t.cube2_strength_mpa) : "-") +
                      " / " +
                      (t.cube3_strength_mpa != null ? format3Decimals(t.cube3_strength_mpa) : "-")}
                    {" • Weights (kg): "}
                    {(t.cube1_weight_kg != null ? format3Decimals(t.cube1_weight_kg) : "-") +
                      " / " +
                      (t.cube2_weight_kg != null ? format3Decimals(t.cube2_weight_kg) : "-") +
                      " / " +
                      (t.cube3_weight_kg != null ? format3Decimals(t.cube3_weight_kg) : "-")}
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
                  <TableCell align="right">Action</TableCell>
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
                    <TableCell align="right">{format3Decimals(r.measured_strength_mpa)}</TableCell>
                    <TableCell align="right">{format3Decimals(r.required_strength_mpa)}</TableCell>
                    <TableCell>
                      {r.passed === true ? "PASS" : r.passed === false ? "FAIL" : "PENDING"}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => loadTestForEdit(r)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>

        <Dialog open={editDialogOpen} onClose={editSaving ? undefined : closeEditDialog} fullWidth maxWidth="md">
          <DialogTitle>Edit QC result</DialogTitle>
          <DialogContent dividers>
            {editingRow ? (
              <Stack spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {editingRow.test_date} • {editingRow.batch_id ?? ""} • {editingRow.element_mark} ({editingRow.element_type}) •{" "}
                  {editingRow.age_days ?? "-"}d
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Test date"
                      type="date"
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={editTestDate}
                      onChange={(e) => setEditTestDate(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Required (MPa)"
                      size="small"
                      fullWidth
                      value={format3Decimals(editingRow.required_strength_mpa)}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Average (MPa)"
                      size="small"
                      fullWidth
                      value={editAvgPreview != null ? editAvgPreview.toFixed(3) : ""}
                      disabled
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Cube 1 weight (kg)"
                      size="small"
                      fullWidth
                      value={editCube1Weight}
                      onChange={(e) => setEditCube1Weight(e.target.value)}
                    />
                    <TextField
                      label="Cube 1 strength (MPa)"
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      value={editCube1Strength}
                      onChange={(e) => setEditCube1Strength(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Cube 2 weight (kg)"
                      size="small"
                      fullWidth
                      value={editCube2Weight}
                      onChange={(e) => setEditCube2Weight(e.target.value)}
                    />
                    <TextField
                      label="Cube 2 strength (MPa)"
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      value={editCube2Strength}
                      onChange={(e) => setEditCube2Strength(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Cube 3 weight (kg)"
                      size="small"
                      fullWidth
                      value={editCube3Weight}
                      onChange={(e) => setEditCube3Weight(e.target.value)}
                    />
                    <TextField
                      label="Cube 3 strength (MPa)"
                      size="small"
                      fullWidth
                      sx={{ mt: 1 }}
                      value={editCube3Strength}
                      onChange={(e) => setEditCube3Strength(e.target.value)}
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="Notes"
                  size="small"
                  fullWidth
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </Stack>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditDialog} color="inherit" disabled={editSaving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void submitEdit()} disabled={editSaving || !editingRow}>
              {editSaving ? "Updating..." : "Update result"}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Paper>
  );
}

