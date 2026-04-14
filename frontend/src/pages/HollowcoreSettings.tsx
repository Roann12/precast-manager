// File overview: Page component and UI logic for pages/HollowcoreSettings.tsx.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import api from "../api/client";
import { useNotify } from "../notifications/NotifyContext";
import { formatQueryErrorMessage } from "../queryClient";
import { HOLLOWCORE_SETTINGS_KEY, fetchHollowcoreSettings, type HollowcoreFactorySettings } from "./hollowcoreQuery";

const defaults: HollowcoreFactorySettings = {
  default_waste_mm: 2000,
  default_casts_per_day: 1,
  cutting_strength_mpa: 15,
  final_strength_mpa: 30,
};

// Inputs: caller state/arguments related to hollowcore settings.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function HollowcoreSettings() {
  const notify = useNotify();
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: HOLLOWCORE_SETTINGS_KEY,
    queryFn: fetchHollowcoreSettings,
  });

  const [settings, setSettings] = useState<HollowcoreFactorySettings>(defaults);

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (body: HollowcoreFactorySettings) => {
      await api.put("/hollowcore/settings", body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: HOLLOWCORE_SETTINGS_KEY });
      notify.success("Settings saved");
    },
    onError: (e) => notify.error(formatQueryErrorMessage(e)),
  });

  const save = () => saveMutation.mutate(settings);

  const loading = settingsQuery.isPending || saveMutation.isPending;

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h5">Hollowcore Settings</Typography>

        {settingsQuery.isPending ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : null}

        {settingsQuery.isError ? (
          <Alert severity="error">Failed to load settings.</Alert>
        ) : null}

        <Stack direction="row" spacing={2} flexWrap="wrap">
          <TextField
            label="Bed margin each end (mm)"
            size="small"
            type="number"
            helperText="Reserved at the head and tail of the bed (total unused strip = 2× this value)."
            value={settings.default_waste_mm}
            onChange={(e) => setSettings((s) => ({ ...s, default_waste_mm: Number(e.target.value) }))}
            disabled={loading}
          />
          <TextField
            label="Default casts/day (fallback)"
            size="small"
            type="number"
            value={settings.default_casts_per_day}
            onChange={(e) => setSettings((s) => ({ ...s, default_casts_per_day: Number(e.target.value) }))}
            disabled={loading}
          />
          <TextField
            label="Cutting strength (MPa)"
            size="small"
            type="number"
            value={settings.cutting_strength_mpa}
            onChange={(e) => setSettings((s) => ({ ...s, cutting_strength_mpa: Number(e.target.value) }))}
            disabled={loading}
          />
          <TextField
            label="Final strength (MPa)"
            size="small"
            type="number"
            value={settings.final_strength_mpa}
            onChange={(e) => setSettings((s) => ({ ...s, final_strength_mpa: Number(e.target.value) }))}
            disabled={loading}
          />
          <Button variant="contained" onClick={save} disabled={loading || settingsQuery.isError}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
