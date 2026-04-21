// File overview: Page component and UI logic for pages/MixDesigns.tsx.
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Checkbox,
  FormControlLabel,
  Grid,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/client";

import type { MixDesign, MixDesignCreate, MixDesignUpdate } from "../types/api";

type MixStat = { n: number; mean: number | null; sd: number | null; min: number | null; max: number | null; pass_rate: number | null };
type MixAnalysisCard = {
  mix_design_id: number;
  mix_design_name: string;
  target_strength_mpa: number | null;
  active: boolean;
  age_1: MixStat;
  age_7: MixStat;
  age_28: MixStat;
  age_28_margin_mpa: number | null;
};
type MixAnalysisTrendRow = {
  week: string;
  mix_design_id: number;
  mix_design_name: string;
  avg_strength_1_mpa: number | null;
  avg_strength_7_mpa: number | null;
  avg_strength_28_mpa: number | null;
  target_strength_mpa: number | null;
  margin_28_mpa: number | null;
  samples_1: number;
  samples_7: number;
  samples_28: number;
  pass_rate_28: number | null;
};
type MixCorrelationRow = {
  mix_design_id: number;
  mix_design_name: string;
  batch_id: string;
  strength_7_mpa: number;
  strength_28_mpa: number;
};
type MixAnalysisResponse = {
  weeks: number;
  mixes: MixAnalysisCard[];
  trend: MixAnalysisTrendRow[];
  correlation_7_to_28: MixCorrelationRow[];
};

// Inputs: caller state/arguments related to mix designs.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function MixDesigns() {
  const [items, setItems] = useState<MixDesign[]>([]);
  const [form, setForm] = useState<MixDesignCreate>({ name: "", target_strength_mpa: null, active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MixDesignUpdate>({});
  const [showAddMixDesign, setShowAddMixDesign] = useState(false);
  const [analysis, setAnalysis] = useState<MixAnalysisResponse | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedMixId, setSelectedMixId] = useState<number | "">("");

  const load = async () => {
    const { data } = await api.get<MixDesign[]>("/mix-designs");
    setItems(data);
  };

  const loadAnalysis = async () => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const { data } = await api.get<MixAnalysisResponse>("/mix-designs/analysis/data", { params: { weeks: 12 } });
      setAnalysis(data);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || err?.message || "Failed to load mix analysis");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
    loadAnalysis().catch(console.error);
  }, []);

  useEffect(() => {
    if (!analysis) return;
    const availableIds = analysis.mixes.map((m) => m.mix_design_id);
    setSelectedMixId((prev) => {
      if (prev !== "" && availableIds.includes(prev)) return prev;
      return availableIds.length > 0 ? availableIds[0] : "";
    });
  }, [analysis]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      if (name === "target_strength_mpa") return { ...f, target_strength_mpa: value === "" ? null : Number(value) };
      if (name === "active") return { ...f, active: type === "checkbox" ? checked : Boolean(value) };
      return { ...f, [name]: value };
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditForm((f) => {
      if (name === "target_strength_mpa") return { ...f, target_strength_mpa: value === "" ? null : Number(value) };
      if (name === "active") return { ...f, active: type === "checkbox" ? checked : Boolean(value) };
      return { ...f, [name]: value };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/mix-designs", form);
    setForm({ name: "", target_strength_mpa: null, active: true });
    await load();
    await loadAnalysis();
    setShowAddMixDesign(false);
  };

  const startEdit = (m: MixDesign) => {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      target_strength_mpa: m.target_strength_mpa,
      active: m.active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const save = async (id: number) => {
    await api.put(`/mix-designs/${id}`, editForm);
    await load();
    await loadAnalysis();
    cancelEdit();
  };

  const del = async (id: number) => {
    if (!window.confirm("Delete this mix design?")) return;
    await api.delete(`/mix-designs/${id}`);
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
    await loadAnalysis();
  };

  const selectedMix = useMemo(
    () => (analysis?.mixes ?? []).find((m) => m.mix_design_id === selectedMixId) ?? null,
    [analysis, selectedMixId]
  );

  const compareData = useMemo(() => {
    if (!selectedMix) return [];
    return [
      {
        name: selectedMix.mix_design_name,
        target: selectedMix.target_strength_mpa,
        avg28: selectedMix.age_28.mean,
        avg7: selectedMix.age_7.mean,
        margin28: selectedMix.age_28_margin_mpa,
      },
    ];
  }, [selectedMix]);

  const trendData = useMemo(() => {
    if (!analysis || selectedMixId === "") return [];
    const grouped: Record<string, Record<string, number | string | null>> = {};
    for (const row of analysis.trend) {
      if (row.mix_design_id !== selectedMixId) continue;
      if (!grouped[row.week]) grouped[row.week] = { week: row.week };
      grouped[row.week].avg1 = row.avg_strength_1_mpa;
      grouped[row.week].avg7 = row.avg_strength_7_mpa;
      grouped[row.week].avg28 = row.avg_strength_28_mpa;
      grouped[row.week].pass28 = row.pass_rate_28 != null ? Math.round(row.pass_rate_28 * 100) : null;
    }
    return Object.values(grouped);
  }, [analysis, selectedMixId]);

  const correlationPoints = useMemo(
    () =>
      (analysis?.correlation_7_to_28 ?? [])
        .filter((r) => r.mix_design_id === selectedMixId)
        .map((r) => ({ x: r.strength_7_mpa, y: r.strength_28_mpa, batch_id: r.batch_id })),
    [analysis, selectedMixId]
  );

  const regression = useMemo(() => {
    const pts = correlationPoints;
    const minPairs = 6;
    if (pts.length < minPairs) return { enabled: false as const, minPairs, n: pts.length };

    const n = pts.length;
    const sumX = pts.reduce((a, p) => a + p.x, 0);
    const sumY = pts.reduce((a, p) => a + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of pts) {
      const dx = p.x - meanX;
      const dy = p.y - meanY;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    if (sxx <= 0 || syy <= 0) return { enabled: false as const, minPairs, n: pts.length };

    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const r2 = (sxy * sxy) / (sxx * syy);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const line = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
    return { enabled: true as const, minPairs, n, slope, intercept, r2, line };
  }, [correlationPoints]);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5">Mix Designs</Typography>
        <Button
          variant={showAddMixDesign ? "outlined" : "contained"}
          onClick={() => {
            if (showAddMixDesign) {
              setShowAddMixDesign(false);
              setForm({ name: "", target_strength_mpa: null, active: true });
            } else {
              setShowAddMixDesign(true);
            }
          }}
        >
          {showAddMixDesign ? "Cancel" : "Add mix design"}
        </Button>
      </Stack>

      {showAddMixDesign ? (
        <form onSubmit={submit}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
            <TextField label="Name" name="name" size="small" value={form.name} onChange={handleChange} />
            <TextField
              label="Target strength (MPa)"
              name="target_strength_mpa"
              size="small"
              value={form.target_strength_mpa ?? ""}
              onChange={handleChange}
            />
            <FormControlLabel
              control={<Checkbox name="active" checked={Boolean(form.active)} onChange={handleChange} />}
              label="Active"
            />
            <Button type="submit" variant="contained" disabled={!form.name.trim()}>
              Save mix design
            </Button>
          </Stack>
        </form>
      ) : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Target MPa</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.id}</TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField size="small" name="name" value={editForm.name ?? ""} onChange={handleEditChange} />
                ) : (
                  m.name
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="target_strength_mpa"
                    value={editForm.target_strength_mpa ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  m.target_strength_mpa ?? "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <Checkbox name="active" checked={Boolean(editForm.active)} onChange={handleEditChange} />
                ) : m.active ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <>
                    <Button size="small" onClick={() => save(m.id)}>
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => startEdit(m)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => del(m.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
          <Typography variant="h6">Mix Performance Analysis</Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              select
              label="Mix design"
              value={selectedMixId}
              onChange={(e) => setSelectedMixId(e.target.value === "" ? "" : Number(e.target.value))}
              sx={{ minWidth: 240 }}
            >
              {(analysis?.mixes ?? []).map((m) => (
                <MenuItem key={`mix-select-${m.mix_design_id}`} value={m.mix_design_id}>
                  {m.mix_design_name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={() => void loadAnalysis()} disabled={loadingAnalysis}>
              {loadingAnalysis ? "Refreshing..." : "Refresh analysis"}
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Analyze one selected mix design at a time with weekly strength trends and pass-rate movement.
        </Typography>
        {analysisError ? (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {analysisError}
          </Typography>
        ) : null}

        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              <TableCell align="right">1d</TableCell>
              <TableCell align="right">7d</TableCell>
              <TableCell align="right">28d</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedMix ? (
              <>
                <TableRow key="metric-target">
                  <TableCell>Target MPa</TableCell>
                  <TableCell align="right">{selectedMix.target_strength_mpa ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.target_strength_mpa ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.target_strength_mpa ?? "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-n">
                  <TableCell>Sample count (n)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.n}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.n}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.n}</TableCell>
                </TableRow>
                <TableRow key="metric-mean">
                  <TableCell>Mean (MPa)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.mean ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.mean ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.mean ?? "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-sd">
                  <TableCell>SD (MPa)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.sd ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.sd ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.sd ?? "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-min">
                  <TableCell>Min (MPa)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.min ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.min ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.min ?? "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-max">
                  <TableCell>Max (MPa)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.max ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.max ?? "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.max ?? "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-pass">
                  <TableCell>Pass rate (%)</TableCell>
                  <TableCell align="right">{selectedMix.age_1.pass_rate != null ? `${Math.round(selectedMix.age_1.pass_rate * 100)}%` : "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_7.pass_rate != null ? `${Math.round(selectedMix.age_7.pass_rate * 100)}%` : "-"}</TableCell>
                  <TableCell align="right">{selectedMix.age_28.pass_rate != null ? `${Math.round(selectedMix.age_28.pass_rate * 100)}%` : "-"}</TableCell>
                </TableRow>
                <TableRow key="metric-margin">
                  <TableCell>28d margin to target (MPa)</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">{selectedMix.age_28_margin_mpa != null ? selectedMix.age_28_margin_mpa.toFixed(2) : "-"}</TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No mix selected.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                28-day Mean vs Target
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="target" name="Target MPa" fill="#9e9e9e" />
                  <Bar dataKey="avg28" name="28d mean MPa" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                28-day Margin to Target
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="margin28" name="Margin MPa" fill="#43a047" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Weekly 28-day Strength Trend
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avg28" name="28d MPa" stroke="#1976d2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Weekly Strength Trend (1d / 7d / 28d)
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avg1" name="1d MPa" stroke="#ef6c00" dot={false} />
                  <Line type="monotone" dataKey="avg7" name="7d MPa" stroke="#1976d2" dot={false} />
                  <Line type="monotone" dataKey="avg28" name="28d MPa" stroke="#2e7d32" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 320 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Weekly 28-day Pass Rate Trend (%)
              </Typography>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pass28" name="Pass %" stroke="#2e7d32" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 1.5, height: 360 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                7-day to 28-day Correlation (per batch)
              </Typography>
              {regression.enabled ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Best fit: 28d = {regression.slope.toFixed(3)} * 7d + {regression.intercept.toFixed(3)} | R² ={" "}
                  {regression.r2.toFixed(3)} (n={regression.n})
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Trendline shown from {regression.minPairs}+ paired batches. Current pairs: {regression.n}.
                </Typography>
              )}
              <ResponsiveContainer width="100%" height="90%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="7d MPa">
                    <Label value="7d MPa" position="insideBottom" offset={-8} />
                  </XAxis>
                  <YAxis type="number" dataKey="y" name="28d MPa">
                    <Label value="28d MPa" angle={-90} position="insideLeft" />
                  </YAxis>
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend />
                  <Scatter
                    name="Batches"
                    data={correlationPoints}
                    fill="#1565c0"
                  />
                  {regression.enabled ? (
                    <Line
                      type="linear"
                      data={regression.line}
                      dataKey="y"
                      name="Best-fit line"
                      stroke="#d32f2f"
                      dot={false}
                      legendType="line"
                    />
                  ) : null}
                </ScatterChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
      </Stack>
    </Paper>
  );
}

