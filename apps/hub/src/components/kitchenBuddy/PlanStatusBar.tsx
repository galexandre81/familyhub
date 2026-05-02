import { AlertTriangle, FlaskConical } from "lucide-react";

interface PlanStatusBarProps {
  tokensUsed?: number;
  llmModel?: string;
}

const TOKEN_CAP = 500_000;
const TOKEN_WARN_THRESHOLD = 0.8 * TOKEN_CAP;

/**
 * Bandeau de statut du plan : compteur tokens + indicateur mode mock.
 * Affiché en permanence sur la page brouillon et la page plan actif.
 */
export default function PlanStatusBar({ tokensUsed = 0, llmModel }: PlanStatusBarProps) {
  const isMock = llmModel?.startsWith("mock") ?? false;
  const ratio = tokensUsed / TOKEN_CAP;
  const warn = tokensUsed >= TOKEN_WARN_THRESHOLD;
  const exhausted = tokensUsed >= TOKEN_CAP;

  return (
    <div className="space-y-2">
      {isMock && (
        <div className="tile-card !p-3 flex items-center gap-3 bg-copper/10 border-copper">
          <FlaskConical size={18} className="text-copper shrink-0" />
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-semibold text-copper">Mode test (mock LLM)</span>
              {" — "}
              <span className="text-cream-mute">
                Les recettes sont des fixtures fixes, pas une vraie génération. Pour tester la
                qualité réelle, passe <code className="text-xs px-1 bg-ebony-ridge rounded">MOCK_LLM=false</code> dans <code className="text-xs px-1 bg-ebony-ridge rounded">functions/.env</code> et redéploie.
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="tile-card !p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-cream-mute uppercase tracking-widest">
              Tokens utilisés
            </span>
            <span className={warn ? "text-copper font-semibold" : "text-cream-mute"}>
              {tokensUsed.toLocaleString("fr-FR")} / {TOKEN_CAP.toLocaleString("fr-FR")}
            </span>
          </div>
          <div className="h-1.5 bg-ebony-ridge rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                exhausted ? "bg-copper" : warn ? "bg-brass" : "bg-sage"
              }`}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          {warn && !exhausted && (
            <p className="text-copper text-xs mt-1 flex items-center gap-1">
              <AlertTriangle size={11} />
              Bientôt à la limite — finalise tes ajustements.
            </p>
          )}
          {exhausted && (
            <p className="text-copper text-xs mt-1 flex items-center gap-1">
              <AlertTriangle size={11} />
              Cap atteint — la génération et le chat sont bloqués pour ce plan.
            </p>
          )}
          {llmModel && !isMock && (
            <p className="text-[10px] text-cream-mute mt-1 uppercase tracking-widest">
              Modèle : {llmModel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
