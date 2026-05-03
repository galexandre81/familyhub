import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative">
      {/* Atmosphere : ambient brass glow corners */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(217,160,91,0.12), transparent 50%), radial-gradient(ellipse at bottom right, rgba(201,113,46,0.08), transparent 50%)",
        }}
      />

      <div className="relative max-w-md w-full">
        <div className="flex items-center gap-3 mb-12 justify-center">
          <span className="h-px w-8 bg-brass opacity-50" />
          <span className="eyebrow">N° 1 · Mai 2026</span>
          <span className="h-px w-8 bg-brass opacity-50" />
        </div>

        <h1 className="font-serif text-7xl text-cream text-center leading-none mb-1 tracking-tight">
          Family
        </h1>
        <h1 className="font-serif italic text-7xl text-brass text-center leading-none mb-10 tracking-tight">
          Hub
        </h1>

        <p className="text-center text-cream-mute font-serif italic text-lg mb-12 leading-relaxed">
          La maisonnée connectée — météo,&nbsp;agenda,
          <br />
          minuteurs et radios pour la cuisine.
        </p>

        <button
          onClick={() => void signIn()}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Chargement…" : "Entrer avec Google"}
        </button>

        <div className="mt-10 flex items-center gap-3 text-cream-mute">
          <span className="h-px flex-1 bg-wood-dark" />
          <span
            className="w-1.5 h-1.5 bg-brass opacity-70"
            style={{ transform: "rotate(45deg)" }}
          />
          <span className="h-px flex-1 bg-wood-dark" />
        </div>

        <p className="mt-6 text-center text-xs text-cream-mute tracking-wider uppercase">
          Conçu pour la maison
        </p>
      </div>
    </div>
  );
}
