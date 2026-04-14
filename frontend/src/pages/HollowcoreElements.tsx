import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  Grid,
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
} from "@mui/material";
import api from "../api/client";
import type { Element, ElementCreate, ElementUpdate } from "../types/api";
import { ELEMENTS_ALL_KEY, ELEMENTS_PREFAB_LIST_KEY, PROJECTS_OPTIONS_KEY, fetchProjectsOptions } from "./elementsQuery";
import {
  HOLLOWCORE_CASTS_REGISTRY_KEY,
  HOLLOWCORE_ELEMENTS_HC_KEY,
  fetchHollowcoreCastsRegistry,
  fetchHollowcoreElementsList,
} from "./hollowcoreQuery";

function formatError(err: unknown, fallback: string) {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    fallback
  );
}

export default function HollowcoreElements() {
  const qc = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: HOLLOWCORE_ELEMENTS_HC_KEY,
    queryFn: fetchHollowcoreElementsList,
  });

  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });

  const castsRegistryQuery = useQuery({
    queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY,
    queryFn: fetchHollowcoreCastsRegistry,
  });

  const items = itemsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const invalidateHc = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: HOLLOWCORE_ELEMENTS_HC_KEY }),
      qc.invalidateQueries({ queryKey: HOLLOWCORE_CASTS_REGISTRY_KEY }),
      qc.invalidateQueries({ queryKey: ELEMENTS_ALL_KEY }),
      qc.invalidateQueries({ queryKey: ELEMENTS_PREFAB_LIST_KEY }),
    ]);

  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ElementUpdate>({});

  const [form, setForm] = useState<ElementCreate>({
    project_id: 0,
    mix_design_id: null,
    element_type: "Hollowcore",
    element_mark: "",
    quantity: 0,
    volume: null,
    due_date: null,
    concrete_strength_mpa: 30,
    requires_cubes: false,
    status: "planned",
    allowed_mould_ids: [],
    panel_length_mm: 6000,
    slab_thickness_mm: 150,
  });

  const autoStageByElementId = useMemo(() => {
    const data = castsRegistryQuery.data ?? [];
    const byElement: Record<number, { planned: number; cast: number; completed: number }> = {};
    for (const row of data) {
      const id = Number(row.element_id);
      if (!Number.isFinite(id)) continue;
      const qty = Number(row.quantity ?? 0);
      const st = String(row.status ?? "planned");
      if (!byElement[id]) byElement[id] = { planned: 0, cast: 0, completed: 0 };
      if (st === "completed") byElement[id].completed += qty;
      else if (st === "cast") byElement[id].cast += qty;
      else byElement[id].planned += qty;
    }
    const next: Record<number, string> = {};
    for (const el of items) {
      const row = byElement[el.id];
      if (!row) {
        next[el.id] = "not_started";
        continue;
      }
      const targetQty = Number(el.quantity ?? 0);
      if (row.completed >= targetQty && targetQty > 0) next[el.id] = "completed";
      else if (row.cast + row.completed > 0) next[el.id] = "cast";
      else next[el.id] = "planned";
    }
    return next;
  }, [items, castsRegistryQuery.data]);

  const totals = useMemo(() => {
    const completedByElementId: Record<number, number> = {};
    for (const row of castsRegistryQuery.data ?? []) {
      const elementId = Number(row.element_id);
      if (!Number.isFinite(elementId)) continue;
      if (String(row.status ?? "planned") !== "completed") continue;
      const qty = Number(row.quantity ?? 0);
      completedByElementId[elementId] = (completedByElementId[elementId] ?? 0) + qty;
    }

    return items.reduce(
      (acc, el) => {
        const plannedQty = Number(el.quantity ?? 0);
        const completedQty = Number(completedByElementId[el.id] ?? 0);
        acc.completed += completedQty;
        acc.remaining += Math.max(plannedQty - completedQty, 0);
        return acc;
      },
      { completed: 0, remaining: 0 }
    );
  }, [items, castsRegistryQuery.data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => {
      if (
        name === "project_id" ||
        name === "quantity" ||
        name === "panel_length_mm" ||
        name === "slab_thickness_mm"
      ) {
        return { ...f, [name]: value === "" ? 0 : Number(value) };
      }
      if (name === "due_date") return { ...f, due_date: value === "" ? null : value };
      return { ...f, [name]: value };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await api.post("/elements/", form);
      setShowAdd(false);
      setForm((f) => ({ ...f, element_mark: "", quantity: 0 }));
      await invalidateHc();
    } catch (ex) {
      console.error(ex);
      setErr("Failed to create hollowcore element");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (el: Element) => {
    setEditingId(el.id);
    setEditForm({
      element_mark: el.element_mark,
      due_date: el.due_date,
      quantity: el.quantity,
      panel_length_mm: el.panel_length_mm ?? null,
      slab_thickness_mm: el.slab_thickness_mm ?? null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((f) => {
      if (name === "quantity" || name === "panel_length_mm" || name === "slab_thickness_mm") {
        return { ...f, [name]: value === "" ? null : Number(value) };
      }
      if (name === "due_date") return { ...f, due_date: value === "" ? null : value };
      return { ...f, [name]: value };
    });
  };

  const saveEdit = async (id: number) => {
    setLoading(true);
    setErr(null);
    try {
      await api.put(`/elements/${id}`, editForm);
      await invalidateHc();
      cancelEdit();
    } catch (e) {
      console.error(e);
      setErr("Failed to update hollowcore element");
    } finally {
      setLoading(false);
    }
  };

  const deleteElement = async (id: number) => {
    if (!window.confirm("Delete this hollowcore element?")) return;
    setLoading(true);
    setErr(null);
    try {
      await api.delete(`/elements/${id}`);
      await invalidateHc();
      if (editingId === id) cancelEdit();
    } catch (e) {
      console.error(e);
      setErr(formatError(e, "Failed to delete hollowcore element"));
    } finally {
      setLoading(false);
    }
  };

  const archive = async (id: number) => {
    if (!window.confirm("Archive this hollowcore element?")) return;
    setLoading(true);
    setErr(null);
    try {
      await api.post(`/elements/${id}/archive`);
      await invalidateHc();
    } catch (e) {
      console.error(e);
      setErr(formatError(e, "Failed to archive element"));
    } finally {
      setLoading(false);
    }
  };

  const unarchive = async (id: number) => {
    setLoading(true);
    setErr(null);
    try {
      await api.post(`/elements/${id}/unarchive`);
      await invalidateHc();
    } catch (e) {
      console.error(e);
      setErr(formatError(e, "Failed to unarchive element"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} spacing={1}>
        <Grid item>
          <Typography variant="h5">Hollowcore Elements</Typography>
        </Grid>
        <Grid item>
          <Button
            variant={showAdd ? "outlined" : "contained"}
            onClick={() => {
              setShowAdd((v) => !v);
              setErr(null);
            }}
          >
            {showAdd ? "Cancel" : "Add hollowcore element"}
          </Button>
        </Grid>
      </Grid>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : null}
      {itemsQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load hollowcore elements.
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip color="success" label={`Finished: ${totals.completed}`} />
        <Chip color="warning" label={`Still planned: ${totals.remaining}`} />
      </Stack>

      {showAdd ? (
        <form onSubmit={submit}>
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Project"
                name="project_id"
                size="small"
                select
                fullWidth
                value={form.project_id || ""}
                onChange={handleChange}
              >
                <MenuItem value="">Select project…</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.project_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label="Element mark"
                name="element_mark"
                size="small"
                fullWidth
                value={form.element_mark}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                label="Due date"
                name="due_date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={form.due_date ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                label="Qty"
                name="quantity"
                size="small"
                type="number"
                fullWidth
                value={form.quantity || ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.8}>
              <TextField
                label="Panel length (mm)"
                name="panel_length_mm"
                size="small"
                type="number"
                fullWidth
                value={form.panel_length_mm ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.8}>
              <TextField
                label="Slab thickness (mm)"
                name="slab_thickness_mm"
                size="small"
                type="number"
                fullWidth
                value={form.slab_thickness_mm ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.2}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ height: 40 }}
                disabled={
                  loading ||
                  !form.project_id ||
                  !form.element_mark.trim() ||
                  !form.quantity ||
                  !form.panel_length_mm ||
                  !form.slab_thickness_mm
                }
              >
                Add
              </Button>
            </Grid>
          </Grid>
        </form>
      ) : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Reference</TableCell>
            <TableCell>Project</TableCell>
            <TableCell>Due</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Panel length (mm)</TableCell>
            <TableCell align="right">Thickness (mm)</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Stage (automatic)</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    name="element_mark"
                    value={(editForm.element_mark as string | undefined) ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  e.element_mark || "—"
                )}
              </TableCell>
              <TableCell>
                {projects.find((p) => p.id === e.project_id)?.project_name ?? `Project #${e.project_id}`}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    type="date"
                    name="due_date"
                    InputLabelProps={{ shrink: true }}
                    value={(editForm.due_date as string | null | undefined) ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  e.due_date ?? "—"
                )}
              </TableCell>
              <TableCell align="right">
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    type="number"
                    name="quantity"
                    value={(editForm.quantity as number | undefined) ?? 0}
                    onChange={handleEditChange}
                    sx={{ maxWidth: 120 }}
                  />
                ) : (
                  e.quantity ?? 0
                )}
              </TableCell>
              <TableCell align="right">
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    type="number"
                    name="panel_length_mm"
                    value={(editForm.panel_length_mm as number | null | undefined) ?? ""}
                    onChange={handleEditChange}
                    sx={{ maxWidth: 160 }}
                  />
                ) : (
                  e.panel_length_mm ?? "—"
                )}
              </TableCell>
              <TableCell align="right">
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    type="number"
                    name="slab_thickness_mm"
                    value={(editForm.slab_thickness_mm as number | null | undefined) ?? ""}
                    onChange={handleEditChange}
                    sx={{ maxWidth: 160 }}
                  />
                ) : (
                  e.slab_thickness_mm ?? "—"
                )}
              </TableCell>
              <TableCell>{e.active === false ? "No" : "Yes"}</TableCell>
              <TableCell>
                {autoStageByElementId[e.id] ?? "not_started"}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <>
                    <Button size="small" onClick={() => saveEdit(e.id)} disabled={loading}>
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit} disabled={loading}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => startEdit(e)} disabled={loading}>
                      Edit
                    </Button>
                    {e.active === false ? (
                      <Button size="small" onClick={() => unarchive(e.id)} disabled={loading}>
                        Unarchive
                      </Button>
                    ) : (
                      <Button size="small" onClick={() => archive(e.id)} disabled={loading}>
                        Archive
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => deleteElement(e.id)} disabled={loading}>
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

