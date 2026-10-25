import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import NotFound from "./components/NotFound";
import { LoadingState } from "./components/states";
import { useAmbiance } from "./lib/ambiance";
import { InvitationEnAttenteProvider } from "./lib/invitationContext";
import { useEstTelephone } from "./lib/useEstTelephone";
import DisponibleSurOrdinateur from "./components/DisponibleSurOrdinateur";

const Login = lazy(() => import("./pages/Login"));
const Rejoindre = lazy(() => import("./pages/Rejoindre"));
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
const ModeRecette = lazy(() => import("./pages/ModeRecette"));
const Aujourdhui = lazy(() => import("./pages/Aujourdhui"));
const Semaine = lazy(() => import("./pages/Semaine"));
const Courses = lazy(() => import("./pages/Courses"));
const BatchCooking = lazy(() => import("./pages/BatchCooking"));

/** `/` : Aujourd'hui sur téléphone, tableau de bord sur PC. */
function Accueil() {
  return useEstTelephone() ? <Aujourdhui /> : <Dashboard />;
}

/** Pages réservées au PC : sur téléphone, « disponible sur ordinateur ». */
function PcSeulement({ children }: { children: React.ReactNode }) {
  return useEstTelephone() ? <DisponibleSurOrdinateur /> : <>{children}</>;
}

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

/**
 * Ambiance hors Layout (login, chargements) : repli 07–19. Composant frère
 * qui ne rend rien : son recalcul chaque minute ne re-rend pas toute l'app.
 */
function AmbianceRacine() {
  useAmbiance();
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <AmbianceRacine />
      <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/rejoindre/:code" element={<Rejoindre />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <InvitationEnAttenteProvider>
                <Layout />
              </InvitationEnAttenteProvider>
            </RequireAuth>
          }
        >
          <Route index element={<Accueil />} />
          <Route path="semaine" element={<Semaine />} />
          <Route path="courses" element={<Courses />} />
          <Route path="batch/:planId/:batchId" element={<BatchCooking />} />
          <Route path="displays" element={<PcSeulement><Displays /></PcSeulement>} />
          <Route path="displays/:displayId" element={<PcSeulement><DisplayEditor /></PcSeulement>} />
          <Route path="tiles" element={<PcSeulement><Tiles /></PcSeulement>} />
          <Route path="tiles/:tileId" element={<PcSeulement><TileEditor /></PcSeulement>} />
          <Route path="parametres" element={<PcSeulement><Parametres /></PcSeulement>} />
          <Route path="parametres/profils" element={<PcSeulement><Profils /></PcSeulement>} />
          <Route path="menu" element={<PcSeulement><Menu /></PcSeulement>} />
          <Route path="menu/nouveau" element={<PcSeulement><MenuWizard /></PcSeulement>} />
          <Route path="menu/import" element={<PcSeulement><MenuImport /></PcSeulement>} />
          <Route path="menu/:planId/batch/:batchId/cuisine" element={<ModeRecette />} />
          <Route path="menu/:planId/:slotId/cuisine" element={<ModeRecette />} />
          <Route path="livre-recettes" element={<LivreRecettes />} />
          <Route path="livre-recettes/:recetteId" element={<RecetteDetail />} />
          <Route path="livre-recettes/:recetteId/cuisine" element={<ModeRecette />} />
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
