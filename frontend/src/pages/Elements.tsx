// File overview: Page component and UI logic for pages/Elements.tsx.
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  MenuItem,
  Grid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  ListItemText,
  FormControlLabel,
  Chip,
  Stack,
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import api from "../api/client";
import type { Element, ElementCreate, ElementUpdate } from "../types/api";
import { ELEMENT_TYPES } from "../constants/options";
import WetcastingActivityFeed from "../components/WetcastingActivityFeed";
import {
  ELEMENTS_ALL_KEY,
  ELEMENTS_PREFAB_LIST_KEY,
  MIX_DESIGNS_ACTIVE_KEY,
  MOULDS_LIST_KEY,
  PROJECTS_OPTIONS_KEY,
  fetchActiveMixDesigns,
  fetchElementsPrefabPage,
  fetchMouldsList,
  fetchProjectsOptions,
} from "./elementsQuery";
import { useNotify } from "../notifications/NotifyContext";

// Inputs: caller state/arguments related to elements.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Elements() {
  const notify = useNotify();
  const qc = useQueryClient();

  const elementsQuery = useQuery({
    queryKey: ELEMENTS_PREFAB_LIST_KEY,
    queryFn: fetchElementsPrefabPage,
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

  const mixDesignsQuery = useQuery({
    queryKey: MIX_DESIGNS_ACTIVE_KEY,
    queryFn: fetchActiveMixDesigns,
    staleTime: 60_000,
  });

  const items = elementsQuery.data?.items ?? [];
  const progressByElementId = elementsQuery.data?.progressByElementId ?? {};
  const projects = projectsQuery.data ?? [];
  const moulds = mouldsQuery.data ?? [];
  const mixDesigns = mixDesignsQuery.data ?? [];

  const pageLoading =
    elementsQuery.isPending || projectsQuery.isPending || mouldsQuery.isPending || mixDesignsQuery.isPending;

  const refetchingElements = elementsQuery.isFetching && !elementsQuery.isPending;

  const invalidateElements = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ELEMENTS_PREFAB_LIST_KEY }),
      qc.invalidateQueries({ queryKey: ELEMENTS_ALL_KEY }),
    ]);

  const editingIdRef = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ElementUpdate>({});
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [showAddElement, setShowAddElement] = useState(false);
  const [form, setForm] = useState<ElementCreate>({
    project_id: 0,
    mix_design_id: null,
    element_type: "",
    element_mark: "",
    quantity: 0,
    volume: null,
    due_date: null,
    concrete_strength_mpa: 30,
    requires_cubes: false,
    allowed_mould_ids: [],
  });
  const [mouldDialogOpen, setMouldDialogOpen] = useState(false);
  const [mouldDialogElementId, setMouldDialogElementId] = useState<number | null>(null);
  const [mouldDialogSelected, setMouldDialogSelected] = useState<number[]>([]);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  const updateElementMutation = useMutation({
    mutationFn: async (vars: { id: number; body: ElementUpdate }) => {
      await api.put(`/elements/${vars.id}`, vars.body);
    },
    onSuccess: async () => {
      await invalidateElements();
    },
  });

  const deleteElementMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/elements/${id}`);
    },
    onSuccess: async (_, id) => {
      await invalidateElements();
      if (editingIdRef.current === id) {
        setEditingId(null);
        setEditingProjectId(null);
        setEditForm({});
      }
    },
    onError: () => notify.error("Failed to delete element"),
  });

  const createElementMutation = useMutation({
    mutationFn: async (body: ElementCreate) => {
      await api.post("/elements/", body);
    },
    onSuccess: async () => {
      await invalidateElements();
      setForm({
        project_id: 0,
        mix_design_id: null,
        element_type: "",
        element_mark: "",
        quantity: 0,
        volume: null,
        due_date: null,
        concrete_strength_mpa: 30,
        requires_cubes: false,
        allowed_mould_ids: [],
      });
      setShowAddElement(false);
    },
    onError: () => notify.error("Failed to create element"),
  });

  const mutatingElements =
    updateElementMutation.isPending ||
    deleteElementMutation.isPending ||
    createElementMutation.isPending;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      if (name === "project_id" || name === "quantity") {
        return { ...f, [name]: value === "" ? 0 : Number(value) };
      }
      if (name === "mix_design_id") {
        return { ...f, mix_design_id: value === "" ? null : Number(value) };
      }
      if (name === "volume") {
        return { ...f, volume: value === "" ? null : Number(value) };
      }
      if (name === "due_date") {
        return { ...f, due_date: value === "" ? null : value };
      }
      if (name === "concrete_strength_mpa") {
        return { ...f, concrete_strength_mpa: value === "" ? null : Number(value) };
      }
      if (name === "requires_cubes") {
        return { ...f, requires_cubes: type === "checkbox" ? checked : Boolean(value) };
      }
      if (name === "allowed_mould_ids") {
        const ids = (value as unknown as string[]).map((v) => Number(v));
        return { ...f, allowed_mould_ids: ids };
      }
      return { ...f, [name]: value };
    });
  };

  const startEdit = (e: Element) => {
    setEditingId(e.id);
    setEditingProjectId(e.project_id);
    setEditForm({
      mix_design_id: (e.mix_design_id ?? null) as number | null,
      element_type: e.element_type,
      element_mark: e.element_mark,
      quantity: e.quantity,
      volume: e.volume,
      due_date: e.due_date,
      allowed_mould_ids: e.allowed_mould_ids ?? [],
      concrete_strength_mpa: e.concrete_strength_mpa ?? null,
      requires_cubes: Boolean(e.requires_cubes),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingProjectId(null);
    setEditForm({});
  };

  const handleEditChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = ev.target;
    setEditForm((f) => {
      if (name === "mix_design_id") return { ...f, mix_design_id: value === "" ? null : Number(value) };
      if (name === "quantity") return { ...f, quantity: value === "" ? undefined : Number(value) };
      if (name === "volume") return { ...f, volume: value === "" ? null : Number(value) };
      if (name === "due_date") return { ...f, due_date: value === "" ? null : value };
      if (name === "concrete_strength_mpa") return { ...f, concrete_strength_mpa: value === "" ? null : Number(value) };
      if (name === "requires_cubes") return { ...f, requires_cubes: type === "checkbox" ? checked : Boolean(value) };
      if (name === "allowed_mould_ids") {
        const ids = (value as unknown as string[]).map((v) => Number(v));
        return { ...f, allowed_mould_ids: ids };
      }
      return { ...f, [name]: value };
    });
  };

  const saveEdit = (id: number) => {
    updateElementMutation.mutate(
      { id, body: editForm },
      {
        onSuccess: () => cancelEdit(),
        onError: () => notify.error("Failed to update element"),
      }
    );
  };

  const deleteElement = (id: number) => {
    if (!window.confirm("Delete this element?")) return;
    deleteElementMutation.mutate(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const projectDue = projects.find((p) => p.id === form.project_id)?.due_date ?? null;
    if (form.due_date && projectDue && form.due_date > projectDue) {
      notify.warning("Element due date cannot exceed the project due date.");
      return;
    }
    createElementMutation.mutate(form);
  };

  const selectedProjectDueDate =
    projects.find((p) => p.id === form.project_id)?.due_date ?? null;
  const editingProjectDueDate =
    editingProjectId != null
      ? projects.find((p) => p.id === editingProjectId)?.due_date ?? null
      : null;
  const totals = items.reduce(
    (acc, e) => {
      const p = progressByElementId[e.id];
      acc.completed += Number(p?.completed_qty ?? 0);
      acc.remaining += Number(p?.remaining_qty ?? e.quantity ?? 0);
      return acc;
    },
    { completed: 0, remaining: 0 }
  );

  return (
    <Paper sx={{ p: 2 }}>
      {refetchingElements ? <LinearProgress sx={{ mb: 2, mt: -1, borderRadius: 1 }} /> : null}
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} spacing={1}>
        <Grid item>
          <Typography variant="h5">Elements</Typography>
        </Grid>
        <Grid item>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <WetcastingActivityFeed section="elements" />
            <Button
              variant={showAddElement ? "outlined" : "contained"}
              onClick={() => {
                if (showAddElement) {
                  setShowAddElement(false);
                  setForm({
                    project_id: 0,
                    mix_design_id: null,
                    element_type: "",
                    element_mark: "",
                    quantity: 0,
                    volume: null,
                    due_date: null,
                    concrete_strength_mpa: 30,
                    requires_cubes: false,
                    allowed_mould_ids: [],
                  });
                } else {
                  setShowAddElement(true);
                }
              }}
            >
              {showAddElement ? "Cancel" : "Add element"}
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {elementsQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load elements.
        </Alert>
      ) : null}
      {projectsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load projects list.
        </Alert>
      ) : null}
      {mouldsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load moulds.
        </Alert>
      ) : null}
      {mixDesignsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load mix designs.
        </Alert>
      ) : null}

      {pageLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip color="success" label={`Finished: ${totals.completed}`} />
        <Chip color="warning" label={`Still planned: ${totals.remaining}`} />
      </Stack>

      {showAddElement ? (
        <form onSubmit={handleSubmit}>
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

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Element Type"
              name="element_type"
              size="small"
              select
              fullWidth
              value={form.element_type}
              onChange={handleChange}
            >
              <MenuItem value="">Select element type…</MenuItem>
              {ELEMENT_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Mix design"
              name="mix_design_id"
              size="small"
              select
              fullWidth
              value={form.mix_design_id ?? ""}
              onChange={handleChange}
            >
              <MenuItem value="">Select mix…</MenuItem>
              {mixDesigns.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                  {m.target_strength_mpa != null ? ` • ${m.target_strength_mpa} MPa` : ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Element Mark"
              name="element_mark"
              size="small"
              fullWidth
              value={form.element_mark}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={1.5}>
            <TextField
              label="Volume"
              name="volume"
              size="small"
              fullWidth
              value={form.volume ?? ""}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={1.8}>
            <TextField
              label="Due Date"
              name="due_date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={form.due_date ?? ""}
              onChange={handleChange}
              inputProps={
                selectedProjectDueDate ? { max: selectedProjectDueDate } : undefined
              }
              helperText={
                selectedProjectDueDate
                  ? `Max: ${selectedProjectDueDate}`
                  : "Select a project first"
              }
            />
          </Grid>

          <Grid item xs={12} sm={6} md={1.3}>
            <TextField
              label="Quantity"
              name="quantity"
              size="small"
              fullWidth
              value={form.quantity || ""}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Strength (MPa)"
              name="concrete_strength_mpa"
              size="small"
              select
              fullWidth
              value={form.concrete_strength_mpa ?? ""}
              onChange={handleChange}
            >
              {Array.from({ length: 13 }, (_, i) => 20 + i * 5).map((v) => (
                <MenuItem key={v} value={v}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControlLabel
              control={
                <Checkbox
                  name="requires_cubes"
                  checked={Boolean(form.requires_cubes)}
                  onChange={handleChange}
                />
              }
              label="Test cubes required"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl size="small" fullWidth>
              <InputLabel id="allowed-moulds-label">Compatible moulds</InputLabel>
              <Select
                labelId="allowed-moulds-label"
                label="Compatible moulds"
                multiple
                value={form.allowed_mould_ids.map(String)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    allowed_mould_ids: (e.target.value as string[]).map((v) => Number(v)),
                  }))
                }
                renderValue={(selected) => {
                  const ids = (selected as string[]).map((v) => Number(v));
                  if (ids.length === 0) return "Select compatible moulds…";
                  const names = ids
                    .map((id) => moulds.find((m) => m.id === id)?.name ?? `#${id}`)
                    .join(", ");
                  return names;
                }}
              >
                {moulds.map((m) => (
                  <MenuItem key={m.id} value={String(m.id)}>
                    <Checkbox checked={form.allowed_mould_ids.includes(m.id)} />
                    <ListItemText primary={m.name} secondary={`${m.mould_type} • cap ${m.capacity}`} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={1.2}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ height: 40 }}
              disabled={createElementMutation.isPending}
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
            <TableCell>Type</TableCell>
            <TableCell>Volume</TableCell>
            <TableCell>Due</TableCell>
            <TableCell>Qty</TableCell>
            <TableCell>Finished</TableCell>
            <TableCell>Still Planned</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Mix</TableCell>
            <TableCell>Strength</TableCell>
            <TableCell>Cubes</TableCell>
            <TableCell>Compatible moulds</TableCell>
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
                    value={editForm.element_mark ?? ""}
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
                    name="element_type"
                    select
                    value={editForm.element_type ?? ""}
                    onChange={handleEditChange}
                  >
                    {ELEMENT_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  e.element_type
                )}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    name="volume"
                    value={editForm.volume ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  e.volume
                )}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    type="date"
                    name="due_date"
                    InputLabelProps={{ shrink: true }}
                    value={(editForm.due_date as string | null) ?? ""}
                    onChange={handleEditChange}
                    inputProps={
                      editingProjectDueDate ? { max: editingProjectDueDate } : undefined
                    }
                  />
                ) : (
                  e.due_date
                )}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    name="quantity"
                    value={editForm.quantity ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  e.quantity
                )}
              </TableCell>
              <TableCell>{progressByElementId[e.id]?.completed_qty ?? 0}</TableCell>
              <TableCell>{progressByElementId[e.id]?.remaining_qty ?? e.quantity}</TableCell>
              <TableCell>
                {(progressByElementId[e.id]?.derived_status ?? e.status ?? "planned").replace("_", " ")}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    name="mix_design_id"
                    select
                    value={(editForm.mix_design_id as number | null | undefined) ?? ""}
                    onChange={handleEditChange}
                  >
                    <MenuItem value="">None</MenuItem>
                    {mixDesigns.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  (e.mix_design_id != null
                    ? mixDesigns.find((m) => m.id === e.mix_design_id)?.name ?? `#${e.mix_design_id}`
                    : "-")
                )}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <TextField
                    size="small"
                    name="concrete_strength_mpa"
                    select
                    value={editForm.concrete_strength_mpa ?? ""}
                    onChange={handleEditChange}
                  >
                    {Array.from({ length: 13 }, (_, i) => 20 + i * 5).map((v) => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  e.concrete_strength_mpa ?? "-"
                )}
              </TableCell>

              <TableCell>
                {editingId === e.id ? (
                  <Checkbox
                    name="requires_cubes"
                    checked={Boolean(editForm.requires_cubes)}
                    onChange={handleEditChange}
                  />
                ) : e.requires_cubes ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </TableCell>
              <TableCell>
                {(e.allowed_mould_ids?.length ?? 0) === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    None
                  </Typography>
                ) : (
                  <Typography variant="body2">
                    {e.allowed_mould_ids
                      ?.map((id) => moulds.find((m) => m.id === id)?.name ?? `#${id}`)
                      .join(", ")}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {editingId === e.id ? (
                  <>
                    <Button
                      size="small"
                      onClick={() => saveEdit(e.id)}
                      disabled={mutatingElements}
                    >
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit} disabled={mutatingElements}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => startEdit(e)}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setMouldDialogElementId(e.id);
                        setMouldDialogSelected(e.allowed_mould_ids ?? []);
                        setMouldDialogOpen(true);
                      }}
                    >
                      Moulds
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => deleteElement(e.id)}
                      disabled={mutatingElements}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
        </>
      )}

      <Dialog open={mouldDialogOpen} onClose={() => setMouldDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Compatible moulds</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="edit-moulds-label" shrink>
              Select moulds
            </InputLabel>
            <Select
              labelId="edit-moulds-label"
              label="Select moulds"
              multiple
              value={mouldDialogSelected.map(String)}
              onChange={(e) =>
                setMouldDialogSelected((e.target.value as string[]).map((v) => Number(v)))
              }
              renderValue={(selected) => {
                const ids = (selected as string[]).map((v) => Number(v));
                if (ids.length === 0) return "None";
                return ids
                  .map((id) => moulds.find((m) => m.id === id)?.name ?? `#${id}`)
                  .join(", ");
              }}
            >
              {moulds.map((m) => (
                <MenuItem key={m.id} value={String(m.id)}>
                  <Checkbox checked={mouldDialogSelected.includes(m.id)} />
                  <ListItemText primary={m.name} secondary={`${m.mould_type} • cap ${m.capacity}`} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMouldDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={updateElementMutation.isPending}
            onClick={() => {
              if (!mouldDialogElementId) return;
              updateElementMutation.mutate(
                { id: mouldDialogElementId, body: { allowed_mould_ids: mouldDialogSelected } },
                {
                  onSuccess: () => setMouldDialogOpen(false),
                  onError: () => notify.error("Failed to update compatible moulds"),
                }
              );
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

