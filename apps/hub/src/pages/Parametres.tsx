import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Pencil, Users } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useHouseholds } from "../lib/queries";
import { useUpdateHousehold } from "../lib/mutations";
import { heureValide, heuresRepasValides, type HeuresRepas, type HouseholdParametres, type Repas } from "@family-hub/types";
import HouseholdForm from "../components/HouseholdForm";
import InviterMembre from "../components/InviterMembre";
import { useInvitationEnAttente } from "../lib/invitationContext";
import { estParent } from "../lib/personnes";

const REPAS_CHAMPS: Array<{ repas: Repas; label: string }> = [
  { repas: "petitDej", label: "Petit-déjeuner" },
  { repas: "dej", label: "Déjeuner" },
  { repas: "diner", label: "Dîner" },
];

function HeuresRepasSection({
  uid,
  householdId,
  parametres,
}: {
  uid: string;
  householdId: string;
  parametres: HouseholdParametres;
}) {
  const update = useUpdateHousehold();
  const [heures, setHeures] = useState<HeuresRepas>(heuresRepasValides(parametres.heuresRepas));
  const [enregistre, setEnregistre] = useState(false);

  function set(periode: keyof HeuresRepas, repas: Repas, valeur: string) {
    setEnregistre(false);
    setHeures((h) => ({ ...h, [periode]: { ...h[periode], [repas]: valeur } }));
  }

  const toutValide = [...Object.values(heures.semaine), ...Object.values(heures.weekend)].every(heureValide);

  function enregistrer() {
    if (!toutValide) return;
    update.mutate(
      { uid, householdId, patch: { parametres: { ...parametres, heuresRepas: heures } } },
      { onSuccess: () => setEnregistre(true) },
    );
  }

  return (
    <section className="tile-card space-y-3">
      <h2 className="text-xl">Heures des repas</h2>
      <p className="text-text-secondaire text-sm">
        Sert à afficher le prochain repas sur le téléphone.
      </p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-center">
        <span />
        <span className="text-sm font-medium">Semaine</span>
        <span className="text-sm font-medium">Week-end</span>
        {REPAS_CHAMPS.map(({ repas, label }) => (
          <div key={repas} className="contents">
            <label htmlFor={`semaine-${repas}`}>{label}</label>
            <input
              id={`semaine-${repas}`}
              type="time"
              value={heures.semaine[repas]}
              onChange={(e) => set("semaine", repas, e.target.value)}
              className="input"
              aria-label={`${label}, semaine`}
            />
            <input
              id={`weekend-${repas}`}
              type="time"
              value={heures.weekend[repas]}
              onChange={(e) => set("weekend", repas, e.target.value)}
              className="input"
              aria-label={`${label}, week-end`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={enregistrer} disabled={update.isPending || !toutValide} className="btn-primary text-sm">
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {!toutValide && (
          <span className="text-sm text-red-600">Toutes les heures doivent être remplies</span>
        )}
        {enregistre && (
          <span className="text-sm flex items-center gap-1">
            <Check size={14} /> Enregistré
          </span>
        )}
        {update.isError && <span className="text-sm text-red-600">Échec de l'enregistrement.</span>}
      </div>
    </section>
  );
}

export default function Parametres() {
  const { user } = useAuth();
  const { data: households, isLoading } = useHouseholds(user?.uid);
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const invitation = useInvitationEnAttente();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Paramètres</h1>

      <section className="tile-card space-y-3">
        <h2 className="text-xl">Mon compte</h2>
        <div className="flex items-center gap-3">
          {user.photoURL && <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />}
          <div>
            <p>{user.displayName}</p>
            <p className="text-text-secondaire text-sm">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">Foyers</h2>

        {isLoading && <p className="text-text-secondaire">Chargement…</p>}

        {!isLoading && households && households.length > 0 && (
          <ul className="space-y-3">
            {households.map((h) =>
              editingId === h.id ? (
                <li key={h.id}>
                  <HouseholdForm
                    uid={user.uid}
                    existing={{ id: h.id, nom: h.nom, parametres: h.parametres }}
                    onSaved={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={h.id} className="tile-card flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-lg">{h.nom}</p>
                    <p className="text-text-secondaire text-sm mt-1">
                      {h.parametres?.localisation?.ville},{" "}
                      {h.parametres?.localisation?.pays}
                    </p>
                    <p className="text-text-secondaire text-xs mt-0.5">
                      {h.parametres?.localisation?.lat.toFixed(4)},{" "}
                      {h.parametres?.localisation?.lon.toFixed(4)} ·{" "}
                      {h.parametres?.localisation?.timezone} ·{" "}
                      {h.membres.length} membre{h.membres.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingId(h.id)}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Pencil size={14} />
                    Modifier
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        {invitation.enCours && (
          <p className="text-text-secondaire">Arrivée dans le foyer…</p>
        )}

        {!isLoading && !invitation.enCours && (!households || households.length === 0) && (
          <HouseholdForm
            uid={user.uid}
            onSaved={() => navigate("/")}
          />
        )}
      </section>

      {households && households.length > 0 && (
        <InviterMembre
          householdId={households[0].id}
          nomFoyer={households[0].nom}
          parent={estParent(households[0], user.uid)}
        />
      )}

      {households && households.length > 0 && (
        <HeuresRepasSection
          key={households[0].id}
          uid={user.uid}
          householdId={households[0].id}
          parametres={households[0].parametres}
        />
      )}

      {households && households.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Famille</h2>
          <Link
            to="/parametres/profils"
            className="tile-card flex items-center justify-between hover:bg-bordure/40 transition"
          >
            <div className="flex items-center gap-3">
              <Users size={20} className="text-text-secondaire" />
              <div>
                <p className="font-medium">Profils famille</p>
                <p className="text-text-secondaire text-sm">
                  Régimes, aversions individuelles, contraintes par personne.
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-text-secondaire" />
          </Link>
        </section>
      )}
    </div>
  );
}
