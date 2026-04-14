// File overview: Page component and UI logic for pages/ProjectDetail.tsx.
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { Element } from "../types/api";
import { ELEMENTS_ALL_KEY, fetchElementsAll } from "./elementsQuery";
import { fetchProjectDetail, projectDetailQueryKey } from "./projectsQuery";

// Inputs: caller state/arguments related to project detail.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function ProjectDetail() {
  const { projectId } = useParams();
  const id = Number(projectId);

  const projectQuery = useQuery({
    queryKey: projectDetailQueryKey(id),
    queryFn: () => fetchProjectDetail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const elementsQuery = useQuery({
    queryKey: ELEMENTS_ALL_KEY,
    queryFn: fetchElementsAll,
    enabled: Number.isFinite(id) && id > 0,
  });

  const project = projectQuery.data;
  const elements = elementsQuery.data ?? [];

  const projectElements = useMemo(
    () => elements.filter((e: Element) => e.project_id === id),
    [elements, id]
  );

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Invalid project id</Typography>
        <Button component={Link} to="/projects" sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Paper>
    );
  }

  const loading = projectQuery.isPending || elementsQuery.isPending;

  if (projectQuery.isError) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography color="error">Failed to load project.</Typography>
        <Button component={Link} to="/projects" sx={{ mt: 2 }}>
          Back to Projects
        </Button>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <div>
          <Typography variant="h5">{project?.project_name ?? `Project #${id}`}</Typography>
          <Typography variant="body2" color="text.secondary">
            Client: {project?.client ?? "-"} • Status: {project?.status ?? "-"} • Due: {project?.due_date ?? "-"}
          </Typography>
          {project?.status_reason ? (
            <Typography variant="body2" color="text.secondary">
              Reason: {project.status_reason}
            </Typography>
          ) : null}
        </div>
        <Button component={Link} to="/projects">
          Back
        </Button>
      </Stack>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Elements
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Mark</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Volume</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projectElements.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.id}</TableCell>
                <TableCell>{e.element_type}</TableCell>
                <TableCell>{e.element_mark}</TableCell>
                <TableCell>{e.quantity}</TableCell>
                <TableCell>{e.volume}</TableCell>
                <TableCell>{e.due_date}</TableCell>
                <TableCell>{e.status}</TableCell>
              </TableRow>
            ))}
            {projectElements.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No elements yet. Create them in the Elements page.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
