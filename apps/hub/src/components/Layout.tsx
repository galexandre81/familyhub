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
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Editorial masthead */}
      <header className="bg-ivory/80 backdrop-blur-sm sticky top-0 z-20" style={{ borderBottom: "1px solid #E5DCC8" }}>
        <div className="max-w-6xl mx-auto px-8 py-5">
          {/* Top row: date + user */}
          <div className="flex items-center justify-between text-xs tracking-widest uppercase text-ink-mute mb-4">
            <span className="italic font-serif normal-case tracking-normal text-ink-mute">
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
              <span className="text-[10px] tracking-widest">
                {user?.displayName?.split(" ")[0]}
              </span>
              <button
                onClick={() => void signOut()}
                className="text-ink-mute hover:text-terracotta transition"
                title="Déconnexion"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          {/* Logo + nav */}
          <div className="flex items-end justify-between gap-8">
            <Link to="/" className="block">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-terracotta opacity-50" />
                <span className="eyebrow">Famille</span>
              </div>
              <div className="font-serif text-3xl leading-none mt-1">
                <span className="text-ink">Family</span>
                <span className="italic text-terracotta">Hub</span>
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
                        ? "bg-terracotta-soft text-terracotta"
                        : "text-ink-mute hover:text-ink",
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

      <footer className="text-center text-xs text-ink-mute py-8 italic font-serif">
        ✦ La maison où il fait bon vivre ✦
      </footer>
    </div>
  );
}
