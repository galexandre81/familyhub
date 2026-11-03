/**
 * Nom d'un article de la liste : le nom seul, ou — si la famille a noté un
 * produit de remplacement — « nom barré → remplacement ». Le barré d'un article
 * coché reste porté par l'élément parent et couvre l'ensemble.
 */
import type { ArticleCourses } from "@family-hub/types";

export default function NomArticle({ article }: { article: Pick<ArticleCourses, "nom" | "remplacement"> }) {
  if (!article.remplacement) return <>{article.nom}</>;
  return (
    <>
      <s>{article.nom}</s> → {article.remplacement}
    </>
  );
}
