import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Couleurs thémifiables : pointent vers des CSS vars RGB triplets
           générées dans styles/ambiance.css (html.amb-jour / html.amb-nuit). */
        ebony: {
          DEFAULT: "rgb(var(--c-ebony) / <alpha-value>)",
          panel: "rgb(var(--c-ebony-panel) / <alpha-value>)",
          card: "rgb(var(--c-ebony-card) / <alpha-value>)",
          ridge: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        brass: {
          DEFAULT: "rgb(var(--c-brass) / <alpha-value>)",
          deep: "rgb(var(--c-brass) / <alpha-value>)",
          soft: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "rgb(var(--c-cream) / <alpha-value>)",
          mute: "rgb(var(--c-cream-mute) / <alpha-value>)",
        },
        wood: {
          dark: "rgb(var(--c-wood-dark) / <alpha-value>)",
          mid: "rgb(var(--c-cream-mute) / <alpha-value>)",
          light: "rgb(var(--c-cream-mute) / <alpha-value>)",
        },

        /* Couleurs sémantiques (succès / warn / erreur), suivent l'ambiance */
        copper: "rgb(var(--c-p-toleRouge) / <alpha-value>)",
        sage: "rgb(var(--c-p-sapin) / <alpha-value>)",

        /* Compat anciens noms */
        "bg-principal": "rgb(var(--c-ebony) / <alpha-value>)",
        "bg-card": "rgb(var(--c-ebony-card) / <alpha-value>)",
        "bg-sombre": "rgb(var(--c-ebony-panel) / <alpha-value>)",
        "text-principal": "rgb(var(--c-cream) / <alpha-value>)",
        "text-secondaire": "rgb(var(--c-cream-mute) / <alpha-value>)",
        "text-clair": "rgb(var(--c-cream) / <alpha-value>)",
        "accent-chaud": "rgb(var(--c-brass) / <alpha-value>)",
        "accent-secondaire": "rgb(var(--c-p-sapin) / <alpha-value>)",
        "accent-attention": "rgb(var(--c-p-toleRouge) / <alpha-value>)",
        bordure: "rgb(var(--c-wood-dark) / <alpha-value>)",

        /* Aliases — themed via CSS vars (login + autres pages) */
        paper: "rgb(var(--c-ebony) / <alpha-value>)",
        ivory: "rgb(var(--c-ebony-card) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--c-cream) / <alpha-value>)",
          mute: "rgb(var(--c-cream-mute) / <alpha-value>)",
          soft: "rgb(var(--c-cream-mute) / <alpha-value>)",
        },
        terracotta: {
          DEFAULT: "rgb(var(--c-brass) / <alpha-value>)",
          deep: "rgb(var(--c-brass) / <alpha-value>)",
          soft: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        ochre: "rgb(var(--c-brass) / <alpha-value>)",
        hairline: "rgb(var(--c-wood-dark) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        sans: ["Atkinson Hyperlegible", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        eyebrow: ["12px", { lineHeight: "1.2", letterSpacing: "0.22em" }],
      },
      borderRadius: {
        tile: "4px",
      },
      boxShadow: {
        tile: "0 4px 16px -8px rgb(var(--c-bordure) / 0.25)",
        elev: "0 8px 32px -12px rgb(var(--c-bordure) / 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
