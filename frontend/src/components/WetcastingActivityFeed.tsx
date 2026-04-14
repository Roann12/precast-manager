// File overview: Reusable UI component logic for components/WetcastingActivityFeed.tsx.
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import api from "../api/client";
import type { WetcastingActivityItem } from "../types/api";
import {
  formatActivityDetails,
  formatActivityEntityLabel,
  prettyAction,
} from "../activity/wetcastingActivityFormat";

type Props = {
  section: "elements" | "planner" | "production";
};

// Inputs: caller state/arguments related to wetcasting activity feed.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function WetcastingActivityFeed({ section }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WetcastingActivityItem[]>([]);
  const [users, setUsers] = useState<Array<{ user_id: number; user_name: string | null }>>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [userId, setUserId] = useState<number | "">("");
  const [action, setAction] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const [yardLocationNameById, setYardLocationNameById] = useState<Record<number, string>>({});

  useEffect(() => {
    api
      .get<{ users: Array<{ user_id: number; user_name: string | null }>; actions: string[] }>(
        "/wetcasting/activity/filters",
        { params: { section } }
      )
      .then((r) => {
        setUsers(r.data?.users ?? []);
        setActions(r.data?.actions ?? []);
      })
      .catch(console.error);
  }, [section]);

  useEffect(() => {
    if (!open) return;
    if (section !== "production") return;
    api
      .get<Array<{ id: number; name: string }>>("/yard/locations")
      .then((r) => {
        const map: Record<number, string> = {};
        for (const loc of r.data ?? []) {
          map[Number(loc.id)] = String(loc.name ?? "");
        }
        setYardLocationNameById(map);
      })
      .catch(() => setYardLocationNameById({}));
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    api
      .get<WetcastingActivityItem[]>("/wetcasting/activity", {
        params: {
          section,
          limit,
          action: action || undefined,
          user_id: userId === "" ? undefined : userId,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      })
      .then((r) => setItems(r.data ?? []))
      .catch(console.error);
  }, [open, section, action, userId, fromDate, toDate, limit]);

  return (
    <>
      <Button
        variant="text"
        color="inherit"
        size="small"
        startIcon={<HistoryIcon fontSize="small" />}
        onClick={() => setOpen(true)}
        sx={{ textTransform: "none" }}
      >
        Traceability
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              User Traceability
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Latest user actions for {section}.
            </Typography>
          </Stack>
          <IconButton aria-label="Close" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
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
              label="Show"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              sx={{ width: 140 }}
            >
              <MenuItem value={20}>Last 20</MenuItem>
              <MenuItem value={50}>Last 50</MenuItem>
              <MenuItem value={100}>Last 100</MenuItem>
              <MenuItem value={200}>Last 200</MenuItem>
            </TextField>
            <Button
              size="small"
              onClick={() => {
                setUserId("");
                setAction("");
                setFromDate("");
                setToDate("");
              }}
            >
              Clear
            </Button>
          </Stack>

          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No activity yet.
            </Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: "nowrap", width: 190 }}>Date/Time</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", width: 220 }}>User</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", width: 240 }}>Action</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", width: 160 }}>Entity</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {new Date(it.created_at).toLocaleString()}
                    </TableCell>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
