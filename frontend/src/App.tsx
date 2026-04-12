import { BrowserRouter } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import AppRoutes from "./routes";
import MainLayout from "./components/Layout/MainLayout";
import { AuthProvider } from "./auth/AuthContext";

function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <AuthProvider>
        <MainLayout>
          <AppRoutes />
        </MainLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;