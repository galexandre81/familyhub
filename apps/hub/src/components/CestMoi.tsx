import { useState } from "react";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useProfils } from "../lib/queries";
import { useLierProfilAuCompte } from "../lib/mutations";
import { profilDuCompte } from "../lib/personnes";
import ProfilBadge from "./ProfilBadge";

const CLE_PLUS_TARD = "familyHub.cestMoiPlusTard";

function lirePlusTard(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(CLE_PLUS_TARD) === "1";
  } catch {
    return false;
  }
}

function garderPlusTard(): void {
  try {
    globalThis.sessionStorage?.setItem(CLE_PLUS_TARD, "1");
  } catch {
    /* stockage bloqué : l'état React suffit pour cette visite */
  }
}

/**
 * Sur téléphone : si aucun profil n'est relié au compte connecté, demande « Qui es-tu ? ».
 * Ne rend rien une fois le compte relié. Jamais bloquant : « plus tard »
 * (pour cette session) et « Se déconnecter » sont toujours proposés.
 * Le choix est enregistré sans attendre le serveur (useLierProfilAuCompte).
 */
export default function CestMoi() {
  const { user, signOut } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const lier = useLierProfilAuCompte();
  const [plusTard, setPlusTard] = useState(lirePlusTard);

  if (plusTard || !user || !householdId || !profils || profils.length === 0) return null;
  if (profilDuCompte(profils, user.uid)) return null;

  const dejaLies = profils.filter((p) => p.uid === user.uid).map((p) => p.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Qui es-tu ?"
      className="fixed inset-0 z-50 bg-ebony flex flex-col p-4 gap-4 overflow-y-auto"
    >
      <h1 className="text-2xl text-cream">Qui es-tu ?</h1>
      <p className="text-cream-mute text-base">Choisis ton profil pour que le hub te reconnaisse.</p>
      <ul className="flex flex-col gap-3">
        {profils.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={lier.isPending}
              onClick={() => {
                if (
                  p.uid &&
                  p.uid !== user.uid &&
                  !window.confirm("Ce profil est déjà relié à un autre compte. Le reprendre ?")
                )
                  return;
                lier.mutate({
                  householdId,
                  profilId: p.id,
                  uid: user.uid,
                  autresProfilIds: dejaLies,
                });
              }}
              className="w-full min-h-12 flex items-center gap-3 rounded-xl bg-ebony-card border border-hairline px-4 py-2 text-left text-cream text-lg"
            >
              <ProfilBadge
                initiale={p.initiale}
                couleur={p.couleur}
                couleurPersonne={p.couleurPersonne}
                size="md"
              />
              <span>{p.nom}</span>
            </button>
          </li>
        ))}
      </ul>
      {lier.isError && (
        <p className="text-base text-cream">Impossible d'enregistrer, réessaie dans un instant.</p>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            garderPlusTard();
            setPlusTard(true);
          }}
          className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-hairline px-4 text-base text-cream"
        >
          <Clock size={20} aria-hidden="true" />
          Je ne suis pas dans la liste — plus tard
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl px-4 text-base text-cream-mute"
        >
          <LogOut size={20} aria-hidden="true" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
