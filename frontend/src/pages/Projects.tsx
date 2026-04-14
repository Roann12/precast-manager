// File overview: Page component and UI logic for pages/Projects.tsx.
import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Button,
  Stack,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import api from "../api/client";
import type { Project, ProjectCreate, ProjectUpdate } from "../types/api";
import { PROJECT_STATUSES } from "../constants/options";
import { fetchProjectList, type ProjectListParams, type ProjectVisibilityFilter } from "./projectsQuery";
import { useNotify } from "../notifications/NotifyContext";

const PROJECTS_LIST_ROOT_KEY = ["projects", "list"] as const;

// Inputs: caller state/arguments related to projects.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Projects() {
  const notify = useNotify();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<ProjectVisibilityFilter>("active_only");
  const [listParams, setListParams] = useState<ProjectListParams>({ search: "", filter: "active_only" });
  const editingIdRef = useRef<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  const { data: projects = [], isPending, isFetching, isError } = useQuery({
    queryKey: [...PROJECTS_LIST_ROOT_KEY, listParams.search, listParams.filter],
    queryFn: () => fetchProjectList(listParams),
  });

  const invalidateProjectLists = async () => {
    await qc.invalidateQueries({ queryKey: PROJECTS_LIST_ROOT_KEY });
    await qc.invalidateQueries({ queryKey: ["projects", "detail"] });
  };

  const updateProjectMutation = useMutation({
    mutationFn: async (vars: { id: number; body: ProjectUpdate }) => {
      await api.put(`/projects/${vars.id}`, vars.body);
    },
    onSuccess: async () => {
      await invalidateProjectLists();
      cancelEdit();
    },
    onError: () => notify.error("Failed to update project"),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await api.delete(`/projects/${projectId}`);
    },
    onSuccess: async (_, projectId) => {
      await invalidateProjectLists();
      if (editingIdRef.current === projectId) cancelEdit();
    },
    onError: () => notify.error("Failed to delete project"),
  });

  const createProjectMutation = useMutation({
    mutationFn: async (body: ProjectCreate) => {
      await api.post("/projects", body);
    },
    onSuccess: async () => {
      await invalidateProjectLists();
      setForm({
        project_name: "",
        client: "",
        start_date: null,
        due_date: null,
        status: "active",
        status_reason: "",
        work_saturday: false,
        work_sunday: false,
      });
      setShowAddProject(false);
    },
    onError: () => notify.error("Failed to create project"),
  });

  const mutating =
    updateProjectMutation.isPending || deleteProjectMutation.isPending || createProjectMutation.isPending;

  const [editForm, setEditForm] = useState<ProjectUpdate>({});
  const [showAddProject, setShowAddProject] = useState(false);

  const [form, setForm] = useState<ProjectCreate>({
    project_name: "",
    client: "",
    start_date: null,
    due_date: null,
    status: "active",
    status_reason: "",
    work_saturday: false,
    work_sunday: false,
  });

  const runSearch = () => {
    setListParams({ search: search.trim(), filter: visibilityFilter });
  };

  const onVisibilityChange = (value: ProjectVisibilityFilter) => {
    setVisibilityFilter(value);
    setListParams({ search: search.trim(), filter: value });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditForm({
      project_name: p.project_name,
      client: p.client,
      start_date: p.start_date,
      due_date: p.due_date,
      status: p.status,
      status_reason: p.status_reason,
      closed_at: p.closed_at,
      work_saturday: p.work_saturday,
      work_sunday: p.work_sunday,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setEditForm((f) => ({
      ...f,
      [name]:
        type === "checkbox"
          ? checked
          : name === "start_date" || name === "due_date"
            ? value === ""
              ? null
              : value
            : value,
    }));
  };

  const saveEdit = (projectId: number) => {
    updateProjectMutation.mutate({ id: projectId, body: editForm });
  };

  const deleteProject = (projectId: number) => {
    if (!window.confirm("Delete this project? This will also delete its elements.")) return;
    deleteProjectMutation.mutate(projectId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProjectMutation.mutate(form);
  };

  return (
    <Paper sx={{ p: 2 }}>
      {isFetching && !isPending ? <LinearProgress sx={{ mb: 2, mt: -1, borderRadius: 1 }} /> : null}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5">Projects</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <TextField
            size="small"
            label="Search archived projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runSearch();
              }
            }}
          />
          <TextField
            size="small"
            select
            label="View"
            value={visibilityFilter}
            onChange={(e) => {
              onVisibilityChange(e.target.value as ProjectVisibilityFilter);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="active_only">Active only (default)</MenuItem>
            <MenuItem value="all">All statuses</MenuItem>
            {PROJECT_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                Only {s}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={() => runSearch()}>
            Search
          </Button>
          <Button
            variant={showAddProject ? "outlined" : "contained"}
            onClick={() => {
              if (showAddProject) {
                setShowAddProject(false);
                setForm({
                  project_name: "",
                  client: "",
                  start_date: null,
                  due_date: null,
                  status: "active",
                  status_reason: "",
                  work_saturday: false,
                  work_sunday: false,
                });
              } else {
                setShowAddProject(true);
              }
            }}
          >
            {showAddProject ? "Cancel" : "Add project"}
          </Button>
        </Stack>
      </Stack>

      {isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load projects.
        </Alert>
      ) : null}

      {showAddProject ? (
        <form onSubmit={handleSubmit}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
            <TextField
              label="Project Name"
              name="project_name"
              size="small"
              value={form.project_name}
              onChange={handleChange}
            />
            <TextField
              label="Client"
              name="client"
              size="small"
              value={form.client ?? ""}
              onChange={handleChange}
            />
            <TextField
              label="Start Date"
              name="start_date"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.start_date ?? ""}
              onChange={handleChange}
            />
            <TextField
              label="Due Date"
              name="due_date"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.due_date ?? ""}
              onChange={handleChange}
            />
            <TextField
              label="Status"
              name="status"
              size="small"
              select
              value={form.status ?? "planned"}
              onChange={handleChange}
            >
              {PROJECT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status reason (optional)"
              name="status_reason"
              size="small"
              value={form.status_reason ?? ""}
              onChange={handleChange}
            />
            <FormControlLabel
              control={
                <Checkbox name="work_saturday" checked={Boolean(form.work_saturday)} onChange={handleChange} />
              }
              label="Work Saturdays"
            />
            <FormControlLabel
              control={<Checkbox name="work_sunday" checked={Boolean(form.work_sunday)} onChange={handleChange} />}
              label="Work Sundays"
            />
            <Button type="submit" variant="contained" disabled={!form.project_name.trim() || mutating}>
              Save project
            </Button>
          </Stack>
        </form>
      ) : null}

      {isPending ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : isError ? null : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Weekend work</TableCell>
              <TableCell>View</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.id}</TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      name="project_name"
                      value={editForm.project_name ?? ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    p.project_name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      name="client"
                      value={editForm.client ?? ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    p.client
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      type="date"
                      name="start_date"
                      InputLabelProps={{ shrink: true }}
                      value={(editForm.start_date as string | null) ?? ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    p.start_date
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      type="date"
                      name="due_date"
                      InputLabelProps={{ shrink: true }}
                      value={(editForm.due_date as string | null) ?? ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    p.due_date
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      name="status"
                      select
                      value={(editForm.status as string | null) ?? "planned"}
                      onChange={handleEditChange}
                    >
                      {PROJECT_STATUSES.map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    p.status
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <TextField
                      size="small"
                      name="status_reason"
                      value={(editForm.status_reason as string | null) ?? ""}
                      onChange={handleEditChange}
                    />
                  ) : (
                    p.status_reason || "-"
                  )}
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <Stack direction="row" spacing={1}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            name="work_saturday"
                            checked={Boolean(editForm.work_saturday)}
                            onChange={handleEditChange}
                          />
                        }
                        label="Sat"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            name="work_sunday"
                            checked={Boolean(editForm.work_sunday)}
                            onChange={handleEditChange}
                          />
                        }
                        label="Sun"
                      />
                    </Stack>
                  ) : (
                    `${p.work_saturday ? "Sat" : ""}${p.work_saturday && p.work_sunday ? ", " : ""}${
                      p.work_sunday ? "Sun" : ""
                    }` || "-"
                  )}
                </TableCell>
                <TableCell>
                  <Button size="small" component={RouterLink} to={`/projects/${p.id}`}>
                    Open
                  </Button>
                </TableCell>
                <TableCell>
                  {editingId === p.id ? (
                    <>
                    <Button size="small" onClick={() => saveEdit(p.id)} disabled={mutating}>
                      Save
                    </Button>
                    <Button size="small" onClick={cancelEdit} disabled={mutating}>
                      Cancel
                    </Button>
                    </>
                  ) : (
                    <>
                      <Button size="small" onClick={() => startEdit(p)}>
                        Edit
                      </Button>
                    <Button size="small" color="error" onClick={() => deleteProject(p.id)} disabled={mutating}>
                      Delete
                    </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
