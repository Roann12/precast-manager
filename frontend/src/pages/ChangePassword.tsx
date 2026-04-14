// File overview: Page component and UI logic for pages/ChangePassword.tsx.
import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext";

// Inputs: caller state/arguments related to change password.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function ChangePassword() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!currentPassword || !newPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/change-password", { current_password: currentPassword, new_password: newPassword });
      setSuccess("Password updated. Please sign in again.");
      // Force fresh login so token/session state is clean.
      logout();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
      <Paper sx={{ p: 3, width: 480 }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Change password
          </Typography>

          {user?.must_change_password ? (
            <Alert severity="warning">Your password was reset. Please set a new password to continue.</Alert>
          ) : null}

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <TextField
            label="Current password"
            type="password"
            size="small"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            size="small"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            label="Confirm new password"
            type="password"
            size="small"
            fullWidth
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <Button variant="contained" disabled={submitting} onClick={submit}>
            {submitting ? "Updating..." : "Update password"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

