import { Link } from "react-router-dom";
import { Home, Monitor } from "lucide-react";

/** Sur téléphone, à la place des pages réservées au PC. */
export default function DisponibleSurOrdinateur() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-12">
      <Monitor size={40} className="text-cream-mute" aria-hidden="true" />
      <p className="text-lg text-cream">Cette page est disponible sur ordinateur</p>
      <Link
        to="/"
        className="min-h-12 inline-flex items-center gap-2 rounded-xl px-5 text-base font-semibold bg-brass text-ebony"
      >
        <Home size={18} aria-hidden="true" />
        Retour à Aujourd'hui
      </Link>
    </div>
  );
}
