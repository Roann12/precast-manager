// File overview: Page component and UI logic for pages/HollowcoreBeds.tsx.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CircularProgress,
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
import { useNotify } from "../notifications/NotifyContext";
import { formatQueryErrorMessage } from "../queryClient";
import { HOLLOWCORE_BEDS_KEY, fetchHollowcoreBeds, type HollowcoreBedRow } from "./hollowcoreQuery";

type Bed = HollowcoreBedRow;

// Inputs: caller state/arguments related to hollowcore beds.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function HollowcoreBeds() {
  const notify = useNotify();
  const qc = useQueryClient();

  const bedsQuery = useQuery({
    queryKey: HOLLOWCORE_BEDS_KEY,
    queryFn: fetchHollowcoreBeds,
  });

  const beds = bedsQuery.data ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", length_mm: 6000, max_casts_per_day: 1, active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Bed>>({});
  const editingIdRef = useRef<number | null>(null);
  editingIdRef.current = editingId;

  const invalidateBeds = () => qc.invalidateQueries({ queryKey: HOLLOWCORE_BEDS_KEY });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      await api.post("/hollowcore/beds", payload);
    },
    onSuccess: async () => {
      setShowAdd(false);
      setForm({ name: "", length_mm: 6000, max_casts_per_day: 1, active: true });
      await invalidateBeds();
      notify.success("Bed created");
    },
    onError: (e) => notify.error(formatQueryErrorMessage(e)),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: number; body: Partial<Bed> }) => {
      await api.put(`/hollowcore/beds/${vars.id}`, vars.body);
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditForm({});
      await invalidateBeds();
      notify.success("Bed updated");
    },
    onError: (e) => notify.error(formatQueryErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/hollowcore/beds/${id}`);
    },
    onSuccess: async (_, removedId) => {
      if (editingIdRef.current === removedId) {
        setEditingId(null);
        setEditForm({});
      }
      await invalidateBeds();
      notify.success("Bed deleted");
    },
    onError: (e) => notify.error(formatQueryErrorMessage(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const startEdit = (b: Bed) => {
    setEditingId(b.id);
    setEditForm({ ...b });
  };

  const save = (id: number) => {
    updateMutation.mutate({
      id,
      body: {
        name: editForm.name,
        length_mm: Number(editForm.length_mm),
        max_casts_per_day: Number(editForm.max_casts_per_day),
        active: Boolean(editForm.active),
      },
    });
  };

  const del = (id: number) => {
    if (!window.confirm("Delete this bed?")) return;
    deleteMutation.mutate(id);
  };

  const mutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5">Hollowcore Beds</Typography>
        <Button
          variant={showAdd ? "outlined" : "contained"}
          onClick={() => {
            setShowAdd((v) => !v);
            setForm({ name: "", length_mm: 6000, max_casts_per_day: 1, active: true });
          }}
        >
          {showAdd ? "Cancel" : "Add bed"}
        </Button>
      </Stack>

      {bedsQuery.isPending ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : null}

      {bedsQuery.isError ? (
        <Typography color="error" sx={{ mb: 2 }}>
          Failed to load beds.
        </Typography>
      ) : null}

      {showAdd ? (
        <form onSubmit={submit}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
            <TextField label="Name" size="small" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <TextField
              label="Length (mm)"
              size="small"
              type="number"
              value={form.length_mm}
              onChange={(e) => setForm((f) => ({ ...f, length_mm: Number(e.target.value) }))}
            />
            <TextField
              label="Max casts/day"
              size="small"
              type="number"
              value={form.max_casts_per_day}
              onChange={(e) => setForm((f) => ({ ...f, max_casts_per_day: Number(e.target.value) }))}
            />
            <TextField
              label="Active"
              size="small"
              select
              value={form.active ? "true" : "false"}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "true" }))}
              sx={{ minWidth: 120 }}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </TextField>
            <Button type="submit" variant="contained" disabled={!form.name.trim() || mutating}>
              Save
            </Button>
          </Stack>
        </form>
      ) : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell align="right">Length (mm)</TableCell>
            <TableCell align="right">Max casts/day</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {beds.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.id}</TableCell>
              <TableCell>
                {editingId === b.id ? (
                  <TextField size="small" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                ) : (
                  b.name
                )}
              </TableCell>
              <TableCell align="right">
                {editingId === b.id ? (
                  <TextField
                    size="small"
                    type="number"
                    value={editForm.length_mm ?? 0}
                    onChange={(e) => setEditForm((f) => ({ ...f, length_mm: Number(e.target.value) }))}
                  />
                ) : (
                  b.length_mm
                )}
              </TableCell>
              <TableCell align="right">
                {editingId === b.id ? (
                  <TextField
                    size="small"
                    type="number"
                    value={editForm.max_casts_per_day ?? 0}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_casts_per_day: Number(e.target.value) }))}
                  />
                ) : (
                  b.max_casts_per_day
                )}
              </TableCell>
              <TableCell>
                {editingId === b.id ? (
                  <TextField
                    size="small"
                    select
                    value={(editForm.active ?? true) ? "true" : "false"}
                    onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.value === "true" }))}
                    sx={{ minWidth: 120 }}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </TextField>
                ) : b.active ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </TableCell>
              <TableCell>
                {editingId === b.id ? (
                  <>
                    <Button size="small" onClick={() => save(b.id)} disabled={mutating}>
                      Save
                    </Button>
                    <Button size="small" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => startEdit(b)} disabled={mutating}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => del(b.id)} disabled={mutating}>
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
