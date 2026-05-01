import { useParams } from "react-router-dom";

export default function DisplayEditor() {
  const { displayId } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Édition de l'écran</h1>
      <p className="text-text-secondaire">ID : {displayId}</p>
      <div className="tile-card">
        <p className="text-text-secondaire">
          Le layout drag &amp; drop arrive en Phase 2. Pour l'instant, ouvrir l'écran en édition,
          ajouter/retirer des tuiles à la grille via formulaire (TODO).
        </p>
      </div>
    </div>
  );
}
