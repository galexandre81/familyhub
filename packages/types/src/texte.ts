/**
 * Normalise un nom d'article pour comparer ce qui est « le même produit » :
 * minuscules, sans accents, `œ`→`oe` (`æ`→`ae`), espaces réduits, et pluriel
 * final `s`/`x` retiré de chaque mot (« Œufs » = « oeuf », « gousses d'ail » =
 * « gousse d'ail »). Les mots de deux lettres ou moins sont laissés tels quels
 * (« os »). Le retrait est aveugle : un mot qui finit par s/x au singulier est
 * tronqué (« noix » → « noi », « riz » non), mais singulier et pluriel
 * donnent toujours la même clé. Sert à la fusion des articles et à la détection des produits de
 * placard — ce n'est pas un texte à afficher.
 */
export function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .split(/\s+/)
    .filter((mot) => mot.length > 0)
    .map((mot) => (mot.length > 2 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot))
    .join(" ");
}
