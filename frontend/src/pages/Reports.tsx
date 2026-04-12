import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  AppBar,
  Button,
  Collapse,
  Divider,
  Dialog,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import * as XLSX from "xlsx";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Project } from "../types/api";
import { PROJECTS_OPTIONS_KEY, fetchProjectsOptions } from "./elementsQuery";

const toLocalISODate = (d: Date = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function exportRowsToExcel(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

type YardStockRow = {
  element_type: string;
  element_mark: string;
  location: string;
  quantity: number;
};

type ProductionCalendarRow = {
  id: number;
  production_date: string;
  mould: string;
  project_name: string;
  element_type: string;
  element_mark: string;
  batch_id: string | null;
  quantity: number;
  status: string;
};

type QcProjectResultRow = {
  id: number;
  test_date: string;
  batch_id: string | null;
  element_mark: string;
  element_type: string;
  project_id: number;
  project_name: string;
  cast_date: string | null;
  due_date: string | null;
  age_days: number | null;
  test_type: string;
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
  notes: string | null;
  result: string;
};

function ViewTable({
  columns,
  rows,
  emptyLabel = "No rows loaded yet.",
  maxRows = 200,
}: {
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: Record<string, unknown>[];
  emptyLabel?: string;
  maxRows?: number;
}) {
  const formatCell = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  if (!rows.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        {emptyLabel}
      </Typography>
    );
  }

  const shown = rows.slice(0, maxRows);
  return (
    <Stack spacing={1}>
      <Alert severity="success">
        Showing {shown.length}
        {rows.length > shown.length ? ` of ${rows.length}` : ""} rows.
      </Alert>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          maxWidth: "100%",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align ?? "left"} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((r, idx) => (
              <TableRow key={idx} hover>
                {columns.map((c) => {
                  const v = r[c.key];
                  return (
                    <TableCell key={c.key} align={c.align ?? "left"} sx={{ whiteSpace: "nowrap" }}>
                      {formatCell(v)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {rows.length > shown.length ? (
        <Typography variant="caption" color="text.secondary">
          Too many rows to show. Export to Excel to view the full list.
        </Typography>
      ) : null}
    </Stack>
  );
}

export default function Reports() {
  const { user } = useAuth();

  // Per-card preview collapse (on-page view, not full-screen).
  const [dispatchLoaded, setDispatchLoaded] = useState(false);
  const [dispatchPreviewOpen, setDispatchPreviewOpen] = useState(true);
  const [completionLoaded, setCompletionLoaded] = useState(false);
  const [completionPreviewOpen, setCompletionPreviewOpen] = useState(true);
  const [yardLoaded, setYardLoaded] = useState(false);
  const [yardPreviewOpen, setYardPreviewOpen] = useState(true);
  const [calLoaded, setCalLoaded] = useState(false);
  const [calPreviewOpen, setCalPreviewOpen] = useState(true);
  const [qcLoaded, setQcLoaded] = useState(false);
  const [qcPreviewOpen, setQcPreviewOpen] = useState(true);
  const [hcLoaded, setHcLoaded] = useState(false);
  const [hcPreviewOpen, setHcPreviewOpen] = useState(true);
  const [projectSummaryLoaded, setProjectSummaryLoaded] = useState(false);
  const [projectSummaryPreviewOpen, setProjectSummaryPreviewOpen] = useState(true);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState<string>("");
  const [viewerColumns, setViewerColumns] = useState<{ key: string; label: string; align?: "left" | "right" | "center" }[]>([]);
  const [viewerRows, setViewerRows] = useState<Record<string, unknown>[]>([]);
  const [viewerEmptyLabel, setViewerEmptyLabel] = useState<string>("No rows.");

  const openViewer = (args: {
    title: string;
    columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
    rows: Record<string, unknown>[];
    emptyLabel?: string;
  }) => {
    setViewerTitle(args.title);
    setViewerColumns(args.columns);
    setViewerRows(args.rows);
    setViewerEmptyLabel(args.emptyLabel ?? "No rows.");
    setViewerOpen(true);
  };

  const formatError = (e: unknown, fallback: string) => {
    const detail = (e as any)?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail != null) {
      try {
        return JSON.stringify(detail);
      } catch {
        return String(detail);
      }
    }
    const msg = (e as any)?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    return fallback;
  };

  // QC export
  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });
  const projects = projectsQuery.data ?? [];
  const [projectForQc, setProjectForQc] = useState<number | "">("");
  const [qcRows, setQcRows] = useState<QcProjectResultRow[]>([]);
  const [qcLoading, setQcLoading] = useState(false);
  const [qcError, setQcError] = useState<string | null>(null);

  // Yard stock export
  const [yardRows, setYardRows] = useState<YardStockRow[]>([]);
  const [yardLoading, setYardLoading] = useState(false);
  const [yardError, setYardError] = useState<string | null>(null);

  // Production calendar export
  const [calRows, setCalRows] = useState<ProductionCalendarRow[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [calStart, setCalStart] = useState<string>(toLocalISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [calEnd, setCalEnd] = useState<string>(toLocalISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));

  useEffect(() => {
    const list = projectsQuery.data;
    if (!list?.length) return;
    setProjectForQc((prev) => (prev === "" ? list[0].id : prev));
  }, [projectsQuery.data]);

  const canQc = user?.role === "QC" || user?.role === "admin";
  const canDispatch = user?.role === "dispatch" || user?.role === "admin";
  const canPlanner = user?.role === "planner" || user?.role === "admin";
  const canProduction = user?.role === "production" || user?.role === "admin";

  type DispatchNoteRow = {
    dispatch_id: number;
    dispatch_date: string;
    truck_number: string | null;
    dispatch_status: string;
    project_id: number;
    project_name: string;
    dispatch_item_id: number;
    yard_inventory_id: number;
    yard_location: string;
    element_id: number;
    element_mark: string;
    element_type: string;
    dispatch_quantity: number;
    yard_quantity_after: number;
  };

  const [dispatchRows, setDispatchRows] = useState<DispatchNoteRow[]>([]);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchStart, setDispatchStart] = useState<string>(toLocalISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dispatchEnd, setDispatchEnd] = useState<string>(toLocalISODate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  type ProductionCompletionRow = {
    date: string;
    non_hollowcore_planned_qty: number;
    non_hollowcore_completed_qty: number;
    hollowcore_planned_qty: number;
    hollowcore_completed_qty: number;
  };

  const [completionRows, setCompletionRows] = useState<ProductionCompletionRow[]>([]);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionStart, setCompletionStart] = useState<string>(toLocalISODate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)));
  const [completionEnd, setCompletionEnd] = useState<string>(toLocalISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));

  type LateItemRow = {
    schedule_id: number;
    production_date: string;
    status: string;
    quantity: number;
    mould: string;
    project_id: number;
    project_name: string;
    project_due_date: string | null;
    element_id: number;
    element_mark: string;
    element_type: string;
    element_due_date: string | null;
    effective_due_date: string;
    days_late: number;
  };

  const [lateRows, setLateRows] = useState<LateItemRow[]>([]);
  const [lateLoading, setLateLoading] = useState(false);
  const [lateError, setLateError] = useState<string | null>(null);
  const [lateLoaded, setLateLoaded] = useState(false);
  const [latePreviewOpen, setLatePreviewOpen] = useState(true);
  const [lateStart, setLateStart] = useState<string>(toLocalISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [lateEnd, setLateEnd] = useState<string>(toLocalISODate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)));

  type HollowcoreExportRow = {
    cast_id: number;
    cast_date: string;
    status: string;
    bed_number: number;
    cast_slot_index: number;
    slab_thickness_mm: number;
    panel_length_mm: number;
    quantity: number;
    batch_id: string | null;
    project_id: number;
    project_name: string;
    project_due_date: string | null;
    element_id: number;
    element_mark: string;
    element_type: string;
    element_due_date: string | null;
    effective_due_date: string | null;
    is_late: boolean;
    days_late: number;
  };

  const [hcRows, setHcRows] = useState<HollowcoreExportRow[]>([]);
  const [hcLoading, setHcLoading] = useState(false);
  const [hcError, setHcError] = useState<string | null>(null);
  const [hcFrom, setHcFrom] = useState<string>(toLocalISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [hcTo, setHcTo] = useState<string>(toLocalISODate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)));
  const [hcStatus, setHcStatus] = useState<string>(""); // planned/completed or blank

  type ProjectSummaryRow = {
    project_id: number;
    project_name: string;
    client: string | null;
    status: string;
    start_date: string | null;
    due_date: string | null;
    days_to_due: number | null;
    element_count: number;
    element_qty_total: number;
    produced_qty_non_hollowcore: number;
    produced_qty_hollowcore: number;
    produced_qty_total: number;
    remaining_qty_est: number;
    last_scheduled_or_cast_date: string | null;
    is_late: boolean;
  };

  const [projectSummaryRows, setProjectSummaryRows] = useState<ProjectSummaryRow[]>([]);
  const [projectSummaryLoading, setProjectSummaryLoading] = useState(false);
  const [projectSummaryError, setProjectSummaryError] = useState<string | null>(null);

  const filteredCalRows = useMemo(() => {
    const s = calStart ? new Date(calStart) : null;
    const e = calEnd ? new Date(calEnd) : null;
    return (calRows ?? []).filter((r) => {
      const d = r.production_date ? new Date(r.production_date) : null;
      if (!d || Number.isNaN(d.getTime())) return false;
      if (s && d < s) return false;
      if (e && d > e) return false;
      return true;
    });
  }, [calEnd, calRows, calStart]);

  return (
    <Stack spacing={2}>
      <Dialog fullScreen open={viewerOpen} onClose={() => setViewerOpen(false)}>
        <AppBar position="sticky" elevation={0} color="default">
          <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 900, flexGrow: 1 }}>
              {viewerTitle}
            </Typography>
            <IconButton edge="end" onClick={() => setViewerOpen(false)} aria-label="Close report">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Stack sx={{ p: 2 }} spacing={2}>
          <ViewTable columns={viewerColumns} rows={viewerRows} emptyLabel={viewerEmptyLabel} maxRows={2000} />
        </Stack>
      </Dialog>

      <Stack>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View reports on-screen, with optional Excel export. Each report respects your role permissions and factory confidentiality.
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Dispatch note / truck load (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Export dispatch orders + items in a date range.
                </Typography>
              </Stack>

              {!canDispatch ? (
                <Alert severity="info">Only Dispatch/Admin can export dispatch notes.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="Start"
                      type="date"
                      size="small"
                      value={dispatchStart}
                      onChange={(e) => setDispatchStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="End"
                      type="date"
                      size="small"
                      value={dispatchEnd}
                      onChange={(e) => setDispatchEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setDispatchLoading(true);
                        setDispatchError(null);
                        setDispatchLoaded(false);
                        api
                          .get<DispatchNoteRow[]>("/dispatch/export-note", {
                            params: {
                              start_date: dispatchStart || undefined,
                              end_date: dispatchEnd || undefined,
                            },
                          })
                          .then((r) => {
                            setDispatchRows(r.data ?? []);
                            setDispatchLoaded(true);
                            setDispatchPreviewOpen(true);
                          })
                          .catch((e) => {
                            setDispatchError(formatError(e, "Failed to load dispatch export."));
                            setDispatchRows([]);
                          })
                          .finally(() => setDispatchLoading(false));
                      }}
                      disabled={dispatchLoading}
                    >
                      {dispatchLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          dispatchRows.map((r) => ({
                            "Dispatch #": r.dispatch_id,
                            "Dispatch date": r.dispatch_date,
                            "Truck": r.truck_number ?? "",
                            "Status": r.dispatch_status,
                            "Project": r.project_name,
                            "Element mark": r.element_mark,
                            "Element type": r.element_type,
                            "Yard location": r.yard_location,
                            "Qty loaded": r.dispatch_quantity,
                            "Yard qty after": r.yard_quantity_after,
                          })),
                          "Dispatch note",
                          `dispatch-note-${dispatchStart || "start"}-to-${dispatchEnd || "end"}.xlsx`
                        )
                      }
                      disabled={dispatchRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Dispatch note / truck load",
                          columns: [
                            { key: "dispatch_date", label: "Date" },
                            { key: "truck_number", label: "Truck" },
                            { key: "project_name", label: "Project" },
                            { key: "element_mark", label: "Element" },
                            { key: "yard_location", label: "Location" },
                            { key: "dispatch_quantity", label: "Qty", align: "right" },
                            { key: "dispatch_status", label: "Status" },
                          ],
                          rows: dispatchRows as unknown as Record<string, unknown>[],
                          emptyLabel: "No dispatch rows found for this date range.",
                        })
                      }
                      disabled={dispatchRows.length === 0}
                    >
                      View full screen
                    </Button>
                    {dispatchLoaded ? (
                      <Button variant="text" onClick={() => setDispatchPreviewOpen((v) => !v)}>
                        {dispatchPreviewOpen ? "Collapse" : "Expand"}
                      </Button>
                    ) : null}
                  </Stack>

                  {dispatchError ? <Alert severity="error">{dispatchError}</Alert> : null}
                  <Collapse in={!dispatchLoaded || dispatchPreviewOpen}>
                    <ViewTable
                      columns={[
                        { key: "dispatch_date", label: "Date" },
                        { key: "truck_number", label: "Truck" },
                        { key: "project_name", label: "Project" },
                        { key: "element_mark", label: "Element" },
                        { key: "yard_location", label: "Location" },
                        { key: "dispatch_quantity", label: "Qty", align: "right" },
                        { key: "dispatch_status", label: "Status" },
                      ]}
                      rows={dispatchRows as unknown as Record<string, unknown>[]}
                      emptyLabel={dispatchLoaded ? "No dispatch rows found for this date range." : "Load to view dispatch rows."}
                    />
                  </Collapse>
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Production completion (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Planned vs completed quantities per day (includes hollowcore).
                </Typography>
              </Stack>

              {!canPlanner && !canProduction ? (
                <Alert severity="info">Only Planner/Production/Admin can export production completion.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="Start"
                      type="date"
                      size="small"
                      value={completionStart}
                      onChange={(e) => setCompletionStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="End"
                      type="date"
                      size="small"
                      value={completionEnd}
                      onChange={(e) => setCompletionEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCompletionLoading(true);
                        setCompletionError(null);
                        setCompletionLoaded(false);
                        api
                          .get<ProductionCompletionRow[]>("/dashboard/production-completion", {
                            params: { start_date: completionStart || undefined, end_date: completionEnd || undefined },
                          })
                          .then((r) => {
                            setCompletionRows(r.data ?? []);
                            setCompletionLoaded(true);
                            setCompletionPreviewOpen(true);
                          })
                          .catch((e) => {
                            setCompletionError(formatError(e, "Failed to load production completion."));
                            setCompletionRows([]);
                          })
                          .finally(() => setCompletionLoading(false));
                      }}
                      disabled={completionLoading}
                    >
                      {completionLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          completionRows.map((r) => ({
                            "Date": r.date,
                            "Non-hollowcore planned qty": r.non_hollowcore_planned_qty,
                            "Non-hollowcore completed qty": r.non_hollowcore_completed_qty,
                            "Hollowcore planned qty": r.hollowcore_planned_qty,
                            "Hollowcore completed qty": r.hollowcore_completed_qty,
                            "Total planned qty": r.non_hollowcore_planned_qty + r.hollowcore_planned_qty,
                            "Total completed qty": r.non_hollowcore_completed_qty + r.hollowcore_completed_qty,
                          })),
                          "Production completion",
                          `production-completion-${completionStart || "start"}-to-${completionEnd || "end"}.xlsx`
                        )
                      }
                      disabled={completionRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Production completion",
                          columns: [
                            { key: "date", label: "Date" },
                            { key: "non_hollowcore_planned_qty", label: "NH planned", align: "right" },
                            { key: "non_hollowcore_completed_qty", label: "NH completed", align: "right" },
                            { key: "hollowcore_planned_qty", label: "HC planned", align: "right" },
                            { key: "hollowcore_completed_qty", label: "HC completed", align: "right" },
                          ],
                          rows: completionRows as unknown as Record<string, unknown>[],
                          emptyLabel: "No completion rows found for this date range.",
                        })
                      }
                      disabled={completionRows.length === 0}
                    >
                      View full screen
                    </Button>
                    {completionLoaded ? (
                      <Button variant="text" onClick={() => setCompletionPreviewOpen((v) => !v)}>
                        {completionPreviewOpen ? "Collapse" : "Expand"}
                      </Button>
                    ) : null}
                  </Stack>

                  {completionError ? <Alert severity="error">{completionError}</Alert> : null}
                  <Collapse in={!completionLoaded || completionPreviewOpen}>
                    <ViewTable
                      columns={[
                        { key: "date", label: "Date" },
                        { key: "non_hollowcore_planned_qty", label: "NH planned", align: "right" },
                        { key: "non_hollowcore_completed_qty", label: "NH completed", align: "right" },
                        { key: "hollowcore_planned_qty", label: "HC planned", align: "right" },
                        { key: "hollowcore_completed_qty", label: "HC completed", align: "right" },
                      ]}
                      rows={completionRows as unknown as Record<string, unknown>[]}
                      emptyLabel={completionLoaded ? "No completion rows found for this date range." : "Load to view completion per day."}
                    />
                  </Collapse>
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Late scheduled items (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Non-hollowcore schedule rows where production date is after element/project due date.
                </Typography>
              </Stack>

              {!canPlanner ? (
                <Alert severity="info">Only Planner/Admin can export late items.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="Start"
                      type="date"
                      size="small"
                      value={lateStart}
                      onChange={(e) => setLateStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="End"
                      type="date"
                      size="small"
                      value={lateEnd}
                      onChange={(e) => setLateEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setLateLoading(true);
                        setLateError(null);
                        setLateLoaded(false);
                        api
                          .get<LateItemRow[]>("/dashboard/late-items", {
                            params: { start_date: lateStart || undefined, end_date: lateEnd || undefined },
                          })
                          .then((r) => {
                            setLateRows(r.data ?? []);
                            setLateLoaded(true);
                            setLatePreviewOpen(true);
                          })
                          .catch((e) => {
                            setLateError(formatError(e, "Failed to load late items."));
                            setLateRows([]);
                          })
                          .finally(() => setLateLoading(false));
                      }}
                      disabled={lateLoading}
                    >
                      {lateLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          lateRows.map((r) => ({
                            "Days late": r.days_late,
                            "Production date": r.production_date,
                            "Status": r.status,
                            "Project": r.project_name,
                            "Project due date": r.project_due_date ?? "",
                            "Element mark": r.element_mark,
                            "Element type": r.element_type,
                            "Element due date": r.element_due_date ?? "",
                            "Effective due date": r.effective_due_date,
                            "Mould": r.mould,
                            "Quantity": r.quantity,
                            "Schedule ID": r.schedule_id,
                          })),
                          "Late items",
                          `late-items-${lateStart || "start"}-to-${lateEnd || "end"}.xlsx`
                        )
                      }
                      disabled={lateRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Late scheduled items",
                          columns: [
                            { key: "days_late", label: "Days late", align: "right" },
                            { key: "production_date", label: "Prod date" },
                            { key: "project_name", label: "Project" },
                            { key: "element_mark", label: "Element" },
                            { key: "mould", label: "Mould" },
                            { key: "quantity", label: "Qty", align: "right" },
                            { key: "status", label: "Status" },
                          ],
                          rows: lateRows as unknown as Record<string, unknown>[],
                          emptyLabel: "No late items found for this date range.",
                        })
                      }
                      disabled={lateRows.length === 0}
                    >
                      View full screen
                    </Button>
                    {lateLoaded ? (
                      <Button variant="text" onClick={() => setLatePreviewOpen((v) => !v)}>
                        {latePreviewOpen ? "Collapse" : "Expand"}
                      </Button>
                    ) : null}
                  </Stack>

                  {lateError ? <Alert severity="error">{lateError}</Alert> : null}
                  <Collapse in={!lateLoaded || latePreviewOpen}>
                    <ViewTable
                      columns={[
                        { key: "days_late", label: "Days late", align: "right" },
                        { key: "production_date", label: "Prod date" },
                        { key: "project_name", label: "Project" },
                        { key: "element_mark", label: "Element" },
                        { key: "mould", label: "Mould" },
                        { key: "quantity", label: "Qty", align: "right" },
                        { key: "status", label: "Status" },
                      ]}
                      rows={lateRows as unknown as Record<string, unknown>[]}
                      emptyLabel={lateLoaded ? "No late items found for this date range." : "Load to view late items."}
                    />
                  </Collapse>
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Hollowcore casts (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cast history by date/bed/slot with project and element details.
                </Typography>
              </Stack>

              {!canPlanner ? (
                <Alert severity="info">Only Planner/Admin can export hollowcore casts.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="From"
                      type="date"
                      size="small"
                      value={hcFrom}
                      onChange={(e) => setHcFrom(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="To"
                      type="date"
                      size="small"
                      value={hcTo}
                      onChange={(e) => setHcTo(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="Status"
                      size="small"
                      select
                      value={hcStatus}
                      onChange={(e) => setHcStatus(e.target.value)}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="planned">planned</MenuItem>
                      <MenuItem value="completed">completed</MenuItem>
                    </TextField>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setHcLoading(true);
                        setHcError(null);
                        type HcCastApiRow = {
                          id: number;
                          cast_date: string;
                          status: string;
                          bed_number?: number | null;
                          bed_id?: number | null;
                          cast_slot_index: number;
                          slab_thickness_mm: number;
                          panel_length_mm: number;
                          quantity: number;
                          batch_id?: string | null;
                          element_id: number;
                        };
                        type ElementMini = {
                          id: number;
                          element_mark?: string | null;
                          element_type?: string | null;
                          due_date?: string | null;
                          project_id?: number | null;
                        };

                        const toUtcMs = (iso: string | null | undefined) => {
                          if (!iso) return null;
                          const [y, m, d] = iso.slice(0, 10).split("-").map((x) => Number(x));
                          if (!y || !m || !d) return null;
                          return Date.UTC(y, m - 1, d);
                        };

                        Promise.all([
                          api.get<HcCastApiRow[]>("/hollowcore/casts", {
                            params: {
                              from_date: hcFrom || undefined,
                              to_date: hcTo || undefined,
                              status_filter: hcStatus || undefined,
                            },
                          }),
                          api.get<ElementMini[]>("/elements/", { params: { include_inactive: true } }),
                          api.get<Project[]>("/projects"),
                        ])
                          .then(([castsRes, elementsRes, projectsRes]) => {
                            const elements = elementsRes.data ?? [];
                            const projects = projectsRes.data ?? [];
                            const elementById = new Map(elements.map((e) => [Number(e.id), e] as const));
                            const projectById = new Map(projects.map((p) => [Number(p.id), p] as const));

                            const rows: HollowcoreExportRow[] = (castsRes.data ?? []).map((c) => {
                              const el = elementById.get(Number(c.element_id));
                              const pr = el?.project_id != null ? projectById.get(Number(el.project_id)) : undefined;
                              const effectiveDue = (el?.due_date ?? pr?.due_date ?? null) as string | null;
                              const castMs = toUtcMs(c.cast_date);
                              const dueMs = toUtcMs(effectiveDue);
                              const isLate = castMs != null && dueMs != null ? castMs > dueMs : false;
                              const daysLate =
                                isLate && castMs != null && dueMs != null
                                  ? Math.max(0, Math.floor((castMs - dueMs) / (24 * 60 * 60 * 1000)))
                                  : 0;
                              const bedNumber = Number(c.bed_number ?? c.bed_id ?? 0);

                              return {
                                cast_id: Number(c.id),
                                cast_date: c.cast_date,
                                status: c.status,
                                bed_number: bedNumber,
                                cast_slot_index: Number(c.cast_slot_index ?? 0),
                                slab_thickness_mm: Number(c.slab_thickness_mm ?? 0),
                                panel_length_mm: Number(c.panel_length_mm ?? 0),
                                quantity: Number(c.quantity ?? 0),
                                batch_id: c.batch_id ?? null,
                                project_id: Number(el?.project_id ?? 0),
                                project_name: String(pr?.project_name ?? ""),
                                project_due_date: (pr?.due_date ?? null) as string | null,
                                element_id: Number(c.element_id),
                                element_mark: String(el?.element_mark ?? ""),
                                element_type: String(el?.element_type ?? "Hollowcore"),
                                element_due_date: (el?.due_date ?? null) as string | null,
                                effective_due_date: effectiveDue,
                                is_late: isLate,
                                days_late: daysLate,
                              };
                            });
                            setHcRows(rows);
                          })
                          .catch((e) => {
                            setHcError(formatError(e, "Failed to load hollowcore casts."));
                            setHcRows([]);
                          })
                          .finally(() => setHcLoading(false));
                      }}
                      disabled={hcLoading}
                    >
                      {hcLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          hcRows.map((r) => ({
                            "Cast date": r.cast_date,
                            "Status": r.status,
                            "Project": r.project_name,
                            "Element mark": r.element_mark,
                            "Element type": r.element_type,
                            "Bed": r.bed_number,
                            "Slot": r.cast_slot_index,
                            "Thickness (mm)": r.slab_thickness_mm,
                            "Length (mm)": r.panel_length_mm,
                            "Quantity": r.quantity,
                            "Batch ID": r.batch_id ?? "",
                            "Due date": r.effective_due_date ?? "",
                            "Late?": r.is_late ? "YES" : "NO",
                            "Days late": r.days_late,
                          })),
                          "Hollowcore casts",
                          `hollowcore-casts-${hcFrom || "from"}-to-${hcTo || "to"}.xlsx`
                        )
                      }
                      disabled={hcRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Hollowcore casts",
                          columns: [
                            { key: "cast_date", label: "Cast date" },
                            { key: "project_name", label: "Project" },
                            { key: "element_mark", label: "Element" },
                            { key: "bed_number", label: "Bed", align: "right" },
                            { key: "cast_slot_index", label: "Slot", align: "right" },
                            { key: "quantity", label: "Qty", align: "right" },
                            { key: "status", label: "Status" },
                            { key: "days_late", label: "Late days", align: "right" },
                          ],
                          rows: hcRows as unknown as Record<string, unknown>[],
                          emptyLabel: "No hollowcore casts found for this filter.",
                        })
                      }
                      disabled={hcRows.length === 0}
                    >
                      View full screen
                    </Button>
                  </Stack>

                  {hcError ? <Alert severity="error">{hcError}</Alert> : null}
                  <ViewTable
                    columns={[
                      { key: "cast_date", label: "Cast date" },
                      { key: "project_name", label: "Project" },
                      { key: "element_mark", label: "Element" },
                      { key: "bed_number", label: "Bed", align: "right" },
                      { key: "cast_slot_index", label: "Slot", align: "right" },
                      { key: "quantity", label: "Qty", align: "right" },
                      { key: "status", label: "Status" },
                      { key: "days_late", label: "Late days", align: "right" },
                    ]}
                    rows={hcRows as unknown as Record<string, unknown>[]}
                    emptyLabel="Load to view hollowcore casts."
                  />
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Per-project summary (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High-level totals per project (elements, produced vs remaining, due date, late flag).
                </Typography>
              </Stack>

              {!canPlanner ? (
                <Alert severity="info">Only Planner/Admin can export per-project summaries.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setProjectSummaryLoading(true);
                        setProjectSummaryError(null);
                        api
                          .get<ProjectSummaryRow[]>("/dashboard/project-summaries")
                          .then((r) => setProjectSummaryRows(r.data ?? []))
                          .catch((e) => {
                            setProjectSummaryError(formatError(e, "Failed to load project summaries."));
                            setProjectSummaryRows([]);
                          })
                          .finally(() => setProjectSummaryLoading(false));
                      }}
                      disabled={projectSummaryLoading}
                    >
                      {projectSummaryLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          projectSummaryRows.map((r) => ({
                            "Project": r.project_name,
                            "Client": r.client ?? "",
                            "Status": r.status,
                            "Start date": r.start_date ?? "",
                            "Due date": r.due_date ?? "",
                            "Days to due": r.days_to_due ?? "",
                            "Element count": r.element_count,
                            "Element qty total": r.element_qty_total,
                            "Produced qty (non-hollowcore)": r.produced_qty_non_hollowcore,
                            "Produced qty (hollowcore)": r.produced_qty_hollowcore,
                            "Produced qty (total)": r.produced_qty_total,
                            "Remaining qty (est.)": r.remaining_qty_est,
                            "Last scheduled/cast date": r.last_scheduled_or_cast_date ?? "",
                            "Late?": r.is_late ? "YES" : "NO",
                          })),
                          "Project summaries",
                          `project-summaries-${toLocalISODate()}.xlsx`
                        )
                      }
                      disabled={projectSummaryRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Per-project summary",
                          columns: [
                            { key: "project_name", label: "Project" },
                            { key: "client", label: "Client" },
                            { key: "due_date", label: "Due" },
                            { key: "days_to_due", label: "Days to due", align: "right" },
                            { key: "element_qty_total", label: "Qty total", align: "right" },
                            { key: "produced_qty_total", label: "Produced", align: "right" },
                            { key: "remaining_qty_est", label: "Remaining", align: "right" },
                            { key: "is_late", label: "Late?" },
                          ],
                          rows: (projectSummaryRows as unknown as Record<string, unknown>[]).map((r) => ({
                            ...r,
                            is_late: (r as any).is_late ? "YES" : "NO",
                          })),
                          emptyLabel: "No projects found for this factory.",
                        })
                      }
                      disabled={projectSummaryRows.length === 0}
                    >
                      View full screen
                    </Button>
                  </Stack>

                  {projectSummaryError ? <Alert severity="error">{projectSummaryError}</Alert> : null}
                  <ViewTable
                    columns={[
                      { key: "project_name", label: "Project" },
                      { key: "client", label: "Client" },
                      { key: "due_date", label: "Due" },
                      { key: "days_to_due", label: "Days to due", align: "right" },
                      { key: "element_qty_total", label: "Qty total", align: "right" },
                      { key: "produced_qty_total", label: "Produced", align: "right" },
                      { key: "remaining_qty_est", label: "Remaining", align: "right" },
                      { key: "is_late", label: "Late?" },
                    ]}
                    rows={(projectSummaryRows as unknown as Record<string, unknown>[]).map((r) => ({
                      ...r,
                      is_late: (r as any).is_late ? "YES" : "NO",
                    }))}
                    emptyLabel="Load to view per-project summaries."
                  />
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Yard stock (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current yard inventory by element + location.
                </Typography>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setYardLoading(true);
                    setYardError(null);
                    setYardLoaded(false);
                    api
                      .get<YardStockRow[]>("/dashboard/yard-stock")
                      .then((r) => {
                        setYardRows(r.data ?? []);
                        setYardLoaded(true);
                        setYardPreviewOpen(true);
                      })
                      .catch((e) => {
                        setYardError(formatError(e, "Failed to load yard stock."));
                        setYardRows([]);
                      })
                      .finally(() => setYardLoading(false));
                  }}
                  disabled={yardLoading}
                >
                  {yardLoading ? "Loading..." : "Load"}
                </Button>
                <Button
                  variant="contained"
                  onClick={() =>
                    exportRowsToExcel(
                      yardRows.map((r) => ({
                        "Element type": r.element_type,
                        "Element mark": r.element_mark,
                        "Location": r.location,
                        "Quantity": r.quantity,
                      })),
                      "Yard stock",
                      `yard-stock-${toLocalISODate()}.xlsx`
                    )
                  }
                  disabled={yardRows.length === 0}
                >
                  Export
                </Button>
                <Button
                  variant="text"
                  onClick={() =>
                    openViewer({
                      title: "Yard stock",
                      columns: [
                        { key: "element_mark", label: "Element" },
                        { key: "element_type", label: "Type" },
                        { key: "location", label: "Location" },
                        { key: "quantity", label: "Qty", align: "right" },
                      ],
                      rows: yardRows as unknown as Record<string, unknown>[],
                      emptyLabel: "No yard stock rows found.",
                    })
                  }
                  disabled={yardRows.length === 0}
                >
                  View full screen
                </Button>
                {yardLoaded ? (
                  <Button variant="text" onClick={() => setYardPreviewOpen((v) => !v)}>
                    {yardPreviewOpen ? "Collapse" : "Expand"}
                  </Button>
                ) : null}
              </Stack>

              {yardError ? <Alert severity="error">{yardError}</Alert> : null}
              <Collapse in={!yardLoaded || yardPreviewOpen}>
                <ViewTable
                  columns={[
                    { key: "element_mark", label: "Element" },
                    { key: "element_type", label: "Type" },
                    { key: "location", label: "Location" },
                    { key: "quantity", label: "Qty", align: "right" },
                  ]}
                  rows={yardRows as unknown as Record<string, unknown>[]}
                  emptyLabel={yardLoaded ? "No yard stock rows found." : "Load to view yard stock."}
                />
              </Collapse>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Production calendar (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Export scheduled production rows in a date range.
                </Typography>
              </Stack>

              {!canPlanner ? (
                <Alert severity="info">Only Planner/Admin can export the production calendar.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="Start"
                      type="date"
                      size="small"
                      value={calStart}
                      onChange={(e) => setCalStart(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <TextField
                      label="End"
                      type="date"
                      size="small"
                      value={calEnd}
                      onChange={(e) => setCalEnd(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ width: { xs: "100%", sm: 180 }, minWidth: 0 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setCalLoading(true);
                        setCalError(null);
                        setCalLoaded(false);
                        api
                          .get<ProductionCalendarRow[]>("/dashboard/calendar")
                          .then((r) => {
                            setCalRows(r.data ?? []);
                            setCalLoaded(true);
                            setCalPreviewOpen(true);
                          })
                          .catch((e) => {
                            setCalError(formatError(e, "Failed to load production calendar."));
                            setCalRows([]);
                          })
                          .finally(() => setCalLoading(false));
                      }}
                      disabled={calLoading}
                    >
                      {calLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          filteredCalRows.map((r) => ({
                            "Date": r.production_date,
                            "Mould": r.mould,
                            "Project": r.project_name,
                            "Element type": r.element_type,
                            "Element mark": r.element_mark,
                            "Batch ID": r.batch_id ?? "",
                            "Quantity": r.quantity,
                            "Status": r.status,
                          })),
                          "Production calendar",
                          `production-calendar-${calStart || "start"}-to-${calEnd || "end"}.xlsx`
                        )
                      }
                      disabled={filteredCalRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "Production calendar",
                          columns: [
                            { key: "production_date", label: "Date" },
                            { key: "mould", label: "Mould" },
                            { key: "project_name", label: "Project" },
                            { key: "element_mark", label: "Element" },
                            { key: "quantity", label: "Qty", align: "right" },
                            { key: "status", label: "Status" },
                          ],
                          rows: filteredCalRows as unknown as Record<string, unknown>[],
                          emptyLabel: "No production calendar rows found for this date range.",
                        })
                      }
                      disabled={filteredCalRows.length === 0}
                    >
                      View full screen
                    </Button>
                    {calLoaded ? (
                      <Button variant="text" onClick={() => setCalPreviewOpen((v) => !v)}>
                        {calPreviewOpen ? "Collapse" : "Expand"}
                      </Button>
                    ) : null}
                  </Stack>

                  {calError ? <Alert severity="error">{calError}</Alert> : null}
                  <Collapse in={!calLoaded || calPreviewOpen}>
                    <ViewTable
                      columns={[
                        { key: "production_date", label: "Date" },
                        { key: "mould", label: "Mould" },
                        { key: "project_name", label: "Project" },
                        { key: "element_mark", label: "Element" },
                        { key: "quantity", label: "Qty", align: "right" },
                        { key: "status", label: "Status" },
                      ]}
                      rows={filteredCalRows as unknown as Record<string, unknown>[]}
                      emptyLabel={
                        calLoaded
                          ? "No production calendar rows found for this date range."
                          : "Load to view production calendar rows."
                      }
                    />
                  </Collapse>
                </>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  QC results by project (Excel)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Export cube test results for a selected project.
                </Typography>
              </Stack>

              {!canQc ? (
                <Alert severity="info">Only QC/Admin can export QC results.</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                      label="Project"
                      size="small"
                      select
                      value={projectForQc}
                      onChange={(e) => {
                        const next = e.target.value === "" ? "" : Number(e.target.value);
                        setProjectForQc(next);
                        setQcRows([]);
                      }}
                      sx={{ minWidth: 0, width: { xs: "100%", sm: 280 } }}
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
                        if (projectForQc === "") return;
                        setQcLoading(true);
                        setQcError(null);
                        api
                          .get<QcProjectResultRow[]>("/qc/results", { params: { project_id: Number(projectForQc) } })
                          .then((r) => setQcRows(r.data ?? []))
                          .catch((e) => {
                            setQcError(formatError(e, "Failed to load QC results."));
                            setQcRows([]);
                          })
                          .finally(() => setQcLoading(false));
                      }}
                      disabled={projectForQc === "" || qcLoading}
                    >
                      {qcLoading ? "Loading..." : "Load"}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        exportRowsToExcel(
                          qcRows.map((r) => ({
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
                          })),
                          "QC Results",
                          `qc-results-project-${projectForQc}.xlsx`
                        )
                      }
                      disabled={qcRows.length === 0}
                    >
                      Export
                    </Button>
                    <Button
                      variant="text"
                      onClick={() =>
                        openViewer({
                          title: "QC results by project",
                          columns: [
                            { key: "test_date", label: "Test date" },
                            { key: "batch_id", label: "Batch" },
                            { key: "element_mark", label: "Element" },
                            { key: "age_days", label: "Age", align: "right" },
                            { key: "measured_strength_mpa", label: "Measured", align: "right" },
                            { key: "required_strength_mpa", label: "Required", align: "right" },
                            { key: "passed", label: "Passed" },
                          ],
                          rows: (qcRows as unknown as Record<string, unknown>[]).map((r) => ({
                            ...r,
                            passed:
                              (r as any).passed === true
                                ? "PASS"
                                : (r as any).passed === false
                                ? "FAIL"
                                : "PENDING",
                          })),
                          emptyLabel: "No QC results found for this project.",
                        })
                      }
                      disabled={qcRows.length === 0}
                    >
                      View full screen
                    </Button>
                  </Stack>

                  {qcError ? <Alert severity="error">{qcError}</Alert> : null}
                  <ViewTable
                    columns={[
                      { key: "test_date", label: "Test date" },
                      { key: "batch_id", label: "Batch" },
                      { key: "element_mark", label: "Element" },
                      { key: "age_days", label: "Age", align: "right" },
                      { key: "measured_strength_mpa", label: "Measured", align: "right" },
                      { key: "required_strength_mpa", label: "Required", align: "right" },
                      { key: "passed", label: "Passed" },
                    ]}
                    rows={(qcRows as unknown as Record<string, unknown>[]).map((r) => ({
                      ...r,
                      passed:
                        (r as any).passed === true ? "PASS" : (r as any).passed === false ? "FAIL" : "PENDING",
                    }))}
                    emptyLabel="Load to view QC results."
                  />
                </>
              )}

            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}

