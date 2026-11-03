/** Nom d'une ligne d'ingrédient, barré et suivi du remplacement de la semaine s'il y en a un. */
export default function NomIngredient({ libelle, remplacement }: { libelle: string; remplacement?: string }) {
  if (!remplacement) return <>{libelle}</>;
  return (
    <>
      <s>{libelle}</s> → {remplacement}
    </>
  );
}
