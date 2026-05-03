import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* "Caractère" — noir mat warm + accents laiton/châtaignier */
        ebony: {
          DEFAULT: "#0F0D0A",   /* fond global */
          panel: "#15110D",     /* panneaux header/footer */
          card: "#1C1815",      /* cartes */
          ridge: "#2A1F15",     /* hover/active */
        },
        wood: {
          dark: "#3A2E22",      /* hairline / borders */
          mid: "#5C3D1F",       /* walnut moyen */
          light: "#C49B6B",     /* châtaignier clair */
        },
        brass: {
          DEFAULT: "#D9A05B",   /* accent principal */
          deep: "#C28A47",      /* hover */
          soft: "#2A1F15",      /* fond hover terracotta-style */
        },
        copper: "#C9712E",
        sage: "#7BA471",
        cream: {
          DEFAULT: "#F2E8D5",   /* texte principal */
          mute: "#9C8A6E",      /* texte secondaire */
        },

        /* Compat anciens noms — mapped to dark theme */
        "bg-principal": "#0F0D0A",
        "bg-card": "#1C1815",
        "bg-sombre": "#15110D",
        "text-principal": "#F2E8D5",
        "text-secondaire": "#9C8A6E",
        "text-clair": "#F2E8D5",
        "accent-chaud": "#D9A05B",
        "accent-secondaire": "#7BA471",
        "accent-attention": "#C9712E",
        bordure: "#3A2E22",

        /* Aliases pour le redesign Login */
        paper: "#0F0D0A",
        ivory: "#1C1815",
        ink: {
          DEFAULT: "#F2E8D5",
          mute: "#9C8A6E",
          soft: "#C49B6B",
        },
        terracotta: {
          DEFAULT: "#D9A05B",
          deep: "#C28A47",
          soft: "#2A1F15",
        },
        ochre: "#D9A05B",
        hairline: "#3A2E22",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "Times New Roman", "serif"],
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "sans-serif"],
        mono: ["DM Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        eyebrow: ["10px", { lineHeight: "1.2", letterSpacing: "0.22em" }],
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
