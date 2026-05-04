import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Check,
  Copy,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  useActiveHouseholdId,
  useDraftPlan,
  useHouseholds,
  usePlanSlots,
  useProfils,
} from "../lib/queries";
import {
  useCreateMealPlan,
  useDeleteMealPlan,
} from "../lib/mutations";
import PresenceGrid, {
  buildDefaultPresence,
  presenceToApi,
  type PresenceState,
} from "../components/menu/PresenceGrid";
import { buildPlanMd, PLAN_PROMPT_TEMPLATE, type PresenceMap } from "../lib/planMd";
import type { Profil } from "@family-hub/types";

type WizardStep = "date" | "presence" | "contexte" | "review";

export default function MenuWizard() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: profils } = useProfils(householdId);
  const { data: draftPlan } = useDraftPlan(householdId);

  // Si un draft existe déjà, on saute directement au review
  const initialStep: WizardStep = draftPlan ? "review" : "date";
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [error, setError] = useState<string | null>(null);

  const [dateDebut, setDateDebut] = useState<string>(nextMondayISO());
  const [presence, setPresence] = useState<PresenceState>({});
  const [batchOk, setBatchOk] = useState(false);
  const [style, setStyle] = useState("");
  const [frigo, setFrigo] = useState("");

  const profilIds = useMemo(() => (profils ?? []).map((p) => p.id), [profils]);

  // Init présence par défaut quand on connaît les profils
  useMemo(() => {
    if (profilIds.length && Object.keys(presence).length === 0) {
      setPresence(buildDefaultPresence(profilIds));
    }
  }, [profilIds, presence]);

  const create = useCreateMealPlan();
  const deletePlan = useDeleteMealPlan();

  async function handleStartReview() {
    if (!householdId) return;
    setError(null);
    try {
      await create.mutateAsync({
        householdId,
        dateDebutISO: new Date(dateDebut).toISOString(),
        contexte: { batchCookingOk: batchOk, style, frigoTexte: frigo },
        presence: presenceToApi(presence),
      });
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function handleAbandonDraft() {
    if (!householdId || !draftPlan) return;
    if (!confirm("Abandonner le brouillon ? Tout son contenu sera supprimé.")) return;
    await deletePlan.mutateAsync({ householdId, planId: draftPlan.id });
    setStep("date");
  }

  if (!householdId) return null;

  if (!profils || profils.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl">Nouveau plan</h1>
        <div className="tile-card text-center py-8">
          <p className="mb-3">Aucun profil dans le foyer.</p>
          <p className="text-cream-mute text-sm mb-4">
            Crée au moins un profil par membre de la famille pour pouvoir générer des plans.
          </p>
          <Link to="/parametres/profils" className="btn-primary inline-block">
            Créer un profil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/menu" className="text-cream-mute hover:text-cream">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl flex items-center gap-3">
          <ChefHat size={26} className="text-brass" />
          Nouveau plan
        </h1>
      </div>

      <Stepper current={step} hasDraft={!!draftPlan} />

      {step === "date" && (
        <StepDate
          dateDebut={dateDebut}
          setDateDebut={setDateDebut}
          onNext={() => setStep("presence")}
        />
      )}

      {step === "presence" && (
        <StepPresence
          profils={profils}
          presence={presence}
          setPresence={setPresence}
          onPrev={() => setStep("date")}
          onNext={() => setStep("contexte")}
        />
      )}

      {step === "contexte" && (
        <StepContexte
          batchOk={batchOk}
          setBatchOk={setBatchOk}
          style={style}
          setStyle={setStyle}
          frigo={frigo}
          setFrigo={setFrigo}
          error={error}
          onPrev={() => setStep("presence")}
          onNext={handleStartReview}
          loading={create.isPending}
        />
      )}

      {step === "review" && draftPlan && (
        <StepReview
          householdId={householdId}
          planId={draftPlan.id}
          profils={profils}
          onAbandon={handleAbandonDraft}
        />
      )}
    </div>
  );
}

function Stepper({ current, hasDraft }: { current: WizardStep; hasDraft: boolean }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "date", label: "Date" },
    { key: "presence", label: "Présence" },
    { key: "contexte", label: "Contexte" },
    { key: "review", label: "Revue" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < currentIdx || (hasDraft && s.key !== "review" && current === "review");
        const active = s.key === current;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                active
                  ? "bg-brass text-ebony"
                  : done
                    ? "bg-sage/30 text-sage"
                    : "bg-ebony-card text-cream-mute"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`uppercase tracking-widest text-[10px] ${
                active ? "text-brass" : done ? "text-sage" : "text-cream-mute"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="w-6 h-px bg-wood-dark" />}
          </div>
        );
      })}
    </div>
  );
}

function StepDate({
  dateDebut,
  setDateDebut,
  onNext,
}: {
  dateDebut: string;
  setDateDebut: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="tile-card space-y-4">
      <div>
        <h2 className="text-xl mb-1">Quand commence la semaine ?</h2>
        <p className="text-cream-mute text-sm">
          Par défaut, lundi prochain. Tu peux choisir un autre lundi si tu planifies à l'avance.
        </p>
      </div>
      <input
        type="date"
        value={dateDebut}
        onChange={(e) => setDateDebut(e.target.value)}
        className="input"
      />
      <div className="flex justify-end">
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StepPresence({
  profils,
  presence,
  setPresence,
  onPrev,
  onNext,
}: {
  profils: Array<{ id: string; nom: string; initiale: string; couleur: string; emoji?: string }>;
  presence: PresenceState;
  setPresence: (p: PresenceState) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="tile-card">
        <h2 className="text-xl mb-1">Qui mange à quels repas ?</h2>
        <p className="text-cream-mute text-sm">
          Par défaut tout le monde est présent à tous les repas. Décoche les exceptions
          (école, dîner chez des amis, déjeuner au bureau…).
        </p>
      </div>
      <PresenceGrid
        profils={profils as never}
        presence={presence}
        onChange={setPresence}
      />
      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
          <ArrowLeft size={14} /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2">
          Suivant <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function StepContexte({
  batchOk,
  setBatchOk,
  style,
  setStyle,
  frigo,
  setFrigo,
  error,
  onPrev,
  onNext,
  loading,
}: {
  batchOk: boolean;
  setBatchOk: (v: boolean) => void;
  style: string;
  setStyle: (v: string) => void;
  frigo: string;
  setFrigo: (v: string) => void;
  error: string | null;
  onPrev: () => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="tile-card space-y-5">
      <div>
        <h2 className="text-xl mb-1">Contexte de la semaine</h2>
        <p className="text-cream-mute text-sm">
          Ces infos guident le LLM. Tout est optionnel sauf le batch cooking.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={batchOk}
          onChange={(e) => setBatchOk(e.target.checked)}
          className="w-4 h-4 rounded text-brass focus:ring-brass"
        />
        <span className="text-sm">
          Batch cooking OK le dimanche (préparer en avance pour la semaine)
        </span>
      </label>

      <div>
        <label className="block text-sm text-cream-mute mb-1">Style ou envie</label>
        <input
          type="text"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          maxLength={300}
          className="input"
          placeholder="ex: léger et végé cette semaine, on est crevés"
        />
      </div>

      <div>
        <label className="block text-sm text-cream-mute mb-1">À écouler du frigo</label>
        <textarea
          value={frigo}
          onChange={(e) => setFrigo(e.target.value)}
          rows={3}
          maxLength={2000}
          className="input"
          placeholder="ex: reste de poulet, 3 courgettes, 1 fromage blanc"
        />
        <p className="text-xs text-cream-mute mt-1">
          {frigo.length} / 2000 caractères. Ces ingrédients seront utilisés en priorité et
          n'iront pas dans la liste de courses.
        </p>
      </div>

      {error && <p className="text-copper text-sm">{error}</p>}

      <div className="flex justify-between">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <ArrowLeft size={14} /> Précédent
        </button>
        <button onClick={onNext} className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Création…
            </>
          ) : (
            <>
              Créer le brouillon <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function StepReview({
  householdId,
  planId,
  profils,
  onAbandon,
}: {
  householdId: string;
  planId: string;
  profils: Array<Profil & { id: string }>;
  onAbandon: () => void;
}) {
  const { user } = useAuth();
  const { data: households } = useHouseholds(user?.uid);
  const household = households?.find((h) => h.id === householdId);
  const { data: slots } = usePlanSlots(householdId, planId);
  const { data: draftPlan } = useDraftPlan(householdId);

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [downloadedMd, setDownloadedMd] = useState(false);

  const presence: PresenceMap = useMemo(() => {
    const out: PresenceMap = {};
    if (slots) {
      for (const s of slots) {
        out[`${s.jour}-${s.repas}`] = s.profilsPresents ?? [];
      }
    }
    return out;
  }, [slots]);

  const dateDebutISO = useMemo(() => {
    if (!draftPlan?.dateDebut) return new Date().toISOString().slice(0, 10);
    const ts = draftPlan.dateDebut as unknown;
    if (ts instanceof Date) return ts.toISOString().slice(0, 10);
    if (typeof ts === "object" && ts && "seconds" in ts) {
      return new Date((ts as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
    }
    if (typeof ts === "string") return ts.slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  }, [draftPlan]);

  const md = useMemo(() => {
    if (!draftPlan || !slots || !household) return "";
    return buildPlanMd({
      householdNom: household.nom,
      dateDebutISO,
      profils,
      presence,
      contexte: draftPlan.contexte,
      historiqueRecettes: [], // TODO 3.2+ : query recettes used in last 3 plans
    });
  }, [draftPlan, slots, household, dateDebutISO, profils, presence]);

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(PLAN_PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      alert(
        "Impossible de copier automatiquement. Sélectionne le texte ci-dessous et fais Ctrl+C.",
      );
    }
  }

  function handleDownloadMd() {
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-${dateDebutISO}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedMd(true);
    setTimeout(() => setDownloadedMd(false), 2500);
  }

  if (!slots || !household) {
    return (
      <div className="tile-card">
        <p className="text-cream-mute">Chargement du brouillon…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="tile-card space-y-2">
        <h2 className="text-xl">Brouillon prêt à exporter</h2>
        <p className="text-cream-mute text-sm">
          Le plan est en brouillon avec présence et contexte enregistrés.
          Suis les 4 étapes ci-dessous pour générer le menu via Claude.ai puis
          le réimporter.
        </p>
      </div>

      {/* Étape 1 — copier le prompt */}
      <div className="tile-card space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            1
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Copier le prompt pour Claude.ai</h3>
            <p className="text-cream-mute text-sm">
              Ouvre une nouvelle conversation Claude.ai (Pro ou web), colle ce
              prompt en premier message.
            </p>
          </div>
        </div>
        <button
          onClick={handleCopyPrompt}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          {copiedPrompt ? (
            <>
              <Check size={14} className="text-sage" /> Copié
            </>
          ) : (
            <>
              <Copy size={14} /> Copier le prompt
            </>
          )}
        </button>
      </div>

      {/* Étape 2 — télécharger le .md */}
      <div className="tile-card space-y-3">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            2
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Télécharger le contexte du plan</h3>
            <p className="text-cream-mute text-sm">
              Ouvre le <code className="text-xs px-1 bg-ebony-ridge rounded">.md</code>{" "}
              dans un éditeur, copie tout le contenu, colle-le dans Claude.ai{" "}
              <em>après</em> le prompt (dans le même message ou en deuxième).
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadMd}
          disabled={!md}
          className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-40"
        >
          {downloadedMd ? (
            <>
              <Check size={14} className="text-sage" /> Téléchargé
            </>
          ) : (
            <>
              <Download size={14} /> Télécharger plan-{dateDebutISO}.md
            </>
          )}
        </button>
        <details className="text-xs text-cream-mute">
          <summary className="cursor-pointer hover:text-cream">
            Aperçu du contenu du .md
          </summary>
          <pre className="mt-2 p-3 bg-ebony-ridge rounded overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap">
            {md.length > 4000 ? md.slice(0, 4000) + "\n\n…(tronqué)" : md}
          </pre>
        </details>
      </div>

      {/* Étape 3 — Claude.ai génère */}
      <div className="tile-card">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            3
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Récupérer le JSON de Claude.ai</h3>
            <p className="text-cream-mute text-sm">
              Claude renvoie un JSON brut commençant par{" "}
              <code className="text-xs px-1 bg-ebony-ridge rounded">{`{`}</code>.
              Copie-le entièrement (sélectionner tout le bloc).
            </p>
          </div>
        </div>
      </div>

      {/* Étape 4 — importer */}
      <div className="tile-card">
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-brass text-ebony flex items-center justify-center text-sm font-semibold shrink-0">
            4
          </span>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Importer le JSON ici</h3>
            <p className="text-cream-mute text-sm mb-3">
              Tu peux laisser cette page ouverte pendant que tu utilises
              Claude.ai. Quand tu as le JSON, clique sur le bouton ci-dessous.
            </p>
            <Link
              to={`/menu/import?planId=${planId}`}
              className="btn-primary text-sm flex items-center gap-2 w-fit"
            >
              <Upload size={14} /> J'ai le JSON, importer le plan →
            </Link>
          </div>
        </div>
      </div>

      {/* Footer : abandonner */}
      <div className="flex items-center justify-end pt-2">
        <button onClick={onAbandon} className="text-cream-mute hover:text-copper text-xs">
          Abandonner ce brouillon
        </button>
      </div>
    </div>
  );
}

function nextMondayISO(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=dim, 1=lun
  const daysUntilMonday = (8 - dow) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}
