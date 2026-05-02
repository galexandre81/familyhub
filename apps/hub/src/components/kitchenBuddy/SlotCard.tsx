import { Check, Loader2, RefreshCw, X } from "lucide-react";
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
  onRegenerate?: () => void;
  /** True si une action backend est en cours sur ce slot. */
  busy?: boolean;
  /** Affiche une barre de statut compact (utile pour vue lecture seule). */
  compact?: boolean;
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
}: SlotCardProps) {
  const isEmpty = slot.profilsPresents.length === 0;
  const recettes = slot.recetteIds.map((id) => recettesById[id]).filter(Boolean);

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
        {recettes.map((r) => (
          <p key={r.id} className="leading-snug">
            {r.nom}
            {!compact && (
              <span className="text-cream-mute text-xs">
                {" "}
                · {r.tempsPrepMinutes + r.tempsCuissonMinutes} min
              </span>
            )}
          </p>
        ))}
      </div>

      {(onAccept || onRefuse || onRegenerate) && !isEmpty && recettes.length > 0 && (
        <div className="flex items-center justify-end gap-1 pt-1">
          {busy && <Loader2 size={14} className="animate-spin text-cream-mute" />}
          {!busy && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1.5 text-cream-mute hover:text-brass transition"
              title="Régénérer ce repas"
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
