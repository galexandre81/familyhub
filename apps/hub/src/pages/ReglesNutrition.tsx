import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Salad, Save, X, Plus } from "lucide-react";
import {
  buildReglesFromPreset,
  NUTRITION_PRESETS,
  type PresetNutritionId,
  type ReglesNutrition,
} from "@family-hub/types";
import { useAuth } from "../lib/auth";
import { useActiveHouseholdId, useReglesNutrition } from "../lib/queries";
import { useUpdateReglesNutrition } from "../lib/mutations";

const PRESET_ORDER: PresetNutritionId[] = [
  "equilibre",
  "perte-poids",
  "proteine",
  "mediterraneen",
  "vegetarien-equilibre",
  "sans-sel-strict",
  "custom",
];

export default function ReglesNutritionPage() {
  const { user } = useAuth();
  const householdId = useActiveHouseholdId(user?.uid);
  const { data: regles, isLoading } = useReglesNutrition(householdId);
  const update = useUpdateReglesNutrition();

  const [draft, setDraft] = useState<ReglesNutrition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (regles && !draft) setDraft(regles);
  }, [regles, draft]);

  if (!householdId || !draft) {
    return (
      <div className="text-text-secondaire">{isLoading ? "Chargement…" : "Aucun foyer actif"}</div>
    );
  }

  function applyPreset(presetId: PresetNutritionId) {
    if (presetId === "custom") {
      setDraft((d) => (d ? { ...d, presetId: "custom" } : d));
      return;
    }
    setDraft(buildReglesFromPreset(presetId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!draft) return;
    const sum = draft.ratios.legumes + draft.ratios.proteines + draft.ratios.feculents;
    if (Math.abs(sum - 100) > 0.5) {
      setError(`Les ratios doivent sommer à 100 (actuel : ${sum}).`);
      return;
    }
    if (draft.maxFeculentsParRepas < 1 || draft.maxFeculentsParRepas > 5) {
      setError("Le nombre max de féculents par repas doit être entre 1 et 5.");
      return;
    }
    try {
      await update.mutateAsync({ householdId: householdId!, regles: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/parametres" className="text-text-secondaire hover:text-text-principal">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-3xl flex items-center gap-3">
          <Salad size={26} className="text-accent-chaud" />
          Règles nutrition
        </h1>
      </div>

      <p className="text-text-secondaire text-sm">
        Règles structurelles appliquées à <strong>toute la famille</strong>. Le seed et le meal
        planner s'en servent pour générer / piocher des recettes équilibrées et rejeter celles qui
        violent les règles. Les contraintes individuelles (régimes, aversions) restent dans le
        profil de chaque personne.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Preset selector */}
        <section className="tile-card space-y-3">
          <h2 className="text-xl">Preset</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_ORDER.map((id) => {
              const isActive = draft.presetId === id;
              const label =
                id === "custom" ? "Personnalisé" : NUTRITION_PRESETS[id].nomAffiche;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={`text-left p-3 rounded border transition ${
                    isActive
                      ? "border-accent-chaud bg-bordure"
                      : "border-bordure hover:bg-bordure/40"
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  {id !== "custom" && (
                    <div className="text-xs text-text-secondaire mt-0.5">
                      {NUTRITION_PRESETS[id].ratios.legumes}% lég. /{" "}
                      {NUTRITION_PRESETS[id].ratios.proteines}% prot. /{" "}
                      {NUTRITION_PRESETS[id].ratios.feculents}% féc.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Nom + ratios */}
        <section className="tile-card space-y-4">
          <h2 className="text-xl">Structure d'un repas</h2>

          <Field label="Nom affiché">
            <input
              type="text"
              value={draft.nomAffiche}
              onChange={(e) => setDraft({ ...draft, nomAffiche: e.target.value })}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="% Légumes">
              <input
                type="number"
                value={draft.ratios.legumes}
                min={0}
                max={100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ratios: { ...draft.ratios, legumes: Number(e.target.value) },
                  })
                }
                className="input"
              />
            </Field>
            <Field label="% Protéines">
              <input
                type="number"
                value={draft.ratios.proteines}
                min={0}
                max={100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ratios: { ...draft.ratios, proteines: Number(e.target.value) },
                  })
                }
                className="input"
              />
            </Field>
            <Field label="% Féculents">
              <input
                type="number"
                value={draft.ratios.feculents}
                min={0}
                max={100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ratios: { ...draft.ratios, feculents: Number(e.target.value) },
                  })
                }
                className="input"
              />
            </Field>
          </div>
          <p className="text-xs text-text-secondaire">
            Somme actuelle :{" "}
            <strong>
              {draft.ratios.legumes + draft.ratios.proteines + draft.ratios.feculents}%
            </strong>{" "}
            (doit faire 100)
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max féculents / repas">
              <input
                type="number"
                value={draft.maxFeculentsParRepas}
                min={1}
                max={5}
                onChange={(e) =>
                  setDraft({ ...draft, maxFeculentsParRepas: Number(e.target.value) })
                }
                className="input"
              />
            </Field>
            <Field label="Protéine obligatoire à chaque repas">
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={draft.proteineObligatoire}
                  onChange={(e) =>
                    setDraft({ ...draft, proteineObligatoire: e.target.checked })
                  }
                />
                <span className="text-sm">Oui (déjeuner et dîner)</span>
              </label>
            </Field>
          </div>
        </section>

        {/* Listes d'ingrédients */}
        <section className="tile-card space-y-4">
          <h2 className="text-xl">Ingrédients</h2>
          <ChipsField
            label="Légumes priorisés (peu caloriques, riches en fibres)"
            placeholder="ex: brocoli, courgette, épinards"
            chips={draft.legumesPriorises}
            onChange={(v) => setDraft({ ...draft, legumesPriorises: v })}
          />
          <ChipsField
            label="Légumes limités (sucrés naturellement, max 50% des légumes)"
            placeholder="ex: carottes, betteraves"
            chips={draft.legumesLimites}
            onChange={(v) => setDraft({ ...draft, legumesLimites: v })}
          />
          <ChipsField
            label="Ingrédients à éviter en plus"
            placeholder="ex: charcuterie, fromage affiné"
            chips={draft.ingredientsAEviter}
            onChange={(v) => setDraft({ ...draft, ingredientsAEviter: v })}
          />
        </section>

        {/* Notes libres */}
        <section className="tile-card space-y-3">
          <h2 className="text-xl">Notes libres</h2>
          <p className="text-text-secondaire text-sm">
            Texte additionnel injecté tel quel dans le prompt LLM, après les règles structurées.
          </p>
          <textarea
            value={draft.notesLibres}
            onChange={(e) => setDraft({ ...draft, notesLibres: e.target.value })}
            rows={5}
            maxLength={2000}
            className="input"
            placeholder="ex: Préfère les cuissons douces. Pas de four en été."
          />
          <p className="text-xs text-text-secondaire text-right">
            {draft.notesLibres.length} / 2000
          </p>
        </section>

        {error && <p className="text-accent-chaud text-sm">{error}</p>}
        {saved && <p className="text-sage text-sm">✓ Règles enregistrées</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(regles ?? null)}
            className="btn-secondary"
          >
            Réinitialiser
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={update.isPending}
          >
            <Save size={14} />
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-text-secondaire mb-1">{label}</span>
      {children}
    </label>
  );
}

function ChipsField({
  label,
  placeholder,
  chips,
  onChange,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || chips.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...chips, v]);
    setDraft("");
  }

  function remove(i: number) {
    onChange(chips.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <span className="block text-sm text-text-secondaire mb-1">{label}</span>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chips.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bordure text-sm"
            >
              {c}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-text-secondaire hover:text-accent-chaud"
                aria-label={`Retirer ${c}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="input flex-1"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="btn-secondary text-sm flex items-center gap-1"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>
    </div>
  );
}
