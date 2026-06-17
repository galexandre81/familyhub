import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Couleurs thémifiables : pointent vers des CSS vars RGB triplets
           définis dans index.css. Les classes html.theme-* overrident. */
        ebony: {
          DEFAULT: "rgb(var(--c-ebony) / <alpha-value>)",
          panel: "rgb(var(--c-ebony-panel) / <alpha-value>)",
          card: "rgb(var(--c-ebony-card) / <alpha-value>)",
          ridge: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        brass: {
          DEFAULT: "rgb(var(--c-brass) / <alpha-value>)",
          deep: "#C28A47",
          soft: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "rgb(var(--c-cream) / <alpha-value>)",
          mute: "rgb(var(--c-cream-mute) / <alpha-value>)",
        },
        wood: {
          dark: "rgb(var(--c-wood-dark) / <alpha-value>)",
          mid: "#5C3D1F",
          light: "#C49B6B",
        },

        /* Couleurs sémantiques fixes (succès / warn / erreur) */
        copper: "#C9712E",
        sage: "#7BA471",

        /* Compat anciens noms */
        "bg-principal": "rgb(var(--c-ebony) / <alpha-value>)",
        "bg-card": "rgb(var(--c-ebony-card) / <alpha-value>)",
        "bg-sombre": "rgb(var(--c-ebony-panel) / <alpha-value>)",
        "text-principal": "rgb(var(--c-cream) / <alpha-value>)",
        "text-secondaire": "rgb(var(--c-cream-mute) / <alpha-value>)",
        "text-clair": "rgb(var(--c-cream) / <alpha-value>)",
        "accent-chaud": "rgb(var(--c-brass) / <alpha-value>)",
        "accent-secondaire": "#7BA471",
        "accent-attention": "#C9712E",
        bordure: "rgb(var(--c-wood-dark) / <alpha-value>)",

        /* Aliases — themed via CSS vars (login + autres pages) */
        paper: "rgb(var(--c-ebony) / <alpha-value>)",
        ivory: "rgb(var(--c-ebony-card) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--c-cream) / <alpha-value>)",
          mute: "rgb(var(--c-cream-mute) / <alpha-value>)",
          soft: "#C49B6B",
        },
        terracotta: {
          DEFAULT: "rgb(var(--c-brass) / <alpha-value>)",
          deep: "#C28A47",
          soft: "rgb(var(--c-ebony-ridge) / <alpha-value>)",
        },
        ochre: "rgb(var(--c-brass) / <alpha-value>)",
        hairline: "rgb(var(--c-wood-dark) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "Times New Roman", "serif"],
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        eyebrow: ["12px", { lineHeight: "1.2", letterSpacing: "0.22em" }],
      },
      borderRadius: {
        tile: "4px",
      },
      boxShadow: {
        tile: "0 4px 16px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,228,176,0.04)",
        elev: "0 8px 32px -12px rgba(0,0,0,0.6)",
        brass: "0 0 0 1px rgba(217,160,91,0.4), 0 4px 24px -8px rgba(217,160,91,0.2)",
      },
      backgroundImage: {
        /* Wood grain subtil — strates verticales très fines */
        "wood-grain":
          "linear-gradient(90deg, rgba(0,0,0,0.06) 0px, transparent 1px, transparent 40px, rgba(0,0,0,0.04) 41px, transparent 42px), linear-gradient(180deg, rgba(217,160,91,0.04), transparent 60%)",
        /* Subtle noise/grain pour profondeur */
        "ebony-grain":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.55  0 0 0 0.025 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
} satisfies Config;
