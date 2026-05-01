import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* "Maison de Famille" — papier crème, encre brune, terre cuite, sauge */
        paper: "#FAF6EE",
        ivory: "#FFFCF6",
        ink: {
          DEFAULT: "#2B2419",
          mute: "#8B7E6B",
          soft: "#5A4F3F",
        },
        terracotta: {
          DEFAULT: "#B85C42",
          deep: "#9D4E38",
          soft: "#FAF0EC",
        },
        sage: "#6B8E5E",
        ochre: "#D4A045",
        hairline: "#E5DCC8",

        /* Compat : conserve les anciens noms pour les composants déjà écrits */
        "bg-principal": "#FAF6EE",
        "bg-card": "#FFFCF6",
        "bg-sombre": "#2B2419",
        "text-principal": "#2B2419",
        "text-secondaire": "#8B7E6B",
        "text-clair": "#FAF6EE",
        "accent-chaud": "#B85C42",
        "accent-secondaire": "#6B8E5E",
        "accent-attention": "#D4A045",
        bordure: "#E5DCC8",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "Times New Roman", "serif"],
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Tracking-aware tiny labels
        eyebrow: ["10px", { lineHeight: "1.2", letterSpacing: "0.18em" }],
      },
      borderRadius: {
        tile: "4px",
      },
      boxShadow: {
        tile: "0 1px 2px rgba(43,36,25,0.04), inset 0 1px 0 rgba(255,255,255,0.5)",
        elev: "0 4px 24px -8px rgba(43,36,25,0.12)",
      },
      backgroundImage: {
        // Subtle paper-grain noise via inline SVG (no external request)
        "paper-grain":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.17  0 0 0 0 0.14  0 0 0 0 0.10  0 0 0 0.04 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
} satisfies Config;
