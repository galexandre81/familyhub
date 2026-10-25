import { Link, NavLink, Outlet } from "react-router-dom";
import { BookOpen, ChefHat, Home, MonitorSmartphone, LayoutGrid, Settings, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useHouseholds } from "../lib/queries";
import { useAmbiance } from "../lib/ambiance";
import clsx from "clsx";
import { useEstTelephone } from "../lib/useEstTelephone";
import TelephoneLayout from "./TelephoneLayout";
import VeilleurMinuteurs from "./VeilleurMinuteurs";
import { MinuteursProvider } from "../lib/MinuteursContext";

const navItems = [
  { to: "/", icon: Home, label: "Accueil", end: true },
  { to: "/menu", icon: ChefHat, label: "Menu" },
  { to: "/livre-recettes", icon: BookOpen, label: "Recettes" },
  { to: "/displays", icon: MonitorSmartphone, label: "Écrans" },
  { to: "/tiles", icon: LayoutGrid, label: "Tuiles" },
  { to: "/parametres", icon: Settings, label: "Paramètres" },
];

export default function Layout() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);

  /* Ambiance jour/nuit selon le lever/coucher du soleil du foyer. */
  useAmbiance(household?.parametres?.localisation);

  /* Téléphone (< 768 px) : onglets en bas au lieu de l'en-tête PC.
     Minuteurs : un seul abonnement pour la page, et le veilleur fait sonner
     un minuteur terminé quelle que soit la page ouverte. */
  const telephone = useEstTelephone();
  return (
    <MinuteursProvider householdId={householdId}>
      {telephone ? <TelephoneLayout /> : <PcLayout />}
      <VeilleurMinuteurs />
    </MinuteursProvider>
  );
}

function PcLayout() {
  const { user, signOut } = useAuth();
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="bg-ebony-panel/90 backdrop-blur-md sticky top-0 z-20 border-b border-hairline"
      >
        <div className="max-w-6xl mx-auto px-8 py-5">
          <div className="flex items-center justify-between text-xs tracking-widest uppercase text-cream-mute mb-4">
            <span className="italic font-serif normal-case tracking-normal">
              {today}
            </span>
            <div className="flex items-center gap-3">
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-7 h-7 rounded-full border border-hairline"
                />
              )}
              <span className="text-[10px] tracking-widest text-cream-mute">
                {user?.displayName?.split(" ")[0]}
              </span>
              <button
                onClick={() => void signOut()}
                className="text-cream-mute hover:text-brass transition flex items-center justify-center min-h-11 min-w-11 -mr-2.5"
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <LogOut size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between gap-8">
            <Link to="/" className="block">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-brass opacity-60" />
                <span className="eyebrow">Famille</span>
              </div>
              <div className="font-serif text-3xl leading-none mt-1">
                <span className="text-cream">Family</span>
                <span className="italic text-brass">Hub</span>
              </div>
            </Link>
            <nav className="flex items-center gap-1 mb-1">
              {navItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx(
                      "px-4 py-2 flex items-center gap-2 text-[11px] uppercase tracking-widest transition rounded-sm",
                      isActive
                        ? "bg-ebony-ridge text-brass"
                        : "text-cream-mute hover:text-cream",
                    )
                  }
                >
                  <Icon size={13} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-12">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-cream-mute py-8 italic font-serif">
        ✦ La maison où il fait bon vivre ✦
      </footer>
    </div>
  );
}
