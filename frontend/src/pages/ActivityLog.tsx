import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  CircularProgress,
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
  Typography,
} from "@mui/material";
import api from "../api/client";
import type { WetcastingActivityItem } from "../types/api";
import {
  formatActivityDetails,
  formatActivityEntityLabel,
  prettyAction,
} from "../activity/wetcastingActivityFormat";

const SECTION_OPTIONS = [
  { value: "", label: "All sections" },
  { value: "elements", label: "Elements" },
  { value: "planner", label: "Planner" },
  { value: "production", label: "Production" },
  { value: "hollowcore", label: "Hollowcore" },
  { value: "qc", label: "QC" },
  { value: "dispatch", label: "Dispatch" },
  { value: "yard", label: "Yard" },
] as const;

export default function ActivityLog() {
  const [userId, setUserId] = useState<number | "">("");
  const [action, setAction] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(100);
  const [section, setSection] = useState<string>("");

  const locationsQuery = useQuery({
    queryKey: ["yard", "locations", "activity-log"],
    queryFn: async () => (await api.get<Array<{ id: number; name: string }>>("/yard/locations")).data ?? [],
    staleTime: 60_000,
  });

  const yardLocationNameById = useMemo(() => {
    const map: Record<number, string> = {};
    for (const loc of locationsQuery.data ?? []) {
      map[Number(loc.id)] = String(loc.name ?? "");
    }
    return map;
  }, [locationsQuery.data]);

  const filtersQuery = useQuery({
    queryKey: ["wetcasting", "activity", "filters", section || "__all__"],
    queryFn: async () =>
      (
        await api.get<{ users: Array<{ user_id: number; user_name: string | null }>; actions: string[] }>(
          "/wetcasting/activity/filters",
          { params: section ? { section } : {} }
        )
      ).data,
  });

  const itemsQuery = useQuery({
    queryKey: ["wetcasting", "activity", "list", section, userId, action, fromDate, toDate, limit],
    queryFn: async () =>
      (
        await api.get<WetcastingActivityItem[]>("/wetcasting/activity", {
          params: {
            section: section || undefined,
            limit,
            action: action || undefined,
            user_id: userId === "" ? undefined : userId,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          },
        })
      ).data ?? [],
  });

  const users = filtersQuery.data?.users ?? [];
  const actions = filtersQuery.data?.actions ?? [];
  const items = itemsQuery.data ?? [];

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Activity log
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Filtered audit trail (planner commits, dispatch, yard moves, elements, production, and more).
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          {SECTION_OPTIONS.map((o) => (
            <MenuItem key={o.value || "__all__"} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="User"
          value={userId}
          onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All users</MenuItem>
          {users.map((u) => (
            <MenuItem key={u.user_id} value={u.user_id}>
              {u.user_name ?? `User #${u.user_id}`}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">All actions</MenuItem>
          {actions.map((a) => (
            <MenuItem key={a} value={a}>
              {prettyAction(a)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="From"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          select
          size="small"
          label="Rows"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          sx={{ width: 120 }}
        >
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
          <MenuItem value={200}>200</MenuItem>
        </TextField>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setUserId("");
            setAction("");
            setFromDate("");
            setToDate("");
          }}
        >
          Clear filters
        </Button>
      </Stack>

      {itemsQuery.isPending || filtersQuery.isPending ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : itemsQuery.isError ? (
        <Typography color="error">Failed to load activity.</Typography>
      ) : items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No matching activity.
        </Typography>
      ) : (
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Date/Time</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Section</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>User</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Action</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>Entity</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {new Date(it.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{it.section}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {it.user_name ?? `User #${it.user_id}`}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{prettyAction(it.action)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatActivityEntityLabel(it)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                      {formatActivityDetails(it, yardLocationNameById)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}
