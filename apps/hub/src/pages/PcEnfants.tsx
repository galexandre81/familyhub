/**
 * « PC des enfants » : l'écran parent du contrôle parental, téléphone d'abord
 * (maquette A « Le mode au centre », validée le 27.10). Family Hub ne bloque
 * rien : il fixe les règles, le PC les applique et rend compte. De haut en
 * bas : le mode en cours, les quatre modes, Verrouiller / Couper internet,
 * les demandes de l'enfant, la journée, deux lignes repliées (internet, site
 * du prof), puis les réglages (fondateur du foyer seulement).
 *
 * Une seule décision à la fois (décision du 27.10) : toute décision a une
 * échéance (FeuilleEcheance, « Jusqu'à ce que je change » en tête) et
 * remplace la précédente, ce que la feuille dit.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Globe, Lock, LockOpen, Palette, RotateCcw, Search, WifiOff } from "lucide-react";
import {
  MODES,
  VALEUR,
  creerAppareil,
  etatEffectif,
  exceptionActive,
  poserException,
  revenirALaNormale,
  type EtatAppareil,
  type Mode,
  type Reglage,
} from "@family-hub/controle-parental";
import { heuresRepasValides, type Household } from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import { useActiveHouseholdId, useHouseholds, useProfils } from "../lib/queries";
import { estParent } from "../lib/personnes";
import { titrePcEnfants } from "../lib/pcEnfants";
import { useMaintenant } from "../lib/useMaintenant";
import {
  NOM_PARENT_MAX,
  alertesPc,
  carteMode,
  ecartAvecLePc,
  exceptionEnCours,
  fraicheur,
  jusquaTexte,
  libelleMode,
  nomAppli,
  nomMontre,
  noteApres,
  resumeMode,
  type SorteDecision,
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

type Decision = { sorte: "mode"; mode: Mode } | { sorte: Exclude<SorteDecision, "mode"> };

const ICONE_MODE: Record<Mode, typeof BookOpen> = {
  [VALEUR.mode.devoirs]: BookOpen,
  [VALEUR.mode.devoirsInternet]: Search,
  [VALEUR.mode.libre]: Palette,
  [VALEUR.mode.libreInternet]: Globe,
};

/** Ce que chaque décision écrit, et comment la feuille la présente. */
function presenter(d: Decision): { surtitre: string; titre: string; description?: string; reglage: Reglage } {
  switch (d.sorte) {
    case "mode":
      return { surtitre: "Changer de mode", titre: libelleMode(d.mode), description: resumeMode(d.mode), reglage: { mode: d.mode } };
    case "verrouiller":
      return { surtitre: "Verrouiller", titre: "PC verrouillé", reglage: { pc: VALEUR.pc.verrouille } };
    case "debloquer":
      return { surtitre: "Débloquer", titre: "PC débloqué", reglage: { pc: VALEUR.pc.autorise } };
    case "couper":
      return {
        surtitre: "Couper internet",
        titre: "Internet coupé",
        description: "Les applis restent ouvertes, mais plus aucun site, même de l'école.",
        reglage: { internet: VALEUR.internet.coupe },
      };
  }
}

const CARTE = "rounded-2xl bg-ebony-card border border-hairline";
const PASTILLE = "rounded-full bg-ebony-ridge px-3 py-1.5 text-sm text-cream";

/** Les parents du foyer, pour les noms montrés à l'enfant. */
function parentsDu(
  household: Household,
  moi: string,
  profils: Array<{ uid?: string; nom: string }> | undefined,
): Array<{ uid: string; libelle: string }> {
  const uids = household.roles
    ? Object.entries(household.roles)
        .filter(([, r]) => r === "parent")
        .map(([u]) => u)
    : household.membres;
  return uids.map((u) => ({
    uid: u,
    libelle: u === moi ? "Ton compte" : (profils?.find((p) => p.uid === u)?.nom ?? "L'autre parent"),
  }));
}

/** Le PC applique une décision prise SUR le PC (code parent) : « Revenir à la normale » l'annule aussi. */
function decisionSurLePc(etat: EtatAppareil | null): boolean {
  const locales: Array<string | null> = [VALEUR.source.codeParent, VALEUR.source.local];
  return !!etat && [etat.pc, etat.internet, etat.mode].some((d) => locales.includes(d.source));
}

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
  const [decision, setDecision] = useState<Decision | null>(null);

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
  const parents = parentsDu(household, user.uid, profils);
  if (!config) {
    return (
      <Cadre titre={titre} retour={retour}>
        {fondateur ? (
          <NouvelAppareil foyer={householdId!} nom={titre} parents={parents} uid={user.uid} />
        ) : (
          <p className="text-base text-cream-mute">Le PC n'est pas encore relié à Family Hub.</p>
        )}
      </Cadre>
    );
  }

  const fr = fraicheur(etat.donnees, maintenant);
  const carte = carteMode(config, maintenant, etat.donnees);
  const normal = etatEffectif({ ...config, exception: null }, maintenant);
  const enException = exceptionActive(config.exception, maintenant);
  const ecarts = ecartAvecLePc(config, etat.donnees, maintenant);
  const alertes = alertesPc(etat.donnees, maintenant);
  const par = nomMontre(config, user.uid);
  const nomDAppli = (id: string) => nomAppli(id, usage.donnees, etat.donnees);
  const IconeMode = carte.verrouille ? Lock : ICONE_MODE[carte.mode];
  const feuille = decision ? presenter(decision) : null;

  const decider = (jusqua: Date) => {
    if (!decision || !feuille) return;
    setDecision(null);
    if (jusqua.getTime() <= Date.now()) return refuser("Cette heure est déjà passée.");
    envoyer(
      poserException(db, config.id, { ...feuille.reglage, jusqua, par }, user.uid),
      `${feuille.titre} ${jusquaTexte(jusqua, new Date())}`,
    );
  };

  return (
    <Cadre titre={titre} retour={retour} fraicheur={fr}>
      <section aria-label="Mode en cours" className="rounded-3xl bg-ebony-card border border-hairline overflow-hidden">
        <div className="bg-ebony-ridge px-4 py-4 flex items-center gap-4">
          <span className="h-14 w-14 shrink-0 rounded-2xl bg-brass text-ebony inline-flex items-center justify-center">
            <IconeMode size={30} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold uppercase tracking-wider text-brass">
              {carte.verrouille ? "PC" : "Mode en cours"}
            </span>
            <span className="font-serif text-3xl leading-tight text-cream">{carte.verrouille ? "Verrouillé" : carte.libelle}</span>
          </div>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-[17px] leading-snug text-cream">{carte.verrouille ? `${carte.pc}.` : carte.description}</p>
          <ul className="flex flex-wrap gap-2" aria-label="Détails">
            {carte.verrouille ? (
              <li className={PASTILLE}>Ensuite : {carte.libelle}</li>
            ) : (
              <>
                <li className={PASTILLE}>{carte.origine}</li>
                <li className={PASTILLE}>{carte.pc}</li>
              </>
            )}
            {carte.internet && <li className={PASTILLE}>{carte.internet}</li>}
            {carte.ensuite && <li className={PASTILLE}>{carte.ensuite}</li>}
          </ul>
          {ecarts.map((e) => (
            <p key={e} className="text-[15px] text-cream-mute" aria-live="polite">
              {e}
            </p>
          ))}
          {!fr.enLigne && etat.donnees && (
            <p className="text-[15px] text-cream-mute">
              Le PC applique les dernières règles reçues ; les changements partiront à son retour.
            </p>
          )}
        </div>
      </section>

      {alertes.length > 0 && (
        <ul role="alert" className="rounded-2xl border border-copper p-4 flex flex-col gap-1 text-base text-cream">
          {alertes.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="changer" className="flex flex-col gap-2.5">
        <h2 id="changer" className="text-lg font-semibold text-cream">
          Changer de mode
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map((m) => {
            const actif = m.mode === carte.mode && !carte.verrouille;
            return (
              <button
                key={m.mode}
                type="button"
                aria-pressed={actif}
                onClick={() => setDecision({ sorte: "mode", mode: m.mode })}
                className={`text-left rounded-2xl bg-ebony-card p-3 min-h-[5.75rem] flex flex-col gap-1 ${
                  actif ? "border-2 border-brass" : "border border-hairline"
                }`}
              >
                <span className="text-base font-semibold text-cream">{m.libelle}</span>
                <span className="text-sm text-cream-mute">{resumeMode(m.mode)}</span>
              </button>
            );
          })}
        </div>
        <p className="text-sm text-cream-mute">
          Un mode choisi dure jusqu'à l'heure que tu fixes, puis le PC revient en {libelleMode(normal.mode)}.
        </p>
      </section>

      <section aria-label="Agir sur le PC" className="grid grid-cols-2 gap-2.5">
        {carte.verrouille ? (
          <button
            type="button"
            onClick={() => setDecision({ sorte: "debloquer" })}
            className="min-h-14 rounded-xl inline-flex items-center justify-center gap-2 text-base font-semibold bg-brass text-ebony"
          >
            <LockOpen size={20} aria-hidden="true" /> Débloquer
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDecision({ sorte: "verrouiller" })}
            className="min-h-14 rounded-xl inline-flex items-center justify-center gap-2 text-base font-semibold bg-cream text-ebony"
          >
            <Lock size={20} aria-hidden="true" /> Verrouiller
          </button>
        )}
        <button
          type="button"
          onClick={() => setDecision({ sorte: "couper" })}
          className="min-h-14 rounded-xl inline-flex items-center justify-center gap-2 text-base font-semibold text-cream bg-ebony-card border border-hairline"
        >
          <WifiOff size={20} aria-hidden="true" /> Couper internet
        </button>
        {(enException || decisionSurLePc(etat.donnees)) && (
          <button
            type="button"
            onClick={() => envoyer(revenirALaNormale(db, config.id, user.uid), "Retour à la normale")}
            className="col-span-2 min-h-14 rounded-xl inline-flex items-center justify-center gap-2 text-base text-cream bg-ebony-card border border-brass"
          >
            <RotateCcw size={20} aria-hidden="true" /> Revenir à la normale
          </button>
        )}
      </section>

      <Demandes
        config={config}
        demandes={demandes.donnees}
        uid={user.uid}
        par={par}
        nomAppli={nomDAppli}
        maintenant={maintenant}
      />
      <Journee usage={usage.donnees} etat={etat.donnees} />
      <InternetDuJour appareilId={config.id} rapport={rapport} maintenant={maintenant} />
      <SiteDuProf config={config} uid={user.uid} />

      {fondateur && (
        <details className="flex flex-col gap-2">
          <summary className="min-h-12 flex items-center justify-center text-base text-cream-mute underline underline-offset-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            Réglages (planning, applis, limites)
          </summary>
          <Reglages config={config} etat={etat.donnees} uid={user.uid} parents={parents} rapport={rapport} />
        </details>
      )}

      {decision && feuille && (
        <FeuilleEcheance
          surtitre={feuille.surtitre}
          titre={feuille.titre}
          description={feuille.description}
          sorte={decision.sorte}
          remplace={exceptionEnCours(config, maintenant)}
          note={noteApres(config, feuille.reglage, maintenant)}
          heuresRepas={heuresRepasValides(household.parametres?.heuresRepas)}
          onChoisir={decider}
          onFermer={() => setDecision(null)}
        />
      )}
    </Cadre>
  );
}

function Cadre({
  titre,
  retour,
  fraicheur: fr,
  children,
}: {
  titre: string;
  retour: () => void;
  fraicheur?: { enLigne: boolean; texte: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 max-w-xl">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={retour}
          className="min-h-12 -ml-2 px-2 inline-flex items-center gap-2 rounded-xl text-base text-cream-mute"
        >
          <ArrowLeft size={20} aria-hidden="true" />
          Retour
        </button>
        {fr && (
          <span className="flex items-center gap-2 text-sm text-cream-mute">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${fr.enLigne ? "bg-sage" : "bg-copper"}`} />
            {fr.texte}
          </span>
        )}
      </div>
      <h1 className="font-serif text-3xl text-cream -mt-3">{titre}</h1>
      {children}
    </div>
  );
}

/** Premier branchement : l'identifiant convenu avec le PC, son compte, et le nom de chaque parent sur le PC. */
function NouvelAppareil({
  foyer,
  nom,
  parents,
  uid,
}: {
  foyer: string;
  nom: string;
  parents: Array<{ uid: string; libelle: string }>;
  uid: string;
}) {
  const [id, setId] = useState("");
  const [compte, setCompte] = useState("");
  const [noms, setNoms] = useState<Record<string, string>>({});
  const idValide = /^[a-z0-9][a-z0-9-]{1,40}$/.test(id);
  const CHAMP = "min-h-12 rounded-xl bg-ebony border border-hairline px-3 text-base text-cream";
  return (
    <section className={`${CARTE} p-4 flex flex-col gap-3`}>
      <p className="text-base text-cream">Le PC n'est pas encore relié à Family Hub.</p>
      <label className="flex flex-col gap-1 text-[15px] text-cream-mute">
        Identifiant du PC (celui que son agent attend)
        <input value={id} onChange={(e) => setId(e.target.value.trim().toLowerCase())} className={CHAMP} />
      </label>
      <label className="flex flex-col gap-1 text-[15px] text-cream-mute">
        Compte du PC (peut se renseigner plus tard)
        <input value={compte} onChange={(e) => setCompte(e.target.value.trim())} className={CHAMP} />
      </label>
      <p className="text-[15px] text-cream-mute">Le nom que le PC montre quand un parent décide :</p>
      {parents.map((p) => (
        <label key={p.uid} className="flex flex-col gap-1 text-[15px] text-cream-mute">
          {p.libelle}
          <input
            value={noms[p.uid] ?? ""}
            maxLength={NOM_PARENT_MAX}
            placeholder="Ex. Papa, Maman"
            onChange={(e) => setNoms({ ...noms, [p.uid]: e.target.value })}
            className={CHAMP}
          />
        </label>
      ))}
      <button
        type="button"
        disabled={!idValide}
        onClick={() =>
          envoyer(
            creerAppareil(db, {
              appareilId: id,
              foyer,
              compteAppareil: compte || null,
              nom,
              nomsParents: Object.fromEntries(
                Object.entries(noms)
                  .map(([u, n]) => [u, n.trim()] as const)
                  .filter(([, n]) => n),
              ),
              uid,
            }),
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
