import type { Profil } from "@family-hub/types";
import type { MealPlanSlotWithId, RecetteWithId } from "../../lib/queries";
import SlotCard from "./SlotCard";

const JOURS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const REPAS_LABELS = {
  petitDej: "Petit-déj",
  dej: "Déjeuner",
  diner: "Dîner",
} as const;

interface MealPlanGridProps {
  slots: MealPlanSlotWithId[];
  recettesById: Record<string, RecetteWithId>;
  profilsById: Record<string, Profil & { id: string }>;
  /** Date du lundi pour l'en-tête. */
  dateDebut?: Date;
  /** Slot actuellement en train d'être traité (loader). */
  busySlotId?: string | null;
  onAccept?: (slotId: string) => void;
  onRefuse?: (slotId: string) => void;
  /** Régen avec feedback utilisateur optionnel (ex: "trop redondant"). */
  onRegenerate?: (slotId: string, feedback?: string) => void;
}

export default function MealPlanGrid({
  slots,
  recettesById,
  profilsById,
  dateDebut,
  busySlotId,
  onAccept,
  onRefuse,
  onRegenerate,
}: MealPlanGridProps) {
  const slotByCoord = new Map(slots.map((s) => [`${s.jour}-${s.repas}`, s]));

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[100px_repeat(7,minmax(140px,1fr))] gap-2 min-w-[1100px]">
        <div />
        {JOURS_LABELS.map((label, i) => (
          <div key={i} className="text-center">
            <div className="eyebrow text-[10px]">{label}</div>
            {dateDebut && (
              <div className="text-cream-mute text-[10px] mt-0.5">
                {formatDayLabel(dateDebut, i)}
              </div>
            )}
          </div>
        ))}

        {(["petitDej", "dej", "diner"] as const).map((repas) => (
          <RowFragment
            key={repas}
            repas={repas}
            slotByCoord={slotByCoord}
            recettesById={recettesById}
            profilsById={profilsById}
            busySlotId={busySlotId}
            onAccept={onAccept}
            onRefuse={onRefuse}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  repas,
  slotByCoord,
  recettesById,
  profilsById,
  busySlotId,
  onAccept,
  onRefuse,
  onRegenerate,
}: {
  repas: "petitDej" | "dej" | "diner";
  slotByCoord: Map<string, MealPlanSlotWithId>;
  recettesById: Record<string, RecetteWithId>;
  profilsById: Record<string, Profil & { id: string }>;
  busySlotId?: string | null;
  onAccept?: (slotId: string) => void;
  onRefuse?: (slotId: string) => void;
  onRegenerate?: (slotId: string, feedback?: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2">
        <span className="eyebrow text-[10px]">{REPAS_LABELS[repas]}</span>
      </div>
      {Array.from({ length: 7 }, (_, jour) => {
        const slot = slotByCoord.get(`${jour}-${repas}`);
        if (!slot) {
          return (
            <div key={jour} className="tile-card !p-3 min-h-[110px] opacity-30 italic text-xs">
              —
            </div>
          );
        }
        const slotId = slot.id;
        return (
          <SlotCard
            key={jour}
            slot={slot}
            recettesById={recettesById}
            profilsById={profilsById}
            busy={busySlotId === slotId}
            onAccept={onAccept ? () => onAccept(slotId) : undefined}
            onRefuse={onRefuse ? () => onRefuse(slotId) : undefined}
            onRegenerate={onRegenerate ? (fb) => onRegenerate(slotId, fb) : undefined}
          />
        );
      })}
    </>
  );
}

function formatDayLabel(monday: Date, offsetDays: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
