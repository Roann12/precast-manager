// File overview: Page component and UI logic for pages/Login.tsx.
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import precastLogo from "../assets/precast-logo.png";

type LoginLocationState = { sessionMessage?: string };

// Inputs: caller state/arguments related to login.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // If user was redirected here after token expiry, surface that message once.
    const msg = (location.state as LoginLocationState | null)?.sessionMessage;
    if (!msg?.trim()) return;
    setError(msg);
    // Clear route state so refresh/navigation does not keep replaying the same alert.
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate]);

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const u = await login(email, password);
      // Super admin (factory_id === null) should land on factory management.
      navigate(u.factory_id === null ? "/factories" : "/", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
      <Paper sx={{ p: 3, width: 420 }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
          <Box
            component="img"
            src={precastLogo}
            alt="Precast Manager logo"
            sx={{
              width: "100%",
              maxWidth: 240,
              height: "auto",
              objectFit: "contain",
              opacity: 0.95,
            }}
          />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button type="submit" variant="contained" fullWidth disabled={loading || submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5, lineHeight: 1.6 }}>
            This system is for authorized users only. By signing in you confirm you are permitted to use this
            application. The software is provided &ldquo;as is&rdquo; without warranty of any kind; use is at your own
            risk.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.2 }}>
            Registered product by Roann Heunis
          </Typography>
        </Box>

        {/* Intentionally no demo credentials in production UI. */}
      </Paper>
    </Box>
  );
}

