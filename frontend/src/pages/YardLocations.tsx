import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import api from "../api/client";
import type { YardLocation } from "../types/api";
import { YARD_LOCATIONS_KEY, fetchYardLocations } from "./yardQuery";
import { useNotify } from "../notifications/NotifyContext";

export default function YardLocations() {
  const notify = useNotify();
  const qc = useQueryClient();

  const { data: items = [], isError } = useQuery({
    queryKey: YARD_LOCATIONS_KEY,
    queryFn: fetchYardLocations,
    staleTime: 60_000,
  });

  const invalidateLocations = () => qc.invalidateQueries({ queryKey: YARD_LOCATIONS_KEY });

  const [form, setForm] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name?: string; description?: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post("/yard/locations", null, {
      params: { name: form.name.trim(), description: form.description.trim() },
    });
    setForm({ name: "", description: "" });
    await invalidateLocations();
  };

  const startEdit = (loc: YardLocation) => {
    setEditingId(loc.id);
    setEditForm({ name: loc.name, description: loc.description ?? "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const save = async (id: number) => {
    await api.put(`/yard/locations/${id}`, null, {
      params: {
        name: editForm.name,
        description: editForm.description,
      },
    });
    await invalidateLocations();
    cancelEdit();
  };

  const del = async (id: number) => {
    if (!window.confirm("Delete this location? It must be empty first.")) return;
    try {
      await api.delete(`/yard/locations/${id}`);
      await invalidateLocations();
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: string; error?: string } } };
      notify.error(
        (anyErr?.response?.data && (anyErr.response.data.detail || anyErr.response.data.error)) ||
          "Failed to delete location"
      );
      console.error(err);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Yard Locations
      </Typography>

      {isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load yard locations.
        </Alert>
      ) : null}

      <form onSubmit={submit}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
          <TextField label="Name" name="name" size="small" value={form.name} onChange={handleChange} />
          <TextField
            label="Description"
            name="description"
            size="small"
            value={form.description}
            onChange={handleChange}
            sx={{ minWidth: 260 }}
          />
          <Button type="submit" variant="contained">
            Add location
          </Button>
        </Stack>
      </form>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((loc) => (
            <TableRow key={loc.id}>
              <TableCell>{loc.id}</TableCell>
              <TableCell>
                {editingId === loc.id ? (
                  <TextField size="small" name="name" value={editForm.name ?? ""} onChange={handleEditChange} />
                ) : (
                  loc.name
                )}
              </TableCell>
              <TableCell>
                {editingId === loc.id ? (
                  <TextField
                    size="small"
                    name="description"
                    value={editForm.description ?? ""}
                    onChange={handleEditChange}
                  />
                ) : (
                  loc.description ?? "-"
                )}
              </TableCell>
              <TableCell>
                {editingId === loc.id ? (
                  <>
                    <Button size="small" onClick={() => save(loc.id)}>
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={() => startEdit(loc)}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => del(loc.id)}>
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
