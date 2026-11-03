/**
 * Bouton « 2 repas » en bout de ligne d'article : ouvre le panneau des repas
 * qui utilisent l'article. Toujours à côté de la zone qui coche, jamais dedans.
 */
interface Props {
  /** Texte visible : « 2 repas » ou « Voir ». */
  libelle: string;
  /** Nom de l'article, pour le nom accessible. */
  nom: string;
  onClick(): void;
}

export default function BoutonRepas({ libelle, nom, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={`Voir les repas de ${nom}`}
      className="shrink-0 min-h-12 px-3 rounded-xl border border-hairline bg-ebony text-brass text-[15px] whitespace-nowrap hover:border-brass active:bg-ebony-ridge"
    >
      {libelle}
    </button>
  );
}
