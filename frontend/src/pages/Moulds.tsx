// File overview: Page component and UI logic for pages/Moulds.tsx.
import { useEffect, useState } from "react";
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
  Stack,
  IconButton,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import api from "../api/client";
import type { Mould, MouldCreate, MouldUpdate } from "../types/api";
import { MOULD_TYPES } from "../constants/options";
import { useNotify } from "../notifications/NotifyContext";

// Inputs: caller state/arguments related to moulds.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Moulds() {
  const notify = useNotify();
  const [moulds, setMoulds] = useState<Mould[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MouldUpdate>({});
  const [showAddMould, setShowAddMould] = useState(false);
  const [form, setForm] = useState<MouldCreate>({
    name: "",
    mould_type: "",
    capacity: 0,
    cycle_time_hours: 0,
    active: true,
  });
  const [count, setCount] = useState(1);

  const load = async () => {
    const { data } = await api.get<Mould[]>("/moulds");
    setMoulds(data);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => {
      if (name === "capacity") return { ...f, capacity: value === "" ? 0 : Number(value) };
      if (name === "cycle_time_hours")
        return { ...f, cycle_time_hours: value === "" ? 0 : Number(value) };
      if (name === "active") return { ...f, active: value === "true" };
      return { ...f, [name]: value };
    });
  };

  const startEdit = (m: Mould) => {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      mould_type: m.mould_type,
      capacity: m.capacity,
      cycle_time_hours: m.cycle_time_hours,
      active: m.active,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((f) => {
      if (name === "capacity") return { ...f, capacity: value === "" ? null : Number(value) };
      if (name === "cycle_time_hours")
        return { ...f, cycle_time_hours: value === "" ? null : Number(value) };
      if (name === "active") return { ...f, active: value === "true" };
      return { ...f, [name]: value };
    });
  };

  const saveEdit = async (id: number) => {
    try {
      await api.put(`/moulds/${id}`, editForm);
      await load();
      cancelEdit();
    } catch (err) {
      notify.error("Failed to update mould");
      console.error(err);
    }
  };

  const deleteMould = async (id: number) => {
    if (!window.confirm("Delete this mould?")) return;
    try {
      await api.delete(`/moulds/${id}`);
      setMoulds((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      notify.error("Failed to delete mould");
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const n = Math.max(1, Math.floor(count || 1));
      for (let i = 1; i <= n; i++) {
        const name = n === 1 ? form.name : `${form.name} ${i}`;
        await api.post("/moulds", { ...form, name });
      }
      setForm({ name: "", mould_type: "", capacity: 0, cycle_time_hours: 0, active: true });
      setCount(1);
      await load();
      setShowAddMould(false);
    } catch (err) {
      notify.error("Failed to create mould");
      console.error(err);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5">Moulds</Typography>
        <Button
          variant={showAddMould ? "outlined" : "contained"}
          onClick={() => {
            if (showAddMould) {
              setShowAddMould(false);
              setForm({ name: "", mould_type: "", capacity: 0, cycle_time_hours: 0, active: true });
              setCount(1);
            } else {
              setShowAddMould(true);
            }
          }}
        >
          {showAddMould ? "Cancel" : "Add mould"}
        </Button>
      </Stack>

      {showAddMould ? (
        <form onSubmit={handleSubmit}>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center" }} flexWrap="wrap">
          <TextField
            label="Name"
            name="name"
            size="small"
            value={form.name}
            onChange={handleChange}
            sx={{ minWidth: 240 }}
          />
          <TextField
            label="Mould Type"
            name="mould_type"
            size="small"
            select
            value={form.mould_type}
            onChange={handleChange}
            sx={{ minWidth: 200 }}
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected) =>
                selected === "" ? "" : String(selected),
            }}
          >
            <MenuItem value="" disabled>
              Select mould type…
            </MenuItem>
            {MOULD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Capacity"
            name="capacity"
            size="small"
            value={form.capacity || ""}
            onChange={handleChange}
            sx={{ width: 140 }}
          />
          <TextField
            label="Cycle Time (h)"
            name="cycle_time_hours"
            size="small"
            value={form.cycle_time_hours || ""}
            onChange={handleChange}
            sx={{ width: 160 }}
          />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 140 }}>
            <IconButton
              size="small"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
              aria-label="Decrease count"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              label="Count"
              size="small"
              value={count}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setCount(Math.max(1, next));
              }}
              inputProps={{ min: 1, step: 1 }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 80 }}
            />
            <IconButton
              size="small"
              onClick={() => setCount((c) => c + 1)}
              aria-label="Increase count"
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Button type="submit" variant="contained">
            Add
          </Button>
        </Stack>
        </form>
      ) : null}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Capacity</TableCell>
            <TableCell>Cycle Time (h)</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {moulds.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.id}</TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="name"
                    value={editForm.name ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  m.name
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="mould_type"
                    select
                    value={editForm.mould_type ?? ""}
                    onChange={handleEditChange}
                  >
                    {MOULD_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  m.mould_type
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="capacity"
                    value={editForm.capacity ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  m.capacity
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="cycle_time_hours"
                    value={editForm.cycle_time_hours ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  m.cycle_time_hours
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <TextField
                    size="small"
                    name="active"
                    select
                    value={(editForm.active ?? true) ? "true" : "false"}
                    onChange={handleEditChange}
                  >
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </TextField>
                ) : m.active ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </TableCell>
              <TableCell>
                {editingId === m.id ? (
                  <>
                    <Button size="small" onClick={() => saveEdit(m.id)}>
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
                    <Button size="small" color="error" onClick={() => deleteMould(m.id)}>
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

