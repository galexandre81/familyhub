import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import NotFound from "./components/NotFound";
import { LoadingState } from "./components/states";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Displays = lazy(() => import("./pages/Displays"));
const DisplayEditor = lazy(() => import("./pages/DisplayEditor"));
const Tiles = lazy(() => import("./pages/Tiles"));
const TileEditor = lazy(() => import("./pages/TileEditor"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Profils = lazy(() => import("./pages/Profils"));
const Menu = lazy(() => import("./pages/Menu"));
const MenuWizard = lazy(() => import("./pages/MenuWizard"));
const MenuImport = lazy(() => import("./pages/MenuImport"));
const LivreRecettes = lazy(() => import("./pages/LivreRecettes"));
const RecetteDetail = lazy(() => import("./pages/RecetteDetail"));
const RecetteCuisine = lazy(() => import("./pages/RecetteCuisine"));

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
      <Suspense fallback={<LoadingState />}>
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
          <Route path="menu/import" element={<MenuImport />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
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
