import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChefHat, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type { MealPlanSlotWithId, RecetteWithId } from "../../lib/queries";
import type { Profil } from "@family-hub/types";
import ProfilBadge from "../ProfilBadge";

interface SlotCardProps {
  slot: MealPlanSlotWithId;
  recettesById: Record<string, RecetteWithId>;
  profilsById: Record<string, Profil & { id: string }>;
  /** Si défini : actions accept/refuse/regen disponibles. */
  onAccept?: () => void;
  onRefuse?: () => void;
  /** Régénère avec un feedback utilisateur optionnel (ex: "trop redondant"). */
  onRegenerate?: (feedback?: string) => void;
  /** True si une action backend est en cours sur ce slot. */
  busy?: boolean;
  /** Affiche une barre de statut compact (utile pour vue lecture seule). */
  compact?: boolean;
  /**
   * Si défini : tap sur le titre d'une recette ouvre un modal in-place
   * au lieu de naviguer vers /livre-recettes/:id.
   */
  onOpenRecette?: (recetteId: string, portions: number) => void;
}

export default function SlotCard({
  slot,
  recettesById,
  profilsById,
  onAccept,
  onRefuse,
  onRegenerate,
  busy,
  compact,
  onOpenRecette,
}: SlotCardProps) {
  const isEmpty = slot.profilsPresents.length === 0;
  const recettes = slot.recetteIds.map((id) => recettesById[id]).filter(Boolean);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  function submitRegen() {
    onRegenerate?.(feedback.trim() || undefined);
    setFeedbackOpen(false);
    setFeedback("");
  }

  return (
    <div
      className={`tile-card !p-3 flex flex-col gap-2 min-h-[110px] ${
        slot.statut === "accepte" ? "ring-1 ring-sage" : ""
      } ${isEmpty ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex -space-x-1">
          {slot.profilsPresents.map((pid) => {
            const p = profilsById[pid];
            if (!p) return null;
            return (
              <ProfilBadge
                key={pid}
                initiale={p.initiale}
                couleur={p.couleur}
                emoji={p.emoji}
                size="sm"
              />
            );
          })}
          {isEmpty && (
            <span className="text-cream-mute text-xs italic">personne</span>
          )}
        </div>
        <StatutPill statut={slot.statut} />
      </div>

      <div className="flex-1 text-sm">
        {recettes.length === 0 && !isEmpty && (
          <p className="text-cream-mute italic text-xs">À générer…</p>
        )}
        {slot.batchSourceSlotId && (
          <p className="text-brass text-xs flex items-center gap-1 mb-1">
            🔗 Batch (préparé ailleurs)
          </p>
        )}
        {recettes.map((r) => {
          const targetPortions = Math.max(slot.profilsPresents.length || r.portions, 1);
          const titleEl = (
            <>
              {r.nom}
              {!compact && (
                <span className="text-cream-mute text-xs">
                  {" "}
                  · {r.tempsPrepMinutes + r.tempsCuissonMinutes} min
                </span>
              )}
            </>
          );
          return (
            <div key={r.id} className="leading-snug flex items-start justify-between gap-2 group">
              {onOpenRecette ? (
                <button
                  type="button"
                  onClick={() => onOpenRecette(r.id, targetPortions)}
                  className="flex-1 text-left hover:text-brass transition"
                  title="Voir la recette détaillée"
                >
                  {titleEl}
                </button>
              ) : (
                <Link
                  to={`/livre-recettes/${r.id}?portions=${targetPortions}`}
                  className="flex-1 hover:text-brass transition"
                  title="Voir la recette détaillée"
                >
                  {titleEl}
                </Link>
              )}
              <Link
                to={`/livre-recettes/${r.id}/cuisine?portions=${targetPortions}`}
                className="text-cream-mute hover:text-brass transition shrink-0"
                title="Mode cuisine plein écran"
                onClick={(e) => e.stopPropagation()}
              >
                <ChefHat size={14} />
              </Link>
            </div>
          );
        })}
      </div>

      {feedbackOpen && onRegenerate && (
        <div className="space-y-1.5 pt-1 border-t border-wood-dark">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            maxLength={500}
            autoFocus
            className="input !py-1.5 !px-2 text-xs"
            placeholder="ex: trop redondant, ajoute un féculent, plus végé…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submitRegen();
              }
              if (e.key === "Escape") {
                setFeedbackOpen(false);
                setFeedback("");
              }
            }}
          />
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] text-cream-mute">
              ⌘/Ctrl+Entrée pour valider
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedback("");
                }}
                className="text-cream-mute hover:text-cream text-xs px-2 py-0.5"
              >
                Annuler
              </button>
              <button
                onClick={submitRegen}
                className="text-brass hover:text-brass-deep text-xs px-2 py-0.5 flex items-center gap-1"
              >
                <Sparkles size={11} />
                Régénérer
              </button>
            </div>
          </div>
        </div>
      )}

      {(onAccept || onRefuse || onRegenerate) && !isEmpty && recettes.length > 0 && !feedbackOpen && (
        <div className="flex items-center justify-end gap-1 pt-1">
          {busy && <Loader2 size={14} className="animate-spin text-cream-mute" />}
          {!busy && onRegenerate && (
            <button
              onClick={() => setFeedbackOpen(true)}
              className="p-1.5 text-cream-mute hover:text-brass transition"
              title="Régénérer (avec feedback optionnel)"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {!busy && onRefuse && slot.statut !== "vide" && (
            <button
              onClick={onRefuse}
              className="p-1.5 text-cream-mute hover:text-copper transition"
              title="Refuser"
            >
              <X size={14} />
            </button>
          )}
          {!busy && onAccept && slot.statut === "propose" && (
            <button
              onClick={onAccept}
              className="p-1.5 text-cream-mute hover:text-sage transition"
              title="Accepter"
            >
              <Check size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatutPill({ statut }: { statut: "vide" | "propose" | "accepte" }) {
  if (statut === "accepte") {
    return (
      <span className="text-[9px] uppercase tracking-widest text-sage" title="Accepté">
        ✓
      </span>
    );
  }
  if (statut === "propose") {
    return (
      <span className="text-[9px] uppercase tracking-widest text-brass" title="Proposé">
        •
      </span>
    );
  }
  return null;
}
