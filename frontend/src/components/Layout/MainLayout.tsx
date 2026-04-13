import { ReactNode, useMemo, useState } from "react";
import { AppBar, Box, Button, Container, IconButton, Toolbar, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth/AuthContext";
import precastLogo from "../../assets/precast-logo.png";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const drawerWidth = 240;
  const { user, logout, loading } = useAuth();

  const containerMaxWidth = useMemo(() => {
    // Planner grid can be wider than viewport; disable maxWidth so horizontal scroll works.
    return location.pathname === "/planner" ? false : "xl";
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" elevation={0} color="transparent" sx={{ zIndex: 1201 }}>
        <Toolbar sx={{ pl: { xs: 7, sm: sidebarCollapsed ? 8 : 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              component="img"
              src={precastLogo}
              alt="Precast Manager logo"
              sx={{ width: 36, height: 36, objectFit: "contain" }}
            />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.2 }}>
              Precast Manager
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {!loading && user ? (
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              sx={{ minHeight: { xs: 44, sm: 36 } }}
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              Log out
            </Button>
          ) : null}
        </Toolbar>
      </AppBar>
      <Sidebar collapsed={sidebarCollapsed} />
      <IconButton
        size="small"
        onClick={() => setSidebarCollapsed((v) => !v)}
        sx={{
          position: "fixed",
          top: 10,
          // Keep the toggle clear of the app title/logo when sidebar is expanded.
          left: { xs: 10, sm: sidebarCollapsed ? 10 : drawerWidth + 8 },
          zIndex: 3000,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: 2,
          transition: "left 150ms ease",
        }}
        aria-label={sidebarCollapsed ? "Show navigation" : "Hide navigation"}
      >
        {sidebarCollapsed ? <MenuIcon /> : <ChevronLeftIcon />}
      </IconButton>
      <Box component="main" sx={{ flexGrow: 1, overflow: "auto" }}>
        <Toolbar />
        <Container maxWidth={containerMaxWidth} sx={{ py: { xs: 2, md: 3 }, overflowX: "visible" }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}

