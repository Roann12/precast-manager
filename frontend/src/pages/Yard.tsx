import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Stack,
  TextField,
  MenuItem,
  Button,
  Checkbox,
  Alert,
  Box,
  CircularProgress,
  LinearProgress,
  Card,
  CardActions,
  CardContent,
  useTheme,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import api from "../api/client";
import type { YardInventoryRow } from "../types/api";
import { YARD_INVENTORY_KEY, YARD_LOCATIONS_KEY, fetchYardInventory, fetchYardLocations } from "./yardQuery";
import { useNotify } from "../notifications/NotifyContext";

export default function Yard() {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const notify = useNotify();
  const qc = useQueryClient();

  const inventoryQuery = useQuery({
    queryKey: YARD_INVENTORY_KEY,
    queryFn: fetchYardInventory,
  });

  const locationsQuery = useQuery({
    queryKey: YARD_LOCATIONS_KEY,
    queryFn: fetchYardLocations,
    staleTime: 60_000,
  });

  const items = inventoryQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  const pageLoading = inventoryQuery.isPending || locationsQuery.isPending;
  const refetchingInventory = inventoryQuery.isFetching && !inventoryQuery.isPending;

  const refreshYardPage = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: YARD_INVENTORY_KEY }),
      qc.invalidateQueries({ queryKey: YARD_LOCATIONS_KEY }),
    ]);

  const moveMutation = useMutation({
    mutationFn: async (vars: { yard_inventory_id: number; to_location_id: number; quantity: number }) => {
      await api.post("/yard/move", null, {
        params: {
          yard_inventory_id: vars.yard_inventory_id,
          to_location_id: vars.to_location_id,
          quantity: vars.quantity,
        },
      });
    },
    onSuccess: () => refreshYardPage(),
    onError: () => notify.error("Failed to move inventory"),
  });

  const [moveToLocationId, setMoveToLocationId] = useState<number | "">("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [moveQuantities, setMoveQuantities] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<number | "all">("all");

  useEffect(() => {
    if (!inventoryQuery.data) return;
    const qtyMap: Record<number, number> = {};
    inventoryQuery.data.forEach((row) => {
      qtyMap[row.yard_inventory_id] = row.quantity;
    });
    setMoveQuantities(qtyMap);
  }, [inventoryQuery.data]);

  const moveRow = (row: YardInventoryRow) => {
    if (moveToLocationId === "") {
      notify.warning("Select a destination location first");
      return;
    }
    if (Number(moveToLocationId) === row.location_id) {
      notify.warning("Select a different location");
      return;
    }
    const qty = moveQuantities[row.yard_inventory_id] ?? row.quantity;
    if (!Number.isFinite(qty) || qty <= 0) return;

    moveMutation.mutate({
      yard_inventory_id: row.yard_inventory_id,
      to_location_id: Number(moveToLocationId),
      quantity: qty,
    });
  };

  const moveSelected = async () => {
    if (moveToLocationId === "") {
      notify.warning("Select a destination location first");
      return;
    }
    const selectedRows = items.filter((r) => selected[r.yard_inventory_id]);
    if (selectedRows.length === 0) return;
    if (
      !window.confirm(
        `Move ${selectedRows.length} row(s) to selected location? Quantities will use the values in the 'Qty to move' column.`
      )
    ) {
      return;
    }
    for (const row of selectedRows) {
      if (Number(moveToLocationId) === row.location_id) continue;
      const qty = moveQuantities[row.yard_inventory_id] ?? row.quantity;
      if (!Number.isFinite(qty) || qty <= 0) continue;
      await moveMutation.mutateAsync({
        yard_inventory_id: row.yard_inventory_id,
        to_location_id: Number(moveToLocationId),
        quantity: qty,
      });
    }
    setSelected({});
  };

  const filtered = items.filter((row) => {
    const matchesSearch =
      !search ||
      row.element_mark.toLowerCase().includes(search.toLowerCase()) ||
      row.element_type.toLowerCase().includes(search.toLowerCase()) ||
      row.location.toLowerCase().includes(search.toLowerCase());
    const matchesLocation =
      locationFilter === "all" || row.location_id === (locationFilter as number);
    return matchesSearch && matchesLocation;
  });

  return (
    <Paper sx={{ p: 2 }}>
      {refetchingInventory ? <LinearProgress sx={{ mb: 2, mt: -1, borderRadius: 1 }} /> : null}
      <Typography variant="h5" gutterBottom>
        Yard Inventory
      </Typography>

      {inventoryQuery.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load yard inventory.
        </Alert>
      ) : null}
      {locationsQuery.isError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Failed to load yard locations.
        </Alert>
      ) : null}

      {pageLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
      <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "center" }} flexWrap="wrap">
        <TextField
          label="Search"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by mark, type or location…"
          sx={{ minWidth: 220 }}
        />
        <TextField
          label="Location"
          size="small"
          select
          value={locationFilter}
          onChange={(e) =>
            setLocationFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">All locations</MenuItem>
          {locations.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Move to location"
          size="small"
          select
          value={moveToLocationId}
          onChange={(e) => setMoveToLocationId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="">Select destination…</MenuItem>
          {locations.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.name}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          Choose a destination, then use “Move” on a row or “Move selected”.
        </Typography>
        <Button
          variant="contained"
          color="success"
          size={isNarrow ? "medium" : "small"}
          sx={{ minHeight: isNarrow ? 48 : undefined }}
          disabled={
            moveToLocationId === "" ||
            Object.values(selected).every((v) => !v) ||
            moveMutation.isPending
          }
          onClick={moveSelected}
        >
          Move selected
        </Button>
      </Stack>

      {isNarrow ? (
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Checkbox
              indeterminate={
                Object.values(selected).some((v) => v) && !Object.values(selected).every((v) => v)
              }
              checked={
                filtered.length > 0 && filtered.every((r) => selected[r.yard_inventory_id])
              }
              onChange={(e) => {
                const checked = e.target.checked;
                const next: Record<number, boolean> = { ...selected };
                filtered.forEach((r) => {
                  next[r.yard_inventory_id] = checked;
                });
                setSelected(next);
              }}
            />
            <Typography variant="body2" color="text.secondary">
              Select all on screen
            </Typography>
          </Stack>
          {filtered.map((item) => (
            <Card key={item.yard_inventory_id} variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <Checkbox
                      checked={Boolean(selected[item.yard_inventory_id])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [item.yard_inventory_id]: e.target.checked,
                        }))
                      }
                      sx={{ mt: -0.5 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {item.element_mark}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.element_type} · {item.location}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        On hand: <strong>{item.quantity}</strong>
                      </Typography>
                    </Box>
                  </Stack>
                  <TextField
                    label="Qty to move"
                    size="small"
                    type="number"
                    fullWidth
                    inputProps={{ min: 1, max: item.quantity }}
                    value={moveQuantities[item.yard_inventory_id] ?? item.quantity}
                    onChange={(e) =>
                      setMoveQuantities((prev) => ({
                        ...prev,
                        [item.yard_inventory_id]:
                          e.target.value === "" ? item.quantity : Number(e.target.value),
                      }))
                    }
                  />
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => moveRow(item)}
                  disabled={moveMutation.isPending}
                >
                  Move
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      Object.values(selected).some((v) => v) &&
                      !Object.values(selected).every((v) => v)
                    }
                    checked={
                      filtered.length > 0 &&
                      filtered.every((r) => selected[r.yard_inventory_id])
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const next: Record<number, boolean> = { ...selected };
                      filtered.forEach((r) => {
                        next[r.yard_inventory_id] = checked;
                      });
                      setSelected(next);
                    }}
                  />
                </TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Element</TableCell>
                <TableCell>Mark</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Qty to move</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.yard_inventory_id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={Boolean(selected[item.yard_inventory_id])}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [item.yard_inventory_id]: e.target.checked,
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>{item.location}</TableCell>
                  <TableCell>{item.element_type}</TableCell>
                  <TableCell>{item.element_mark}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ min: 1, max: item.quantity }}
                      value={moveQuantities[item.yard_inventory_id] ?? item.quantity}
                      onChange={(e) =>
                        setMoveQuantities((prev) => ({
                          ...prev,
                          [item.yard_inventory_id]:
                            e.target.value === "" ? item.quantity : Number(e.target.value),
                        }))
                      }
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => moveRow(item)}
                      disabled={moveMutation.isPending}
                    >
                      Move
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
        </>
      )}
    </Paper>
  );
}

