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
import Menu from "./pages/Menu";
import MenuWizard from "./pages/MenuWizard";
import LivreRecettes from "./pages/LivreRecettes";
import RecetteDetail from "./pages/RecetteDetail";
import RecetteCuisine from "./pages/RecetteCuisine";
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
          <Route path="menu" element={<Menu />} />
          <Route path="menu/nouveau" element={<MenuWizard />} />
          <Route path="livre-recettes" element={<LivreRecettes />} />
          <Route path="livre-recettes/:recetteId" element={<RecetteDetail />} />
          <Route path="livre-recettes/:recetteId/cuisine" element={<RecetteCuisine />} />
          {/* Anciennes routes /kitchen-buddy/* — redirections rétro-compat. */}
          <Route path="kitchen-buddy" element={<Navigate to="/menu" replace />} />
          <Route path="kitchen-buddy/nouveau-plan" element={<Navigate to="/menu/nouveau" replace />} />
          <Route path="kitchen-buddy/livre" element={<Navigate to="/livre-recettes" replace />} />
          <Route path="kitchen-buddy/livre/:recetteId" element={<NavigateLivre />} />
          <Route path="kitchen-buddy/livre/:recetteId/cuisine" element={<NavigateLivreCuisine />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function NavigateLivre() {
  const params = new URLSearchParams(window.location.search);
  const id = window.location.pathname.split("/")[3];
  return <Navigate to={`/livre-recettes/${id}${params.toString() ? "?" + params : ""}`} replace />;
}

function NavigateLivreCuisine() {
  const id = window.location.pathname.split("/")[3];
  return <Navigate to={`/livre-recettes/${id}/cuisine`} replace />;
}
