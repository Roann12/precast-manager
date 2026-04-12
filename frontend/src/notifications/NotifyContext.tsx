import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, Snackbar, type AlertColor } from "@mui/material";

type ShowNotify = (message: string, severity?: AlertColor) => void;

const NotifyContext = createContext<ShowNotify | null>(null);

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AlertColor>("info");

  const show = useCallback((msg: string, sev: AlertColor = "info") => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const handleSnackbarClose = useCallback(
    (_event: unknown, reason?: string) => {
      if (reason === "timeout" || reason === "clickaway") {
        setOpen(false);
      }
    },
    []
  );

  return (
    <NotifyContext.Provider value={show}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={severity === "error" ? 10_000 : 6500}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{
            width: "100%",
            maxWidth: "min(92vw, 560px)",
            alignItems: "flex-start",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const show = useContext(NotifyContext);

  return useMemo(() => {
    const fallback: ShowNotify = (msg) => {
      window.alert(msg);
    };
    if (!show) {
      return {
        show: fallback,
        error: (m: string) => fallback(m),
        success: (m: string) => fallback(m),
        info: (m: string) => fallback(m),
        warning: (m: string) => fallback(m),
      };
    }
    return {
      show,
      error: (m: string) => show(m, "error"),
      success: (m: string) => show(m, "success"),
      info: (m: string) => show(m, "info"),
      warning: (m: string) => show(m, "warning"),
    };
  }, [show]);
}
