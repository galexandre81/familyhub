import type { VitePWAOptions } from "vite-plugin-pwa";

/**
 * Réglages de l'application installable (manifest + service worker Workbox).
 *
 * Fichier sans dépendance au navigateur : il est importé par vite.config.ts
 * (Node) et par son test (vitest, environnement node).
 *
 * Règle d'or : le service worker ne contrôle jamais l'écran de l'iPad
 * (/display, /display/…, /d/…) ni les pages de connexion servies par
 * Firebase Hosting (/__/auth/…). Les pages /displays du hub, elles, restent
 * couvertes (d'où le `(\/|$)` dans le motif). D'où la liste d'exclusion de la navigation, doublée d'un
 * globIgnores sur display/** (l'app display est copiée dans dist/ après le
 * build Vite, mais on se protège quand même).
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",
  // Les icônes sont déjà prises par globPatterns (png) : évite les doublons.
  includeManifestIcons: false,
  manifest: {
    name: "Family Hub",
    short_name: "Family Hub",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    // Écran de lancement Android : même bleu nuit que l'icône (scripts/lib/iconeMaison.mjs).
    background_color: "#0F1B2D",
    theme_color: "#EEF4EA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
  workbox: {
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/display(\/|$)/, /^\/d\//, /^\/__/],
    globPatterns: ["**/*.{js,css,html,woff,woff2,png,svg}"],
    globIgnores: ["display/**"],
    // Notifications des demandes du PC des enfants (public/notifications-sw.js).
    importScripts: ["/notifications-sw.js"],
  },
};
