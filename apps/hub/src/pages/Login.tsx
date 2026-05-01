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
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          <span className="h-px w-8 bg-terracotta opacity-50" />
          <span className="eyebrow">N° 1 · Mai 2026</span>
          <span className="h-px w-8 bg-terracotta opacity-50" />
        </div>

        <h1 className="font-serif text-7xl text-ink text-center leading-none mb-1 tracking-tight">
          Family
        </h1>
        <h1 className="font-serif italic text-7xl text-terracotta text-center leading-none mb-10 tracking-tight">
          Hub
        </h1>

        <p className="text-center text-ink-mute font-serif italic text-lg mb-12 leading-relaxed">
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

        <div className="mt-10 flex items-center gap-3 text-ink-mute">
          <span className="h-px flex-1 bg-hairline" />
          <span
            className="w-1.5 h-1.5 bg-terracotta opacity-50"
            style={{ transform: "rotate(45deg)" }}
          />
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <p className="mt-6 text-center text-xs text-ink-mute tracking-wider uppercase">
          Conçu pour la maison
        </p>
      </div>
    </div>
  );
}
