// File overview: Core frontend setup and app-level wiring for App.tsx.
import { BrowserRouter } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import AppRoutes from "./routes";
import MainLayout from "./components/Layout/MainLayout";
import { AuthProvider } from "./auth/AuthContext";

// Main app flow for this module.
function App() {
  return (
    // Router sits at the top so navigation works anywhere in the component tree.
    <BrowserRouter>
      {/* CssBaseline normalizes default browser styles across pages. */}
      <CssBaseline />
      {/* AuthProvider exposes current user + auth actions to all routes. */}
      <AuthProvider>
        {/* MainLayout keeps shared navigation/chrome around page content. */}
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;