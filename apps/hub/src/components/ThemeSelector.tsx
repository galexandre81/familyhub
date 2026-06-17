import { useState } from "react";
import { Check, Loader2, Palette } from "lucide-react";
import { useUpdateHousehold } from "../lib/mutations";
import { applyTheme, DEFAULT_THEME_ID, THEMES } from "../lib/themes";
import type { HouseholdParametres } from "@family-hub/types";

/**
 * Grille de cartes preview pour choisir un thème UI.
 * Le thème est stocké sur `households/{hid}.parametres.themeId` — donc
 * partagé par toute la famille (cohérence visuelle iPad/web/mobile).
 *
 * Application immédiate au clic via `applyTheme()` (côté client) puis
 * persistence Firestore en arrière-plan. Si la persist échoue, on revert.
 */
export default function ThemeSelector({
  uid,
  householdId,
  parametres,
  currentThemeId,
}: {
  uid: string;
  householdId: string;
  parametres: HouseholdParametres;
  currentThemeId: string;
}) {
  const update = useUpdateHousehold();
  const [pending, setPending] = useState<string | null>(null);

  async function pick(themeId: string) {
    if (themeId === currentThemeId) return;
    /* Apply visuellement immédiatement pour feedback instantané */
    applyTheme(themeId);
    setPending(themeId);
    try {
      await update.mutateAsync({
        uid,
        householdId,
        patch: { parametres: { ...parametres, themeId } },
      });
    } catch {
      /* Rollback si erreur */
      applyTheme(currentThemeId || DEFAULT_THEME_ID);
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl flex items-center gap-2">
        <Palette size={20} className="text-brass" aria-hidden="true" />
        Thème de l'interface
      </h2>
      <p className="text-cream-mute text-sm">
        Le thème choisi s'applique sur le hub web et le mobile (responsive).
        Partagé par toute la famille.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const active = t.id === currentThemeId;
          const isPending = pending === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pick(t.id)}
              disabled={isPending || update.isPending}
              aria-pressed={active}
              aria-current={active ? "true" : undefined}
              aria-label={`Thème ${t.nom}`}
              className={`relative tile-card !p-3 text-left transition disabled:opacity-60 ${
                active
                  ? "ring-2 ring-brass"
                  : "hover:ring-1 hover:ring-brass/40"
              }`}
            >
              {/* Preview swatches (4 carrés) */}
              <div className="flex gap-1 mb-2">
                <span
                  className="w-6 h-6 rounded-sm border"
                  style={{ background: t.preview.bg, borderColor: t.preview.card }}
                  aria-hidden
                />
                <span
                  className="w-6 h-6 rounded-sm border"
                  style={{ background: t.preview.card, borderColor: t.preview.text + "40" }}
                  aria-hidden
                />
                <span
                  className="w-6 h-6 rounded-sm"
                  style={{ background: t.preview.accent }}
                  aria-hidden
                />
                <span
                  className="w-6 h-6 rounded-sm border"
                  style={{ background: t.preview.text, borderColor: t.preview.card }}
                  aria-hidden
                />
              </div>
              <div className="font-medium">{t.nom}</div>
              <div className="text-cream-mute text-xs mt-0.5">
                {t.description}
              </div>
              {(active || isPending) && (
                <span className="absolute top-2 right-2 text-brass" aria-hidden="true">
                  {isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
