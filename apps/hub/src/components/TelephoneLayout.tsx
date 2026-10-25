import { NavLink, Outlet } from "react-router-dom";
import { BookOpen, CalendarDays, LogOut, ShoppingCart, Sun } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
import CestMoi from "./CestMoi";

const onglets = [
  { to: "/", icon: Sun, label: "Aujourd'hui", end: true },
  { to: "/semaine", icon: CalendarDays, label: "Semaine" },
  { to: "/courses", icon: ShoppingCart, label: "Courses" },
  { to: "/livre-recettes", icon: BookOpen, label: "Recettes" },
];

/**
 * Coque téléphone (< 768 px) : en-tête compact, contenu, onglets fixés en bas
 * (libellés 13 px sous 360 px de large pour que « Aujourd'hui » tienne).
 * Le mode recette (plein écran, z-50) recouvre les onglets (z-30).
 * « C'est moi » s'affiche tant que le compte n'est relié à aucun profil.
 */
export default function TelephoneLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
        <div className="font-serif text-xl leading-none">
          <span className="text-cream">Family</span>
          <span className="italic text-brass">Hub</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-12 min-w-12 -mr-3 inline-flex items-center justify-center text-cream-mute"
          aria-label="Déconnexion"
          title="Déconnexion"
        >
          <LogOut size={20} aria-hidden="true" />
        </button>
      </header>

      <main className="flex-1 w-full px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <nav
        aria-label="Onglets"
        className="fixed inset-x-0 bottom-0 z-30 bg-ebony-panel border-t border-hairline pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-4 gap-1 px-1 py-1">
          {onglets.map(({ to, icon: Icon, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "min-h-14 flex flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[13px] min-[360px]:text-[15px] leading-tight",
                    /* Pas de jaune ici : le seul jaune de l'écran est le prochain repas. */
                    isActive ? "bg-ebony-ridge text-brass font-semibold" : "text-cream-mute",
                  )
                }
              >
                <Icon size={22} aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <CestMoi />
    </div>
  );
}
