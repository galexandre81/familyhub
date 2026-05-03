import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useProfils } from "../lib/queries";
import { useDeleteProfil } from "../lib/mutations";
import ProfilBadge from "../components/ProfilBadge";
import ProfilForm from "../components/ProfilForm";

export default function Profils() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils, isLoading } = useProfils(householdId);
  const del = useDeleteProfil();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!user) return null;

  async function handleDelete(profilId: string, nom: string) {
    if (!householdId) return;
    if (!confirm(`Supprimer le profil "${nom}" ? Les plans archivés conservent leur snapshot.`)) {
      return;
    }
    await del.mutateAsync({ householdId, profilId });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/parametres" className="text-text-secondaire hover:text-text-principal">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl">Profils famille</h1>
      </div>

      <p className="text-text-secondaire text-sm max-w-2xl">
        Les profils servent à Kitchen Buddy pour générer des plans de repas adaptés.
        Quand tu lances un plan, un snapshot des profils est figé : modifier un profil
        ensuite n'impacte pas les plans déjà actifs ou archivés.
      </p>

      {isLoading && <p className="text-text-secondaire">Chargement…</p>}

      {!isLoading && profils && profils.length > 0 && (
        <ul className="space-y-3">
          {profils.map((p) =>
            editingId === p.id && householdId ? (
              <li key={p.id}>
                <ProfilForm
                  householdId={householdId}
                  existing={p}
                  onSaved={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={p.id} className="tile-card flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <ProfilBadge
                    initiale={p.initiale}
                    couleur={p.couleur}
                    emoji={p.emoji}
                    size="lg"
                    showEmojiBeside
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg">{p.nom}</p>
                    <ProfilSummary profil={p} />
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end shrink-0">
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Pencil size={14} />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.nom)}
                    disabled={del.isPending}
                    className="text-text-secondaire hover:text-accent-chaud text-sm flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {!isLoading && (!profils || profils.length === 0) && !creating && (
        <div className="tile-card text-center py-8 text-text-secondaire">
          <p className="mb-3">Aucun profil pour l'instant.</p>
          <p className="text-sm">
            Crée au moins un profil par membre de la famille pour pouvoir générer des plans de repas.
          </p>
        </div>
      )}

      {creating && householdId && (
        <ProfilForm
          householdId={householdId}
          onSaved={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {!creating && householdId && (
        <button
          onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Nouveau profil
        </button>
      )}
    </div>
  );
}

function ProfilSummary({
  profil,
}: {
  profil: {
    regimes: string[];
    aversions: string[];
    objectifsNutrition: string[];
    prefsCuisson: string[];
    notes?: string;
  };
}) {
  const sections: Array<{ label: string; items: string[] }> = [
    { label: "Régimes", items: profil.regimes },
    { label: "Aversions", items: profil.aversions },
    { label: "Objectifs", items: profil.objectifsNutrition },
    { label: "Cuisson", items: profil.prefsCuisson },
  ].filter((s) => s.items.length > 0);

  if (sections.length === 0 && !profil.notes) {
    return <p className="text-text-secondaire text-sm mt-1">Aucune contrainte renseignée.</p>;
  }

  return (
    <div className="text-sm text-text-secondaire mt-1 space-y-0.5">
      {sections.map((s) => (
        <p key={s.label}>
          <span className="font-medium text-text-principal">{s.label} :</span>{" "}
          {s.items.join(", ")}
        </p>
      ))}
      {profil.notes && (
        <p className="italic">
          <span className="font-medium not-italic text-text-principal">Notes :</span> {profil.notes}
        </p>
      )}
    </div>
  );
}
