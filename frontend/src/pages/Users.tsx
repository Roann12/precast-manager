import { useEffect, useMemo, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useNotify } from "../notifications/NotifyContext";

type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  factory_id: number | null;
  created_at: string;
};

type FactoryOut = { id: number; name: string };

const roleOptions = ["admin", "planner", "production", "yard", "dispatch", "viewer", "QC"];

export default function Users() {
  const notify = useNotify();
  const { user: currentUser } = useAuth();
  const [factories, setFactories] = useState<FactoryOut[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [factoryId, setFactoryId] = useState<number | "">("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  useEffect(() => {
    setPasswordCopied(false);
  }, [temporaryPassword]);

  useEffect(() => {
    if (!passwordCopied) return;
    const t = window.setTimeout(() => setPasswordCopied(false), 3500);
    return () => window.clearTimeout(t);
  }, [passwordCopied]);

  const copyTemporaryPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setPasswordCopied(true);
    } catch {
      notify.error("Could not copy — select the password and copy manually.");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [fRes, uRes] = await Promise.all([api.get<FactoryOut[]>("/admin/factories"), api.get<AdminUserRow[]>("/admin/users")]);
        setFactories(fRes.data ?? []);
        setUsers(uRes.data ?? []);
        if (fRes.data?.length) setFactoryId(fRes.data[0].id);
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const factoryName = useMemo(() => {
    const f = factories.find((x) => x.id === factoryId);
    return f?.name ?? "";
  }, [factories, factoryId]);

  const createUser = async () => {
    if (!name || !email || !password) {
      setError("Name, email, and password are required");
      return;
    }
    if (factoryId === "") {
      setError("Factory is required");
      return;
    }

    setError(null);
    try {
      await api.post("/admin/users", {
        name,
        email,
        password,
        role,
        factory_id: factoryId,
      });
      const uRes = await api.get<AdminUserRow[]>("/admin/users");
      setUsers(uRes.data ?? []);
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to create user");
    }
  };

  const resetPassword = async (userId: number) => {
    if (!window.confirm("Reset this user's password? They will be forced to change it on next login.")) return;
    try {
      const res = await api.post<{ user_id: number; temporary_password: string }>(`/admin/users/${userId}/reset-password`);
      setTemporaryPassword(res.data.temporary_password);
      setResetDialogOpen(true);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to reset password");
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Users
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
        ) : (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                Add user
              </Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap">
                <TextField label="Name" size="small" value={name} onChange={(e) => setName(e.target.value)} />
                <TextField label="Email" size="small" value={email} onChange={(e) => setEmail(e.target.value)} />
                <TextField
                  label="Password"
                  size="small"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Select size="small" value={role} onChange={(e) => setRole(e.target.value as string)} displayEmpty>
                  {roleOptions.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>

                <Select
                  size="small"
                  value={factoryId}
                  onChange={(e) => setFactoryId(Number(e.target.value))}
                  displayEmpty
                >
                  {factories.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>

              <Box sx={{ mt: 2 }}>
                <Button variant="contained" onClick={createUser}>
                  Create user
                </Button>
                {factoryName ? (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                    Scoped to: {factoryName}
                  </Typography>
                ) : null}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                Existing users
              </Typography>

              {users.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No users yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {users.map((u) => (
                    <Paper key={u.id} variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {u.name} ({u.role})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {u.email} • factory_id={u.factory_id} • created_at={u.created_at}
                      </Typography>
                      {currentUser?.factory_id === null && u.factory_id !== null ? (
                        <Box sx={{ mt: 1 }}>
                          <Button size="small" color="warning" variant="outlined" onClick={() => resetPassword(u.id)}>
                            Reset password
                          </Button>
                        </Box>
                      ) : null}
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </>
        )}
      </Stack>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
          setTemporaryPassword(null);
          setPasswordCopied(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Temporary password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share this value securely with the user. They must change it on next login.
          </Typography>
          <TextField
            fullWidth
            label="One-time password"
            value={temporaryPassword ?? ""}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "ui-monospace, monospace" },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy password">
                    <IconButton
                      edge="end"
                      onClick={copyTemporaryPassword}
                      aria-label="Copy temporary password"
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          {passwordCopied ? (
            <Chip
              size="small"
              color="success"
              label="Copied"
              sx={{ mt: 1.5 }}
              variant="outlined"
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setResetDialogOpen(false);
              setTemporaryPassword(null);
              setPasswordCopied(false);
            }}
          >
            Close
          </Button>
          <Button variant="contained" onClick={copyTemporaryPassword}>
            Copy
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

