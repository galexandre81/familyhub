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
    <div className="min-h-screen flex items-center justify-center bg-bg-principal">
      <div className="tile-card max-w-md w-full mx-6 text-center">
        <h1 className="font-serif text-4xl text-accent-chaud mb-2">Family Hub</h1>
        <p className="text-text-secondaire mb-8">Connectez-vous pour accéder à votre foyer.</p>
        <button
          onClick={() => void signIn()}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Chargement…" : "Se connecter avec Google"}
        </button>
      </div>
    </div>
  );
}
