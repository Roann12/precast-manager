// File overview: Page component and UI logic for pages/MixDesigns.tsx.
import { useEffect, useState } from "react";
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
} from "@mui/material";
import api from "../api/client";

import type { MixDesign, MixDesignCreate, MixDesignUpdate } from "../types/api";

// Inputs: caller state/arguments related to mix designs.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function MixDesigns() {
  const [items, setItems] = useState<MixDesign[]>([]);
  const [form, setForm] = useState<MixDesignCreate>({ name: "", target_strength_mpa: null, active: true });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MixDesignUpdate>({});
  const [showAddMixDesign, setShowAddMixDesign] = useState(false);

  const load = async () => {
    const { data } = await api.get<MixDesign[]>("/mix-designs");
    setItems(data);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

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
    cancelEdit();
  };

  const del = async (id: number) => {
    if (!window.confirm("Delete this mix design?")) return;
    await api.delete(`/mix-designs/${id}`);
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
  };

  return (
    <Paper sx={{ p: 2 }}>
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
    </Paper>
  );
}

