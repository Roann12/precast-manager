import { alpha, createTheme } from "@mui/material/styles";

export const theme = createTheme({
  shape: { borderRadius: 14 },
  palette: {
    mode: "light",
    primary: { main: "#2563EB" }, // blue-600
    secondary: { main: "#7C3AED" }, // violet-600
    background: {
      default: "#F7F9FC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#0F172A", // slate-900
      secondary: "#475569", // slate-600
    },
    divider: alpha("#0F172A", 0.10),
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    h4: { fontWeight: 800, letterSpacing: -0.3 },
    h5: { fontWeight: 800, letterSpacing: -0.2 },
    h6: { fontWeight: 750, letterSpacing: -0.1 },
    subtitle1: { fontWeight: 650 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            "radial-gradient(1200px 600px at 20% -10%, rgba(37,99,235,0.08), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(124,58,237,0.08), transparent 50%)",
          backgroundAttachment: "fixed",
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#0F172A", 0.08)}`,
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#0F172A", 0.08)}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha("#0F172A", 0.08)}`,
          backgroundImage: "none",
          backdropFilter: "saturate(180%) blur(10px)",
          backgroundColor: alpha("#FFFFFF", 0.82),
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
        contained: { boxShadow: "none" },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: alpha("#FFFFFF", 0.9),
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 999 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#0F172A", 0.03),
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 750 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          marginLeft: 8,
          marginRight: 8,
          marginTop: 4,
          marginBottom: 4,
        },
      },
    },
  },
});

