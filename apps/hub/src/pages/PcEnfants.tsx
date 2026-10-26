/**
 * « PC des enfants » : l'écran parent du contrôle parental, téléphone d'abord.
 * Family Hub ne bloque rien : il fixe les règles, le PC les applique et rend
 * compte. Ordre de la page, du plus urgent au plus rare : l'état en une
 * phrase, les demandes en attente, les quatre boutons, le site du prof, la
 * journée, puis les réglages (fondateur du foyer seulement).
 *
 * Toute décision a une échéance (FeuilleEcheance) ; une nouvelle décision
 * remplace la précédente, et la feuille dit laquelle.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, GraduationCap, Lock, LockOpen, RotateCcw } from "lucide-react";
import {
  VALEUR,
  exceptionActive,
  poserException,
  revenirALaNormale,
  creerAppareil,
  type Exception,
} from "@family-hub/controle-parental";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { useActiveHouseholdId, useHouseholds, useProfils } from "../lib/queries";
import { estParent } from "../lib/personnes";
import { titrePcEnfants } from "../lib/pcEnfants";
import { useMaintenant } from "../lib/useMaintenant";
import {
  exceptionEnCours,
  fraicheur,
  phraseEtat,
  quandTexte,
} from "../lib/controleParental/phrases";
import {
  useAppareilDuFoyer,
  useDemandesEnAttente,
  useEtatAppareil,
  useUsageDuJour,
} from "../lib/controleParental/useControleParental";
import { envoyer, refuser } from "../lib/controleParental/envoyer";
import { ErrorState, LoadingState } from "../components/states";
import FeuilleEcheance from "../components/pcEnfants/FeuilleEcheance";
import Demandes from "../components/pcEnfants/Demandes";
import Journee from "../components/pcEnfants/Journee";
import SiteDuProf from "../components/pcEnfants/SiteDuProf";
import Reglages from "../components/pcEnfants/Reglages";
import InternetDuJour from "../components/pcEnfants/InternetDuJour";
import { useRapportNextdns } from "../lib/controleParental/nextdns";

type Sorte = "debloquer" | "verrouiller" | "ecole";

const ACTIONS: Record<Sorte, { titre: string; regle: Omit<Exception, "jusqua" | "par">; fait: string }> = {
  verrouiller: { titre: "Verrouiller maintenant", regle: { pc: VALEUR.pc.verrouille }, fait: "PC verrouillé" },
  debloquer: { titre: "Débloquer", regle: { pc: VALEUR.pc.autorise }, fait: "PC débloqué" },
  ecole: { titre: "Mode école", regle: { internet: VALEUR.internet.ecole }, fait: "Mode école" },
};

const CARTE = "rounded-2xl bg-ebony-card border border-hairline";
const BOUTON = "min-h-14 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 text-base text-cream bg-ebony-card border border-hairline";

export default function PcEnfants() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: households, isLoading } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);
  const { data: profils } = useProfils(householdId);
  const maintenant = useMaintenant();
  const appareil = useAppareilDuFoyer(householdId);
  const config = appareil.donnees;
  const etat = useEtatAppareil(config?.id);
  const usage = useUsageDuJour(config?.id, maintenant);
  const demandes = useDemandesEnAttente(config?.id);
  const rapport = useRapportNextdns(config?.id);
  const [feuille, setFeuille] = useState<Sorte | null>(null);

  const retour = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  const titre = titrePcEnfants(household?.parametres);

  if (isLoading || appareil.chargement) return <LoadingState />;
  if (!household || !user || !estParent(household, user.uid)) {
    return (
      <Cadre titre={titre} retour={retour}>
        <p className="text-base text-cream-mute">Cet écran est réservé aux parents.</p>
      </Cadre>
    );
  }
  if (appareil.erreur) return <ErrorState message="Impossible de lire l'état du PC." />;
  const fondateur = household.ownerUid === user.uid;
  if (!config) {
    return (
      <Cadre titre={titre} retour={retour}>
        {fondateur ? (
          <NouvelAppareil foyer={householdId!} uid={user.uid} />
        ) : (
          <p className="text-base text-cream-mute">Le PC n'est pas encore relié à Family Hub.</p>
        )}
      </Cadre>
    );
  }

  const fr = fraicheur(etat.donnees, maintenant);
  const ex = exceptionActive(config.exception, maintenant) ? config.exception : null;
  const auteur = ex ? nomDe(ex.par, user.uid, profils) : null;

  const decider = (sorte: Sorte, jusqua: Date) => {
    setFeuille(null);
    if (jusqua.getTime() <= Date.now()) return refuser("Cette heure est déjà passée.");
    const a = ACTIONS[sorte];
    envoyer(
      poserException(db, config.id, { ...a.regle, jusqua, par: user.uid }),
      `${a.fait} jusqu'à ${quandTexte(jusqua, new Date())}`,
    );
  };

  return (
    <Cadre titre={titre} retour={retour}>
      <section aria-label="État du PC" className={`${CARTE} p-4 flex flex-col gap-2`}>
        <p className="text-xl text-cream leading-snug">{phraseEtat(config, maintenant)}</p>
        <p className="flex items-center gap-2 text-base text-cream-mute">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${fr.enLigne ? "bg-sage" : "bg-copper"}`} />
          {fr.texte}
        </p>
        {!fr.enLigne && etat.donnees && (
          <p className="text-[15px] text-cream-mute">
            Il applique les dernières règles reçues ; les changements partiront à son retour.
          </p>
        )}
        {auteur && <p className="text-[15px] text-cream-mute">Décidé par {auteur}.</p>}
      </section>

      <Demandes config={config} demandes={demandes.donnees} uid={user.uid} maintenant={maintenant} />

      <section aria-label="Décider" className="grid grid-cols-2 gap-3">
        <button type="button" className={BOUTON} onClick={() => setFeuille("verrouiller")}>
          <Lock size={20} aria-hidden="true" /> Verrouiller maintenant
        </button>
        <button type="button" className={BOUTON} onClick={() => setFeuille("debloquer")}>
          <LockOpen size={20} aria-hidden="true" /> Débloquer jusqu'à…
        </button>
        <button type="button" className={BOUTON} onClick={() => setFeuille("ecole")}>
          <GraduationCap size={20} aria-hidden="true" /> Mode école jusqu'à…
        </button>
        <button
          type="button"
          className={`${BOUTON} disabled:opacity-40`}
          disabled={!ex}
          onClick={() => envoyer(revenirALaNormale(db, config.id, user.uid), "Retour à la normale")}
        >
          <RotateCcw size={20} aria-hidden="true" /> Revenir à la normale
        </button>
      </section>

      <SiteDuProf config={config} uid={user.uid} />
      <Journee config={config} usage={usage.donnees} />
      <InternetDuJour appareilId={config.id} rapport={rapport} maintenant={maintenant} />
      {fondateur && <Reglages config={config} uid={user.uid} rapport={rapport} />}

      {feuille && (
        <FeuilleEcheance
          titre={ACTIONS[feuille].titre}
          sorte={feuille}
          remplace={exceptionEnCours(config, maintenant)}
          onChoisir={(jusqua) => decider(feuille, jusqua)}
          onFermer={() => setFeuille(null)}
        />
      )}
    </Cadre>
  );
}

function Cadre({ titre, retour, children }: { titre: string; retour: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <button
        type="button"
        onClick={retour}
        className="self-start min-h-12 -ml-2 px-2 inline-flex items-center gap-2 rounded-xl text-base text-cream-mute"
      >
        <ArrowLeft size={20} aria-hidden="true" />
        Retour
      </button>
      <h1 className="font-serif text-2xl text-cream -mt-3">{titre}</h1>
      {children}
    </div>
  );
}

/** « toi », le prénom du profil relié à ce compte, ou « l'autre parent ». */
function nomDe(uid: string, moi: string, profils: Array<{ uid?: string; nom: string }> | undefined): string {
  if (uid === moi) return "toi";
  return profils?.find((p) => p.uid === uid)?.nom ?? "l'autre parent";
}

/** Premier branchement : l'identifiant convenu avec le PC et son compte (procédure COMPTE-APPAREIL.md). */
function NouvelAppareil({ foyer, uid }: { foyer: string; uid: string }) {
  const [id, setId] = useState("");
  const [compte, setCompte] = useState("");
  const idValide = /^[a-z0-9][a-z0-9-]{1,40}$/.test(id);
  return (
    <section className={`${CARTE} p-4 flex flex-col gap-3`}>
      <p className="text-base text-cream">Le PC n'est pas encore relié à Family Hub.</p>
      <label className="flex flex-col gap-1 text-[15px] text-cream-mute">
        Identifiant du PC (celui que son agent attend)
        <input
          value={id}
          onChange={(e) => setId(e.target.value.trim().toLowerCase())}
          className="min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream"
        />
      </label>
      <label className="flex flex-col gap-1 text-[15px] text-cream-mute">
        Compte du PC (peut se renseigner plus tard)
        <input
          value={compte}
          onChange={(e) => setCompte(e.target.value.trim())}
          className="min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream"
        />
      </label>
      <button
        type="button"
        disabled={!idValide}
        onClick={() =>
          envoyer(
            creerAppareil(db, { appareilId: id, foyer, compteAppareil: compte || null, nom: null, par: uid }),
            "PC relié à Family Hub",
          )
        }
        className="min-h-12 rounded-xl px-4 text-base font-semibold bg-brass text-ebony disabled:opacity-40"
      >
        Relier le PC
      </button>
    </section>
  );
}
