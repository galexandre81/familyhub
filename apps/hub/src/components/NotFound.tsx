import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 py-16 text-center">
      <div className="rule mb-6 w-full max-w-xs">
        <span className="rule-mark" />
        <span className="eyebrow">Erreur 404</span>
        <span className="rule-mark" />
      </div>
      <h1 className="font-serif text-6xl leading-none tracking-tight">
        <span className="text-cream">Page</span>{" "}
        <span className="italic text-brass">introuvable</span>
      </h1>
      <p className="mt-4 max-w-md font-serif italic text-lg text-cream-mute">
        La page que vous cherchez n’existe pas ou a été déplacée.
      </p>
      <Link to="/" className="btn-primary mt-10 inline-block">
        Retour à l’accueil
      </Link>
    </div>
  );
}
