// File overview: Route configuration and navigation guards for routes/index.tsx.
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import ProtectedRoute from "./ProtectedRoute";

const Login = lazy(() => import("../pages/Login"));
const ChangePassword = lazy(() => import("../pages/ChangePassword"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Projects = lazy(() => import("../pages/Projects"));
const Elements = lazy(() => import("../pages/Elements"));
const Moulds = lazy(() => import("../pages/Moulds"));
const Planner = lazy(() => import("../pages/planner"));
const Production = lazy(() => import("../pages/Production"));
const Yard = lazy(() => import("../pages/Yard"));
const Dispatch = lazy(() => import("../pages/Dispatch"));
const ProjectDetail = lazy(() => import("../pages/ProjectDetail"));
const QC = lazy(() => import("../pages/QC"));
const MixDesigns = lazy(() => import("../pages/MixDesigns"));
const YardLocations = lazy(() => import("../pages/YardLocations"));
const Users = lazy(() => import("../pages/Users"));
const Factories = lazy(() => import("../pages/Factories"));
const Reports = lazy(() => import("../pages/Reports"));
const HollowcorePlanner = lazy(() => import("../pages/HollowcorePlanner"));
const HollowcoreElements = lazy(() => import("../pages/HollowcoreElements"));
const HollowcoreCasts = lazy(() => import("../pages/HollowcoreCasts"));
const HollowcoreBeds = lazy(() => import("../pages/HollowcoreBeds"));
const HollowcoreSettings = lazy(() => import("../pages/HollowcoreSettings"));
const ActivityLog = lazy(() => import("../pages/ActivityLog"));

// Inputs: caller state/arguments related to route fallback.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
function RouteFallback() {
  return (
    // Shared loading state shown while a lazily-loaded page bundle downloads.
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
      <CircularProgress />
    </Box>
  );
}

// Inputs: caller state/arguments related to app routes.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export default function AppRoutes() {
  return (
    // Suspense enables route-level code splitting via React.lazy.
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute requireFactory>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute requireFactory>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute requireFactory>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute requireFactory>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/elements"
          element={
            <ProtectedRoute requireFactory>
              <Elements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/moulds"
          element={
            <ProtectedRoute requireFactory>
              <Moulds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planner"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <Planner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <Navigate to="/hollowcore/planner" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore/planner"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <HollowcorePlanner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore/elements"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <HollowcoreElements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore/casts"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <HollowcoreCasts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore/beds"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <HollowcoreBeds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hollowcore/settings"
          element={
            <ProtectedRoute allowedRoles={["planner", "admin"]} requireFactory>
              <HollowcoreSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/production"
          element={
            <ProtectedRoute allowedRoles={["production", "admin"]} requireFactory>
              <Production />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mix-designs"
          element={
            <ProtectedRoute requireFactory>
              <MixDesigns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qc"
          element={
            <ProtectedRoute allowedRoles={["QC", "admin"]} requireFactory>
              <QC />
            </ProtectedRoute>
          }
        />
        <Route
          path="/yard"
          element={
            <ProtectedRoute allowedRoles={["yard", "admin"]} requireFactory>
              <Yard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/yard-locations"
          element={
            <ProtectedRoute allowedRoles={["yard", "admin"]} requireFactory>
              <YardLocations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispatch"
          element={
            <ProtectedRoute allowedRoles={["dispatch", "admin"]} requireFactory>
              <Dispatch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requireFactory>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/factories"
          element={
            <ProtectedRoute allowedRoles={["admin"]} requireSuperAdmin>
              <Factories />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
