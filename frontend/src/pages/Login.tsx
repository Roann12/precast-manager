import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import precastLogo from "../assets/precast-logo.png";

type LoginLocationState = { sessionMessage?: string };

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password here");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const msg = (location.state as LoginLocationState | null)?.sessionMessage;
    if (!msg?.trim()) return;
    setError(msg);
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location.pathname, location.search, location.state, navigate]);

  const onSubmit = async () => {
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
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Box component="img" src={precastLogo} alt="Precast Manager logo" sx={{ width: 96, height: 96, objectFit: "contain" }} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Email"
          fullWidth
          size="small"
          sx={{ mb: 2 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          fullWidth
          type={showPassword ? "text" : "password"}
          size="small"
          sx={{ mb: 2 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
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

        <Button variant="contained" fullWidth disabled={loading || submitting} onClick={() => onSubmit()}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        {/* Intentionally no demo credentials in production UI. */}
      </Paper>
    </Box>
  );
}

