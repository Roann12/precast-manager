import { useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import api from "../api/client";

type FactoryRow = {
  id: number;
  name: string;
  is_active: boolean;
};

export default function Factories() {
  const [factories, setFactories] = useState<FactoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [factoryName, setFactoryName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<FactoryRow[]>("/admin/factories");
      setFactories(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load factories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onboard = async () => {
    if (!factoryName || !adminName || !adminEmail || !adminPassword) {
      setError("Please fill factory name and admin user details.");
      return;
    }

    setError(null);
    try {
      await api.post("/admin/factories/onboard", {
        factory_name: factoryName,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });

      setFactoryName("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to create factory");
    }
  };

  const setSuspended = async (factoryId: number, isActive: boolean) => {
    setError(null);
    try {
      await api.post(isActive ? `/admin/factories/${factoryId}/reactivate` : `/admin/factories/${factoryId}/suspend`);
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Failed to update factory status");
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Factories
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Create a new factory (customer)
          </Typography>

          <Stack spacing={1}>
            <TextField label="Factory name" size="small" value={factoryName} onChange={(e) => setFactoryName(e.target.value)} />
            <TextField label="Admin name" size="small" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            <TextField label="Admin email" size="small" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <TextField
              label="Admin password"
              size="small"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />

            <Button variant="contained" onClick={onboard}>
              Create factory + first admin
            </Button>

            <Typography variant="caption" color="text.secondary">
              If the customer doesn&apos;t pay: suspend the factory (users will be blocked). You can reactivate later.
            </Typography>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Existing factories
          </Typography>

          {loading ? (
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          ) : factories.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No factories found.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {factories.map((f) => (
                <Paper key={f.id} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {f.name} (#{f.id})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Status: {f.is_active ? "Active" : "Suspended"}
                      </Typography>
                    </Box>
                    {f.is_active ? (
                      <Button size="small" variant="outlined" color="warning" onClick={() => setSuspended(f.id, false)}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" color="success" onClick={() => setSuspended(f.id, true)}>
                        Reactivate
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

