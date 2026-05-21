import type { Profil } from "@family-hub/types";
import type { MealPlanSlotWithId, RecetteWithId } from "../../lib/queries";
import SlotCard from "./SlotCard";

const JOUR_LABELS_BY_DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const REPAS_LABELS = {
  petitDej: "Petit-déj",
  dej: "Déjeuner",
  diner: "Dîner",
} as const;

interface MealPlanGridProps {
  slots: MealPlanSlotWithId[];
  recettesById: Record<string, RecetteWithId>;
  profilsById: Record<string, Profil & { id: string }>;
  /** Date de début du plan (jour 1, peut être n'importe quel jour de la semaine). */
  dateDebut?: Date;
  /** Date de fin du plan. Si omis, on dérive le nombre de jours des slots eux-mêmes. */
  dateFin?: Date;
  /** Slot actuellement en train d'être traité (loader). */
  busySlotId?: string | null;
  onAccept?: (slotId: string) => void;
  onRefuse?: (slotId: string) => void;
  /** Régen avec feedback utilisateur optionnel (ex: "trop redondant"). */
  onRegenerate?: (slotId: string, feedback?: string) => void;
  /**
   * Si défini : tap sur le titre d'une recette ouvre un modal in-place
   * au lieu de naviguer vers /livre-recettes/:id.
   */
  onOpenRecette?: (recetteId: string, portions: number, slotId?: string) => void;
  /**
   * Si définis : permet l'édition inline notes + toggle annulé sur les
   * slots (mutation Firestore via useUpdateSlot). Passé uniquement
   * sur la grille du plan actif.
   */
  editableHouseholdId?: string;
  editablePlanId?: string;
}

export default function MealPlanGrid({
  slots,
  recettesById,
  profilsById,
  dateDebut,
  dateFin,
  busySlotId,
  onAccept,
  onRefuse,
  onRegenerate,
  onOpenRecette,
  editableHouseholdId,
  editablePlanId,
}: MealPlanGridProps) {
  const days = computeDayList(slots, dateDebut, dateFin);
  // Slots indexés par "YYYY-MM-DD-repas". Fallback "jour-repas" pour très vieux slots sans champ date.
  const slotByCoord = new Map<string, MealPlanSlotWithId>();
  for (const s of slots) {
    const key = s.date ? `${s.date}-${s.repas}` : `j${s.jour}-${s.repas}`;
    slotByCoord.set(key, s);
  }

  // CSS grid columns dynamiques (1 label + N jours).
  const nCols = days.length;
  const gridStyle = {
    gridTemplateColumns: `100px repeat(${nCols}, minmax(140px, 1fr))`,
    minWidth: `${100 + nCols * 140 + (nCols + 1) * 8}px`,
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-2" style={gridStyle}>
        <div />
        {days.map((day) => (
          <div key={day.iso} className="text-center">
            <div className="eyebrow text-[10px]">{JOUR_LABELS_BY_DOW[day.date.getDay()]}</div>
            <div className="text-cream-mute text-[10px] mt-0.5">{day.shortLabel}</div>
          </div>
        ))}

        {(["petitDej", "dej", "diner"] as const).map((repas) => (
          <RowFragment
            key={repas}
            repas={repas}
            days={days}
            slotByCoord={slotByCoord}
            recettesById={recettesById}
            profilsById={profilsById}
            busySlotId={busySlotId}
            onAccept={onAccept}
            onRefuse={onRefuse}
            onRegenerate={onRegenerate}
            onOpenRecette={onOpenRecette}
            editableHouseholdId={editableHouseholdId}
            editablePlanId={editablePlanId}
          />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  repas,
  days,
  slotByCoord,
  recettesById,
  profilsById,
  busySlotId,
  onAccept,
  onRefuse,
  onRegenerate,
  onOpenRecette,
  editableHouseholdId,
  editablePlanId,
}: {
  repas: "petitDej" | "dej" | "diner";
  days: DayCell[];
  slotByCoord: Map<string, MealPlanSlotWithId>;
  recettesById: Record<string, RecetteWithId>;
  profilsById: Record<string, Profil & { id: string }>;
  busySlotId?: string | null;
  onAccept?: (slotId: string) => void;
  onRefuse?: (slotId: string) => void;
  onRegenerate?: (slotId: string, feedback?: string) => void;
  onOpenRecette?: (recetteId: string, portions: number, slotId?: string) => void;
  editableHouseholdId?: string;
  editablePlanId?: string;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2">
        <span className="eyebrow text-[10px]">{REPAS_LABELS[repas]}</span>
      </div>
      {days.map((day) => {
        const slot =
          slotByCoord.get(`${day.iso}-${repas}`) ??
          slotByCoord.get(`j${day.jourIndex}-${repas}`);
        if (!slot) {
          return (
            <div key={day.iso} className="tile-card !p-3 min-h-[110px] opacity-30 italic text-xs">
              —
            </div>
          );
        }
        const slotId = slot.id;
        return (
          <SlotCard
            key={day.iso}
            slot={slot}
            recettesById={recettesById}
            profilsById={profilsById}
            busy={busySlotId === slotId}
            onAccept={onAccept ? () => onAccept(slotId) : undefined}
            onRefuse={onRefuse ? () => onRefuse(slotId) : undefined}
            onRegenerate={onRegenerate ? (fb) => onRegenerate(slotId, fb) : undefined}
            onOpenRecette={onOpenRecette}
            editableHouseholdId={editableHouseholdId}
            editablePlanId={editablePlanId}
          />
        );
      })}
    </>
  );
}

interface DayCell {
  iso: string; // "YYYY-MM-DD"
  date: Date;
  shortLabel: string; // ex "21 mai"
  jourIndex: number; // offset depuis le 1er jour (pour fallback legacy)
}

/**
 * Calcule la liste de jours à afficher.
 *
 * Plage = UNION de (dateDebut→dateFin) du plan ET des dates effectives des
 * slots. Robuste aux plans dont le dateDebut/dateFin Firestore ne couvre
 * pas tous les slots (cas typique : import JSON dont les dates débordent
 * du dateDebut posé par le wizard).
 */
function computeDayList(
  slots: MealPlanSlotWithId[],
  dateDebut?: Date,
  dateFin?: Date,
): DayCell[] {
  let start: Date | undefined = dateDebut;
  let end: Date | undefined = dateFin;

  const slotDates = slots
    .map((s) => s.date)
    .filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (slotDates.length > 0) {
    const slotMin = parseISODate(slotDates[0]);
    const slotMax = parseISODate(slotDates[slotDates.length - 1]);
    if (!start || slotMin < start) start = slotMin;
    if (!end || slotMax > end) end = slotMax;
  }
  if (!start) {
    start = new Date();
    start.setHours(0, 0, 0, 0);
  }
  if (!end) {
    end = new Date(start);
    end.setDate(end.getDate() + 6);
  }

  // Normalize: noon to avoid DST drift when adding days.
  const s = new Date(start);
  s.setHours(12, 0, 0, 0);
  const e = new Date(end);
  e.setHours(12, 0, 0, 0);

  const nDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
  // Garde-fou : un plan ne dépasse pas 31 jours dans l'UI.
  const capped = Math.min(nDays, 31);

  const out: DayCell[] = [];
  for (let i = 0; i < capped; i++) {
    const d = new Date(s);
    d.setDate(s.getDate() + i);
    out.push({
      iso: toISODate(d),
      date: d,
      shortLabel: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      jourIndex: i,
    });
  }
  return out;
}

function parseISODate(iso: string): Date {
  // Construit en local pour éviter le shift UTC.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
