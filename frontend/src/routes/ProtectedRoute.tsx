// File overview: Route configuration and navigation guards for routes/ProtectedRoute.tsx.
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";

// Inputs: caller state/arguments related to protected route.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function ProtectedRoute({
  allowedRoles,
  requireFactory,
  requireSuperAdmin,
  children,
}: {
  allowedRoles?: string[];
  requireFactory?: boolean;
  requireSuperAdmin?: boolean;
  children: React.ReactElement;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Hold rendering until auth state is known to avoid redirect flicker.
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <CircularProgress size={36} />
        <Typography variant="body2" color="text.secondary">
          Checking your session…
        </Typography>
      </Box>
    );
  }

  if (!user) {
    // Unauthenticated users always go to login.
    return <Navigate to="/login" replace />;
  }

  // Force users with a temporary password to set a new one.
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Signed in but unauthorized for this route.
    return <Navigate to="/" replace />;
  }

  if (requireSuperAdmin && user.factory_id !== null) {
    // Super admin pages are only valid when not scoped to a specific factory.
    return <Navigate to="/users" replace />;
  }

  if (requireFactory && user.factory_id === null) {
    // Factory-scoped pages require selecting/owning a factory first.
    return <Navigate to="/factories" replace />;
  }

  return children;
}

