import { Link, NavLink, Outlet } from "react-router-dom";
import { Home, MonitorSmartphone, LayoutGrid, Settings, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import clsx from "clsx";

const navItems = [
  { to: "/", icon: Home, label: "Accueil", end: true },
  { to: "/displays", icon: MonitorSmartphone, label: "Écrans" },
  { to: "/tiles", icon: LayoutGrid, label: "Tuiles" },
  { to: "/parametres", icon: Settings, label: "Paramètres" },
];

export default function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-bordure bg-bg-card">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
          <Link to="/" className="font-serif text-xl text-accent-chaud">
            Family Hub
          </Link>
          <nav className="flex-1 flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "px-3 py-2 rounded-md flex items-center gap-2 text-sm transition",
                    isActive ? "bg-bordure text-text-principal" : "text-text-secondaire hover:bg-bordure/50",
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm text-text-secondaire">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
            )}
            <button
              onClick={() => void signOut()}
              className="flex items-center gap-1 text-text-secondaire hover:text-accent-chaud transition"
              title="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
