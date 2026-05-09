# Thèmes UI — Architecture et maintenance

## TL;DR pour ajouter une nouvelle tuile

Quand tu ajoutes une tuile au display (`apps/display/public/js/tiles/X.js` + CSS) :

1. **Tu ne te poses pas de question** pour 5 thèmes sur 6 (Caractère, Forêt, Marine, Bordeaux, Glacier) — ils sont tous sombres et la palette par défaut des classes CSS marche.
2. **Tu DOIS auditer pour le thème Lin** (clair/crème) — c'est le seul outlier. Sans override explicite, ton texte est invisible sur fond crème.

### Checklist Lin

Pour chaque sélecteur CSS de ta nouvelle tuile qui pose une `color: #...` ou `background: #...`, vérifie cette table de mapping et ajoute une règle Lin si tu utilises l'une de ces couleurs :

| Couleur dark theme | Sur Lin doit devenir | Usage typique |
|---|---|---|
| `#F2E8D5` | `#3C2A1A` | Texte principal |
| `#F5ECD7` | `#3C2A1A` | Texte principal (variante calendar) |
| `#C49B6B` | `#6B5238` | Texte secondaire (méta, durée, etc.) |
| `#9C8A6E` | `#8C7456` | Texte muted (italic, hint) |
| `#D9A05B` | `#B26E38` | Accent (titres, boutons primaires) |
| `#E8C079` | `#B26E38` | Accent variante (today highlight) |
| `#1C1815` | `#FFFAF0` | Background card |
| `#2A2218` | `#F0E5CA` | Active state (card pressed) |
| `#15110D`, `#0F0D0A` | `#F0E5CA` | Background très sombre |
| `#3A2E22` | `#D4C7AC` | Bordure card |

Tu ajoutes ta règle dans `apps/display/public/css/styles.css` sous le bloc `===== BACKGROUNDS — dark theme card =====` (cherche `html.theme-lin .weather-hero,` pour situer).

Format :

```css
html.theme-lin .ma-nouvelle-tuile-titre,
html.theme-lin .autre-class { color: #3C2A1A; }
```

### Vérifier visuellement

Dans la console DevTools en local :

```js
document.documentElement.className = 'theme-lin';
```

Toutes les classes que tu as posées doivent rester lisibles. Si tu vois du texte ton-sur-ton sur le fond crème, ajoute l'override correspondant.

## Pourquoi cette gymnastique

Safari 9 (iPad mini 1) ne supporte pas les **CSS custom properties** (`--var`). Donc on ne peut pas faire :

```css
:root { --text-primary: #F2E8D5; }
html.theme-lin { --text-primary: #3C2A1A; }
.ma-class { color: var(--text-primary); }
```

À la place, on duplique les valeurs en dur dans les classes, et on override par theme-X selector. C'est verbeux et fragile mais c'est ce qui marche.

## Architecture cible (long terme)

Quand l'iPad mini 1 sera retiré, on pourra refactorer en classes logiques sans variables CSS :

```css
.fh-text-primary { color: #F2E8D5; }
.fh-text-secondary { color: #C49B6B; }
.fh-text-muted { color: #9C8A6E; }
.fh-accent { color: #D9A05B; }
.fh-bg-card { background: #1C1815; border-color: #3A2E22; }

html.theme-lin .fh-text-primary { color: #3C2A1A; }
html.theme-lin .fh-text-secondary { color: #6B5238; }
html.theme-lin .fh-text-muted { color: #8C7456; }
html.theme-lin .fh-accent { color: #B26E38; }
html.theme-lin .fh-bg-card { background: #FFFAF0; border-color: #D4C7AC; }
```

Et chaque tuile utilise `class="cal-event-summary fh-text-primary"` au lieu de `color: #F2E8D5` direct. Une seule règle par thème pour tout couvrir.

Tant qu'on garde l'iPad mini 1 comme cible, c'est valide aussi (Safari 9 supporte les classes multiples), mais il faudrait migrer toutes les tuiles existantes — gros chantier non rentable tant que la liste actuelle est gérable.

## Source de vérité des thèmes

- **Hub web** : `apps/hub/src/lib/themes.ts` (TypeScript, applique via `document.documentElement.classList`)
- **Display iPad** : `apps/display/public/css/styles.css` section `THEMES` (CSS pur dupliqué, applique via `html.className` poussé par `core.js applyDisplayTheme`)
- **Persistence** : `households/{hid}.parametres.themeId` (Firestore)

Quand tu ajoutes/modifies un thème, **les deux fichiers doivent rester en sync**. Le `id` est la clé (ex: `"foret"`, `"lin"`) et la classe CSS est `theme-{id}` (sauf `caractere` qui est le défaut sans classe).
