// File overview: Page component and UI logic for pages/Dashboard.tsx.
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Paper,
  Typography,
  Grid,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { PieChart, Pie, Tooltip, Cell, ResponsiveContainer } from "recharts";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { DashboardOverview, DashboardPlannedByTypeItem } from "../types/api";

// Inputs: caller state/arguments related to dashboard.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Dashboard() {
  const { user } = useAuth();
  const [attentionDetailsOpen, setAttentionDetailsOpen] = useState(false);
  const role = user?.role;

  const { data: overview, isPending: overviewLoading, isError: overviewError } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: async () => (await api.get<DashboardOverview>("/dashboard/overview")).data,
  });

  const { data: plannedByType = [], isPending: plannedByTypeLoading } = useQuery({
    queryKey: ["dashboard", "planned-by-type", overview?.today ?? ""],
    queryFn: async () =>
      (
        await api.get<DashboardPlannedByTypeItem[]>("/dashboard/planned-by-type", {
          params: { date: overview!.today },
        })
      ).data ?? [],
    enabled: Boolean(overview?.today),
  });

  const errorMessage = overviewError ? "Failed to load dashboard data" : null;

  const kpis = overview
    ? [
        { label: "Today’s units", value: overview.todays_units },
        { label: "Today’s casts", value: overview.todays_schedules },
        { label: "Completed today", value: overview.todays_completed },
        {
          label: "Late scheduled items",
          value: overview.late_scheduled_items + overview.hollowcore_late_elements,
        },
        {
          label: "Unscheduled elements",
          value: overview.unscheduled_elements + overview.hollowcore_unscheduled_elements,
        },
      ]
    : [];

  const piePalette = ["#1976d2", "#ff9800", "#43a047", "#e91e63", "#9c27b0", "#0097a7", "#795548"];
  const pieData = plannedByType.map((d, idx) => ({
    name: d.label,
    value: d.value,
    color: piePalette[idx % piePalette.length],
  }));

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          Precast Manager Dashboard
        </Typography>
        {overviewLoading && <Typography variant="body2">Loading...</Typography>}
        {!overviewLoading && errorMessage && (
          <Typography variant="body2" color="error">
            {errorMessage}
          </Typography>
        )}
      </Grid>

      {!overviewLoading && !overviewError && overview && (
        <>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {kpis.map((k) => (
                <Grid key={k.label} item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="overline" color="text.secondary">
                        {k.label}
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        {k.value}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
                  Next steps
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Shortcuts based on your role and current factory snapshot.
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
                  <Chip
                    component={RouterLink}
                    to="/activity"
                    clickable
                    label="Activity log"
                    color="primary"
                    variant="outlined"
                  />
                  {(role === "yard" || role === "admin") && (
                    <Chip
                      component={RouterLink}
                      to="/yard"
                      clickable
                      label={`Yard inventory (${overview.yard_inventory_lines ?? 0} lines)`}
                      variant="outlined"
                    />
                  )}
                  {(role === "dispatch" || role === "admin") && (
                    <>
                      <Chip
                        component={RouterLink}
                        to="/dispatch"
                        clickable
                        label={`Open dispatches (${overview.dispatch_orders_planned ?? 0} planned)`}
                        variant="outlined"
                      />
                      {(overview.dispatch_orders_planned_with_items ?? 0) > 0 ? (
                        <Chip
                          component={RouterLink}
                          to="/dispatch"
                          clickable
                          label={`${overview.dispatch_orders_planned_with_items} with line items`}
                          color="info"
                          variant="outlined"
                        />
                      ) : null}
                    </>
                  )}
                  {(role === "QC" || role === "admin") && (overview.qc_lab_overdue ?? 0) > 0 ? (
                    <Chip
                      component={RouterLink}
                      to="/qc"
                      clickable
                      label={`QC lab: ${overview.qc_lab_overdue} overdue`}
                      color="error"
                      variant="outlined"
                    />
                  ) : null}
                  {(role === "QC" || role === "admin") && (overview.qc_lab_due_today ?? 0) > 0 ? (
                    <Chip
                      component={RouterLink}
                      to="/qc"
                      clickable
                      label={`QC lab: ${overview.qc_lab_due_today} due today`}
                      color="warning"
                      variant="outlined"
                    />
                  ) : null}
                  {(role === "QC" || role === "admin") && (overview.qc_lab_due_tomorrow ?? 0) > 0 ? (
                    <Chip
                      component={RouterLink}
                      to="/qc"
                      clickable
                      label={`QC lab: ${overview.qc_lab_due_tomorrow} due tomorrow`}
                      color="info"
                      variant="outlined"
                    />
                  ) : null}
                  {(role === "QC" || role === "admin") && (overview.qc_manual_results_pending ?? 0) > 0 ? (
                    <Chip
                      component={RouterLink}
                      to="/qc"
                      clickable
                      label={`QC: ${overview.qc_manual_results_pending} results to enter`}
                      color="warning"
                      variant="outlined"
                    />
                  ) : null}
                  {(role === "planner" || role === "admin") &&
                  (overview.hollowcore_planned_casts_today ?? 0) > 0 ? (
                    <Chip
                      component={RouterLink}
                      to="/hollowcore/casts"
                      clickable
                      label={`${overview.hollowcore_planned_casts_today} hollowcore casts planned today`}
                      variant="outlined"
                    />
                  ) : null}
                  {(role === "production" || role === "admin") &&
                  overview.todays_schedules > overview.todays_completed ? (
                    <Chip
                      component={RouterLink}
                      to="/production"
                      clickable
                      label={`Production: ${overview.todays_schedules - overview.todays_completed} items left today`}
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {(overview.late_scheduled_items > 0 ||
            overview.unscheduled_elements > 0 ||
            overview.projects_at_risk.length > 0 ||
            overview.hollowcore_late_elements > 0 ||
            overview.hollowcore_unscheduled_elements > 0) && (
            <Grid item xs={12}>
              <Alert severity="warning">
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Attention needed:
                  </Typography>
                  {overview.late_scheduled_items > 0 && (
                    <Chip label={`${overview.late_scheduled_items} late scheduled`} color="warning" size="small" />
                  )}
                  {overview.unscheduled_elements > 0 && (
                    <Chip label={`${overview.unscheduled_elements} unscheduled elements`} color="warning" size="small" />
                  )}
                  {overview.projects_at_risk.length > 0 && (
                    <Chip label={`${overview.projects_at_risk.length} projects at risk`} color="warning" size="small" />
                  )}
                  {overview.hollowcore_late_elements > 0 && (
                    <Chip
                      label={`${overview.hollowcore_late_elements} hollowcore late`}
                      color="warning"
                      size="small"
                    />
                  )}
                  {overview.hollowcore_unscheduled_elements > 0 && (
                    <Chip
                      label={`${overview.hollowcore_unscheduled_elements} hollowcore unscheduled`}
                      color="warning"
                      size="small"
                    />
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setAttentionDetailsOpen(true)}
                    sx={{ ml: "auto" }}
                  >
                    Show details
                  </Button>
                </Stack>
              </Alert>
            </Grid>
          )}
        </>
      )}

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Projects at risk
          </Typography>
          {!overview || overview.projects_at_risk.length === 0 ? (
            <Typography variant="body2">No projects currently flagged as at risk.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell>Last scheduled</TableCell>
                  <TableCell align="right">Days late</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.projects_at_risk.map((p) => (
                  <TableRow key={p.project_id}>
                    <TableCell>{p.project_name}</TableCell>
                    <TableCell>{p.due_date}</TableCell>
                    <TableCell>{p.last_scheduled_date}</TableCell>
                    <TableCell align="right">
                      <Chip label={`${p.days_late}`} color="error" size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Production planned for {overview?.today ?? "today"}
          </Typography>
          {plannedByTypeLoading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : pieData.length === 0 ? (
            <Typography variant="body2">No planned production for this day.</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip formatter={(value: number, name: string) => [`${value} units`, name]} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </Grid>

      {overview && (
        <AttentionDetailsDialog
          open={attentionDetailsOpen}
          onClose={() => setAttentionDetailsOpen(false)}
          overview={overview}
        />
      )}
    </Grid>
  );
}

// Details modal for the "Attention needed" dashboard alert.
function AttentionDetailsDialog(props: {
  open: boolean;
  onClose: () => void;
  overview: DashboardOverview;
}) {
  const { open, onClose, overview } = props;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Attention needed - details</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {overview.late_scheduled_items > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Late scheduled items ({overview.late_scheduled_items})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Go to <b>Production Line</b> to see the cards marked <b>Over due</b>.
              </Typography>
            </Stack>
          )}

          {overview.unscheduled_elements > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Unscheduled elements ({overview.unscheduled_elements})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Go to <b>Planner</b> to view unscheduled elements after generating a plan.
              </Typography>
            </Stack>
          )}

          {overview.projects_at_risk.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Projects at risk
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Project</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Last scheduled</TableCell>
                    <TableCell align="right">Days late</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.projects_at_risk.map((p) => (
                    <TableRow key={p.project_id}>
                      <TableCell>{p.project_name}</TableCell>
                      <TableCell>{p.due_date}</TableCell>
                      <TableCell>{p.last_scheduled_date}</TableCell>
                      <TableCell align="right">
                        <Chip label={`${p.days_late}`} color="error" size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}

          {overview.hollowcore_late_elements > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Hollowcore late elements ({overview.hollowcore_late_elements})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Open <b>Hollowcore planning</b> to see cast cards marked <b>past due</b>.
              </Typography>
            </Stack>
          )}

          {overview.hollowcore_unscheduled_elements > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Hollowcore unscheduled elements ({overview.hollowcore_unscheduled_elements})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The dashboard compares each element&apos;s <b>order quantity</b> to <b>committed</b> hollowcore casts (rows
                saved in the database). <b>Generate plan</b> only builds a draft in your browser — click{" "}
                <b>Commit plan</b> in Hollowcore Planner to update the database; until then, this alert may stay on.
              </Typography>
              {(overview.hollowcore_unscheduled_detail?.length ?? 0) > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Element</TableCell>
                      <TableCell align="right">Order qty</TableCell>
                      <TableCell align="right">In DB (casts)</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(overview.hollowcore_unscheduled_detail ?? []).map((row) => (
                      <TableRow key={row.element_id}>
                        <TableCell>{row.element_mark}</TableCell>
                        <TableCell align="right">{row.order_quantity}</TableCell>
                        <TableCell align="right">{row.scheduled_quantity}</TableCell>
                        <TableCell align="right">{row.remaining}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            // Simple navigation approach: keep dependencies minimal.
            window.location.href = "/production";
          }}
          disabled={overview.late_scheduled_items === 0}
        >
          Open Production Line
        </Button>
        <Button
          onClick={() => {
            window.location.href = "/planner";
          }}
          disabled={overview.unscheduled_elements === 0}
        >
          Open Planner
        </Button>
        <Button
          onClick={() => {
            window.location.href = "/hollowcore";
          }}
          disabled={overview.hollowcore_late_elements === 0 && overview.hollowcore_unscheduled_elements === 0}
        >
          Open Hollowcore
        </Button>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

