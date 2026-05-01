import { useParams } from "react-router-dom";

export default function TileEditor() {
  const { tileId } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Configuration de la tuile</h1>
      <p className="text-text-secondaire">ID : {tileId}</p>
      <div className="tile-card">
        <p className="text-text-secondaire">
          Le formulaire de configuration par type de tuile sera ajouté ici (clock, weather, radio).
        </p>
      </div>
    </div>
  );
}
