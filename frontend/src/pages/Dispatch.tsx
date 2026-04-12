import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TextField,
  Button,
  Stack,
  MenuItem,
  Grid,
  Chip,
  Divider,
  Box,
  CircularProgress,
  LinearProgress,
  Card,
  CardContent,
  useTheme,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import api from "../api/client";
import type { DispatchDetail, DispatchOrder } from "../types/api";
import { PROJECTS_OPTIONS_KEY, fetchProjectsOptions } from "./elementsQuery";
import { DISPATCH_ORDERS_KEY, fetchDispatchOrders } from "./dispatchQuery";
import { YARD_INVENTORY_KEY, fetchYardInventory } from "./yardQuery";
import { useNotify } from "../notifications/NotifyContext";

function dispatchApiError(err: unknown, fallback: string) {
  const anyErr = err as { response?: { data?: { detail?: string; error?: string } } };
  return anyErr?.response?.data?.detail || anyErr?.response?.data?.error || fallback;
}

export default function Dispatch() {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const notify = useNotify();
  const qc = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: DISPATCH_ORDERS_KEY,
    queryFn: fetchDispatchOrders,
  });

  const yardQuery = useQuery({
    queryKey: YARD_INVENTORY_KEY,
    queryFn: fetchYardInventory,
  });

  const projectsQuery = useQuery({
    queryKey: PROJECTS_OPTIONS_KEY,
    queryFn: fetchProjectsOptions,
    staleTime: 60_000,
  });

  const orders = ordersQuery.data ?? [];
  const yard = yardQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const [selectedDispatchId, setSelectedDispatchId] = useState<number | "">("");
  const detailId = selectedDispatchId === "" ? null : Number(selectedDispatchId);

  const dispatchDetailQuery = useQuery({
    queryKey: ["dispatch", "detail", detailId] as const,
    queryFn: async () => {
      const { data } = await api.get<DispatchDetail>(`/dispatch/${detailId}`);
      return data.items;
    },
    enabled: detailId != null && !Number.isNaN(detailId),
  });

  const dispatchItems = dispatchDetailQuery.data ?? [];

  const [addItemForm, setAddItemForm] = useState({
    yard_inventory_id: "",
    quantity: "",
  });
  const [form, setForm] = useState({
    project_id: "",
    truck_number: "",
    dispatch_date: "",
  });
  const [projectFilter, setProjectFilter] = useState<number | "all">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [yardSearch, setYardSearch] = useState("");

  const invalidateDispatchData = async (dispatchId: number | null) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: DISPATCH_ORDERS_KEY }),
      qc.invalidateQueries({ queryKey: YARD_INVENTORY_KEY }),
    ]);
    if (dispatchId != null) {
      await qc.invalidateQueries({ queryKey: ["dispatch", "detail", dispatchId] });
    }
  };

  const createDispatchMutation = useMutation({
    mutationFn: async (payload: { project_id: number; dispatch_date: string; truck_number: string }) => {
      const { data } = await api.post<DispatchOrder>("/dispatch/create", null, {
        params: {
          project_id: payload.project_id,
          dispatch_date: payload.dispatch_date,
          truck_number: payload.truck_number,
        },
      });
      return data;
    },
    onSuccess: async (data) => {
      setSelectedDispatchId(data.id);
      await invalidateDispatchData(data.id);
      setForm({ project_id: "", truck_number: "", dispatch_date: "" });
    },
    onError: () => notify.error("Failed to create dispatch order"),
  });

  const addDispatchItemMutation = useMutation({
    mutationFn: async (vars: { dispatch_id: number; yard_inventory_id: number; quantity: number }) => {
      await api.post("/dispatch/add-item", null, {
        params: {
          dispatch_id: vars.dispatch_id,
          yard_inventory_id: vars.yard_inventory_id,
          quantity: vars.quantity,
        },
      });
    },
    onSuccess: async (_, vars) => {
      setAddItemForm({ yard_inventory_id: "", quantity: "" });
      await invalidateDispatchData(vars.dispatch_id);
    },
    onError: (err) => notify.error(dispatchApiError(err, "Failed to add item to dispatch")),
  });

  const updateDispatchStatusMutation = useMutation({
    mutationFn: async (vars: { dispatch_id: number; next: "completed" | "cancelled" | "reopen" }) => {
      const endpointByStatus: Record<typeof vars.next, string> = {
        completed: "complete",
        cancelled: "cancel",
        reopen: "reopen",
      };
      await api.post(`/dispatch/${vars.dispatch_id}/${endpointByStatus[vars.next]}`);
    },
    onSuccess: async (_, vars) => {
      await invalidateDispatchData(vars.dispatch_id);
    },
    onError: (err, vars) =>
      notify.error(dispatchApiError(err, `Failed to update dispatch status (${vars.next})`)),
  });

  const removeDispatchItemMutation = useMutation({
    mutationFn: async (vars: { dispatch_item_id: number; dispatch_id: number }) => {
      await api.post("/dispatch/remove-item", null, {
        params: { dispatch_item_id: vars.dispatch_item_id },
      });
    },
    onSuccess: async (_, vars) => {
      await invalidateDispatchData(vars.dispatch_id);
    },
    onError: (err) => notify.error(dispatchApiError(err, "Failed to remove item from dispatch")),
  });

  const dispatchMutating =
    createDispatchMutation.isPending ||
    addDispatchItemMutation.isPending ||
    updateDispatchStatusMutation.isPending ||
    removeDispatchItemMutation.isPending;

  const pageLoading = ordersQuery.isPending || yardQuery.isPending || projectsQuery.isPending;
  const refetchingLists =
    (ordersQuery.isFetching && !ordersQuery.isPending) || (yardQuery.isFetching && !yardQuery.isPending);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDispatchMutation.mutate({
      project_id: Number(form.project_id),
      dispatch_date: form.dispatch_date,
      truck_number: form.truck_number,
    });
  };

  const addItem = () => {
    if (selectedDispatchId === "") {
      notify.warning("Select a dispatch order first");
      return;
    }
    const yardId = Number(addItemForm.yard_inventory_id);
    const qty = Number(addItemForm.quantity);
    if (!yardId || !qty) return;

    addDispatchItemMutation.mutate({
      dispatch_id: Number(selectedDispatchId),
      yard_inventory_id: yardId,
      quantity: qty,
    });
  };

  const updateDispatchStatus = (nextStatus: "completed" | "cancelled" | "reopen") => {
    if (selectedDispatchId === "") {
      notify.warning("Select a dispatch order first");
      return;
    }
    if (
      nextStatus === "cancelled" &&
      !window.confirm("Cancel this dispatch order? You can reopen it later.")
    ) {
      return;
    }

    updateDispatchStatusMutation.mutate({
      dispatch_id: Number(selectedDispatchId),
      next: nextStatus,
    });
  };

  const removeItem = (dispatchItemId: number) => {
    if (selectedDispatchId === "") return;
    if (!window.confirm("Remove this item from the dispatch and return quantity to yard stock?")) {
      return;
    }
    removeDispatchItemMutation.mutate({
      dispatch_item_id: dispatchItemId,
      dispatch_id: Number(selectedDispatchId),
    });
  };

  const projectById = new Map(projects.map((p) => [p.id, p] as const));
  const yardById = new Map(yard.map((y) => [y.yard_inventory_id, y] as const));

  const filteredYard = yard.filter((y) => {
    if (projectFilter === "all") return true;
    return y.project_id === projectFilter;
  });
  const filteredYardBySearch = filteredYard.filter((y) => {
    const q = yardSearch.trim().toLowerCase();
    if (!q) return true;
    const haystack = `${y.project_name} ${y.element_mark} ${y.element_type} ${y.location}`.toLowerCase();
    return haystack.includes(q);
  });
  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    const projectName = projectById.get(o.project_id ?? -1)?.project_name ?? "";
    const haystack = `#${o.id} ${projectName} ${o.truck_number ?? ""} ${o.dispatch_date} ${o.status ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });

  const selectedOrder =
    selectedDispatchId === ""
      ? null
      : orders.find((o) => o.id === Number(selectedDispatchId)) ?? null;
  const canEditSelectedDispatch = selectedOrder?.status === "planned";
  const selectedProjectName =
    selectedOrder == null ? "" : projectById.get(selectedOrder.project_id ?? -1)?.project_name ?? "No project";
  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  return (
    <Paper sx={{ p: 2 }}>
      {refetchingLists ? <LinearProgress sx={{ mb: 2, mt: -1, borderRadius: 1 }} /> : null}
      <Typography variant="h5" gutterBottom>
        Dispatch Planning
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Create a dispatch order, load items from yard stock, then complete or cancel when ready.
      </Typography>

      {ordersQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load dispatch orders.
        </Alert>
      ) : null}
      {yardQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load yard inventory.
        </Alert>
      ) : null}
      {projectsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load projects.
        </Alert>
      ) : null}
      {detailId != null && dispatchDetailQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load dispatch line items.
        </Alert>
      ) : null}

      {pageLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip label="Planned" size="small" color="default" variant="outlined" />
        <Chip label="Completed" size="small" color="success" variant="outlined" />
        <Chip label="Cancelled" size="small" color="error" variant="outlined" />
      </Stack>

      <Grid container spacing={2}>
        {/* Left: orders list + create */}
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              1) Create dispatch order
            </Typography>
            <form onSubmit={handleSubmit}>
              <Stack spacing={1.5}>
                <TextField
                  label="Project"
                  name="project_id"
                  size="medium"
                  select
                  value={form.project_id}
                  onChange={handleChange}
                  fullWidth
                >
                  <MenuItem value="">Select project…</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.project_name}
                    </MenuItem>
                  ))}
                </TextField>
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    label="Truck Number"
                    name="truck_number"
                    size="medium"
                    value={form.truck_number}
                    onChange={handleChange}
                    fullWidth
                  />
                  <TextField
                    label="Dispatch Date"
                    name="dispatch_date"
                    type="date"
                    size="medium"
                    InputLabelProps={{ shrink: true }}
                    value={form.dispatch_date}
                    onChange={handleChange}
                    fullWidth
                  />
                </Stack>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ alignSelf: "flex-start", minHeight: 44, px: 2 }}
                  disabled={dispatchMutating}
                >
                  Create order
                </Button>
              </Stack>
            </form>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              2) Select dispatch order
            </Typography>
            <TextField
              label="Search dispatch orders"
              size="medium"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              fullWidth
              sx={{ mb: 1.5 }}
            />
            {isNarrow ? (
              <Stack spacing={1.25}>
                {filteredOrders.map((o) => {
                  const proj = projectById.get(o.project_id ?? -1);
                  const selected = selectedDispatchId !== "" && o.id === Number(selectedDispatchId);
                  return (
                    <Card
                      key={o.id}
                      variant="outlined"
                      onClick={() => setSelectedDispatchId(o.id)}
                      sx={{
                        cursor: "pointer",
                        borderColor: selected ? "primary.main" : "divider",
                        borderWidth: selected ? 2 : 1,
                      }}
                    >
                      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Stack spacing={0.75}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                              #{o.id}
                            </Typography>
                            <Chip
                              label={o.status ?? "planned"}
                              size="small"
                              color={
                                o.status === "completed"
                                  ? "success"
                                  : o.status === "cancelled"
                                  ? "error"
                                  : "default"
                              }
                            />
                          </Stack>
                          <Typography variant="body2">{proj?.project_name ?? o.project_id ?? "-"}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {o.dispatch_date}
                            {o.truck_number ? ` · Truck ${o.truck_number}` : ""}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Updated {formatDateTime(o.status_changed_at) ?? "—"}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>Truck</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.map((o) => {
                      const proj = projectById.get(o.project_id ?? -1);
                      const selected = selectedDispatchId !== "" && o.id === Number(selectedDispatchId);
                      return (
                        <TableRow
                          key={o.id}
                          hover
                          selected={selected}
                          sx={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedDispatchId(o.id);
                          }}
                        >
                          <TableCell>#{o.id}</TableCell>
                          <TableCell>{proj?.project_name ?? o.project_id ?? "-"}</TableCell>
                          <TableCell>{o.truck_number ?? "-"}</TableCell>
                          <TableCell>{o.dispatch_date}</TableCell>
                          <TableCell>
                            <Chip
                              label={o.status ?? "planned"}
                              size="small"
                              color={
                                o.status === "completed"
                                  ? "success"
                                  : o.status === "cancelled"
                                  ? "error"
                                  : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>{formatDateTime(o.status_changed_at) ?? "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* Right: selected order load planner */}
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              3) Load truck
            </Typography>
            {selectedOrder == null ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                Select a dispatch order on the left to start loading.
              </Alert>
            ) : (
              <Alert severity={canEditSelectedDispatch ? "success" : "warning"} sx={{ mb: 2 }}>
                Selected #{selectedOrder.id} ({selectedProjectName}) is{" "}
                <strong>{selectedOrder.status ?? "planned"}</strong>
                {!canEditSelectedDispatch ? ". Reopen to planned before editing items." : "."}
              </Alert>
            )}

            <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center">
              <TextField
                label="Project filter"
                size="medium"
                select
                value={projectFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  setProjectFilter(v === "all" ? "all" : Number(v));
                }}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="all">All projects</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.project_name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Dispatch"
                size="medium"
                select
                value={selectedDispatchId}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  setSelectedDispatchId(v);
                }}
                sx={{ minWidth: 260 }}
              >
                <MenuItem value="">Select dispatch…</MenuItem>
                {orders.map((o) => {
                  const p = projectById.get(o.project_id ?? -1);
                  return (
                    <MenuItem key={o.id} value={o.id}>
                      #{o.id} • {p?.project_name ?? "No project"} • {o.truck_number ?? "-"} • {o.dispatch_date}
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                label="Search yard items"
                size="medium"
                value={yardSearch}
                onChange={(e) => setYardSearch(e.target.value)}
                sx={{ minWidth: 260 }}
              />

              <TextField
                label="Yard item"
                size="medium"
                select
                value={addItemForm.yard_inventory_id}
                onChange={(e) => setAddItemForm((f) => ({ ...f, yard_inventory_id: e.target.value }))}
                sx={{ minWidth: 320 }}
              >
                <MenuItem value="">Select yard inventory…</MenuItem>
                {filteredYardBySearch.map((y) => (
                  <MenuItem key={y.yard_inventory_id} value={y.yard_inventory_id}>
                    {y.project_name} • {y.element_mark} {y.element_type} • {y.location} • qty {y.quantity}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Qty"
                size="medium"
                value={addItemForm.quantity}
                onChange={(e) => setAddItemForm((f) => ({ ...f, quantity: e.target.value }))}
                sx={{ width: 100 }}
              />
              <Button
                variant="outlined"
                onClick={addItem}
                disabled={!canEditSelectedDispatch || dispatchMutating}
                sx={{ minHeight: 44, px: 2 }}
              >
                Add item
              </Button>
            </Stack>
            <Divider sx={{ my: 1.5 }} />
            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                bgcolor: "background.paper",
                py: 1,
                zIndex: 2,
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                color="success"
                onClick={() => updateDispatchStatus("completed")}
                disabled={!canEditSelectedDispatch || dispatchMutating}
                sx={{ minHeight: 44, px: 2 }}
              >
                Complete dispatch
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => updateDispatchStatus("cancelled")}
                disabled={!canEditSelectedDispatch || dispatchMutating}
                sx={{ minHeight: 44, px: 2 }}
              >
                Cancel dispatch
              </Button>
              <Button
                variant="text"
                onClick={() => updateDispatchStatus("reopen")}
                disabled={
                  selectedOrder == null || selectedOrder.status === "planned" || dispatchMutating
                }
                sx={{ minHeight: 44, px: 2 }}
              >
                Reopen to planned
              </Button>
              </Stack>
            </Box>
          </Paper>

          {selectedOrder && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
              <Chip
                label={`Dispatch #${selectedOrder.id}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              {selectedOrder.truck_number && (
                <Chip label={`Truck: ${selectedOrder.truck_number}`} size="small" />
              )}
              {selectedOrder.dispatch_date && (
                <Chip label={`Date: ${selectedOrder.dispatch_date}`} size="small" />
              )}
              {selectedOrder.status_changed_at && (
                <Chip
                  label={`Status updated: ${formatDateTime(selectedOrder.status_changed_at)} by ${selectedOrder.status_changed_by_name ?? `user #${selectedOrder.status_changed_by ?? "-"}`}`}
                  size="small"
                />
              )}
            </Stack>
          )}

          {selectedDispatchId !== "" && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ px: 0.5, pb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Loaded items
                </Typography>
              </Box>
              <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Item ID</TableCell>
                      <TableCell>Element</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dispatchItems.map((it) => {
                    const y = yardById.get(it.yard_inventory_id ?? -1);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.id}</TableCell>
                        <TableCell>
                          {y ? `${y.element_mark} ${y.element_type}` : `Yard #${it.yard_inventory_id}`}
                        </TableCell>
                        <TableCell>{y?.location ?? "-"}</TableCell>
                        <TableCell>{it.quantity}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => removeItem(it.id)}
                            disabled={!canEditSelectedDispatch || dispatchMutating}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                    {dispatchItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary">
                            No items loaded yet.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Grid>
      </Grid>
        </>
      )}
    </Paper>
  );
}

