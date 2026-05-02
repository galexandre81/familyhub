import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Displays from "./pages/Displays";
import DisplayEditor from "./pages/DisplayEditor";
import Tiles from "./pages/Tiles";
import TileEditor from "./pages/TileEditor";
import Parametres from "./pages/Parametres";
import Profils from "./pages/Profils";
import KitchenBuddy from "./pages/KitchenBuddy";
import KitchenBuddyWizard from "./pages/KitchenBuddyWizard";
import Layout from "./components/Layout";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-secondaire">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="displays" element={<Displays />} />
          <Route path="displays/:displayId" element={<DisplayEditor />} />
          <Route path="tiles" element={<Tiles />} />
          <Route path="tiles/:tileId" element={<TileEditor />} />
          <Route path="parametres" element={<Parametres />} />
          <Route path="parametres/profils" element={<Profils />} />
          <Route path="kitchen-buddy" element={<KitchenBuddy />} />
          <Route path="kitchen-buddy/nouveau-plan" element={<KitchenBuddyWizard />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
