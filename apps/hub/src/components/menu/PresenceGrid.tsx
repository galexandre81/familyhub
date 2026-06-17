import { Zap } from "lucide-react";
import type { Profil } from "@family-hub/types";
import ProfilBadge from "../ProfilBadge";

const JOURS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const REPAS = [
  { key: "petitDej", label: "Petit-déj" },
  { key: "dej", label: "Déjeuner" },
  { key: "diner", label: "Dîner" },
] as const;

export type PresenceState = Record<string, string[]>;
/** Flag « repas express » par slot (max 10-15 min). */
export type ExpressState = Record<string, boolean>;

interface PresenceGridProps {
  profils: Array<Profil & { id: string }>;
  presence: PresenceState;
  onChange: (next: PresenceState) => void;
  /** Optionnel : map des slots flagués express. Si non défini, pas de toggle. */
  express?: ExpressState;
  onChangeExpress?: (next: ExpressState) => void;
}

/**
 * Grille de présence pour le wizard de création de plan.
 *
 * Lignes : 7 jours
 * Colonnes : 3 repas
 * Cellules : un bouton par profil (toggle présent/absent)
 *
 * UX : par défaut tous présents (set par le parent à l'init). On décoche
 * les exceptions. Bouton "tous présents" / "personne" en haut de cellule.
 */
export default function PresenceGrid({
  profils,
  presence,
  onChange,
  express,
  onChangeExpress,
}: PresenceGridProps) {
  function slotKey(jour: number, repas: string): string {
    return `${jour}-${repas}`;
  }

  function togglePresence(jour: number, repas: string, profilId: string) {
    const key = slotKey(jour, repas);
    const current = presence[key] ?? [];
    const next = current.includes(profilId)
      ? current.filter((id) => id !== profilId)
      : [...current, profilId];
    onChange({ ...presence, [key]: next });
  }

  function setAllForSlot(jour: number, repas: string, allOrNone: "all" | "none") {
    const key = slotKey(jour, repas);
    onChange({
      ...presence,
      [key]: allOrNone === "all" ? profils.map((p) => p.id) : [],
    });
  }

  function toggleExpress(jour: number, repas: string) {
    if (!express || !onChangeExpress) return;
    const key = slotKey(jour, repas);
    onChangeExpress({ ...express, [key]: !express[key] });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-1 min-w-[700px]">
        <thead>
          <tr>
            <th className="text-left eyebrow text-[10px] pl-2">Jour / Repas</th>
            {REPAS.map((r) => (
              <th key={r.key} className="eyebrow text-[10px] text-center">
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 7 }, (_, jour) => (
            <tr key={jour}>
              <td className="font-serif text-cream-mute pl-2 align-top pt-2">
                {JOURS_LABELS[jour]}
              </td>
              {REPAS.map((r) => {
                const key = slotKey(jour, r.key);
                const present = presence[key] ?? [];
                return (
                  <td key={r.key} className="align-top">
                    <div className="tile-card !p-2 flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {profils.map((p) => {
                          const on = present.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePresence(jour, r.key, p.id)}
                              aria-pressed={on}
                              aria-label={`${p.nom} ${on ? "présent" : "absent"}`}
                              className={`flex items-center justify-center min-h-11 min-w-11 transition ${on ? "" : "opacity-25 grayscale"}`}
                              title={on ? `${p.nom} présent(e)` : `${p.nom} absent(e)`}
                            >
                              <ProfilBadge
                                initiale={p.initiale}
                                couleur={p.couleur}
                                emoji={p.emoji}
                                size="sm"
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-center gap-1.5 text-[9px] uppercase tracking-widest">
                        <button
                          type="button"
                          onClick={() => setAllForSlot(jour, r.key, "all")}
                          className="text-cream-mute hover:text-brass inline-flex items-center justify-center min-h-11 px-3"
                        >
                          tous
                        </button>
                        <span className="text-wood-dark self-center">·</span>
                        <button
                          type="button"
                          onClick={() => setAllForSlot(jour, r.key, "none")}
                          className="text-cream-mute hover:text-copper inline-flex items-center justify-center min-h-11 px-3"
                        >
                          aucun
                        </button>
                      </div>
                      {express && onChangeExpress && (
                        <button
                          type="button"
                          onClick={() => toggleExpress(jour, r.key)}
                          aria-pressed={!!express[key]}
                          className={`flex items-center justify-center gap-1 text-[9px] uppercase tracking-widest mt-0.5 min-h-11 px-3 transition ${
                            express[key]
                              ? "text-brass font-semibold"
                              : "text-cream-mute hover:text-brass"
                          }`}
                          title={
                            express[key]
                              ? "Express activé : Claude proposera une recette ≤15 min"
                              : "Activer le mode express (≤15 min)"
                          }
                        >
                          <Zap
                            size={11}
                            className={express[key] ? "fill-brass" : ""}
                            aria-hidden="true"
                          />
                          express
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Helper : initialise une présence "tous présents pour tous les slots". */
export function buildDefaultPresence(profilIds: string[]): PresenceState {
  const out: PresenceState = {};
  for (let jour = 0; jour < 7; jour++) {
    for (const repas of ["petitDej", "dej", "diner"]) {
      out[`${jour}-${repas}`] = [...profilIds];
    }
  }
  return out;
}

/**
 * Initialise les flags express : tous les petits-déjeuners sont express
 * par défaut (cf. brief utilisateur), les autres slots non.
 */
export function buildDefaultExpress(): ExpressState {
  const out: ExpressState = {};
  for (let jour = 0; jour < 7; jour++) {
    out[`${jour}-petitDej`] = true;
    out[`${jour}-dej`] = false;
    out[`${jour}-diner`] = false;
  }
  return out;
}

/** Helper : convertit la PresenceState en format attendu par l'API. */
export function presenceToApi(presence: PresenceState): Array<{
  jour: number;
  repas: "petitDej" | "dej" | "diner";
  profilIds: string[];
}> {
  return Object.entries(presence).map(([key, profilIds]) => {
    const [jour, repas] = key.split("-");
    return {
      jour: parseInt(jour, 10),
      repas: repas as "petitDej" | "dej" | "diner",
      profilIds,
    };
  });
}
