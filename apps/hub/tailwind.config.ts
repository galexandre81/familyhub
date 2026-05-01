import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          principal: "#FAFAF7",
          card: "#FFFFFF",
          sombre: "#1F2933",
        },
        text: {
          principal: "#1F2933",
          secondaire: "#6B7280",
          clair: "#FAFAF7",
        },
        accent: {
          chaud: "#C8553D",
          secondaire: "#4A7C59",
          attention: "#E8A042",
        },
        bordure: "#E5E5E0",
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: ["-apple-system", "BlinkMacSystemFont", "Helvetica Neue", "Inter", "sans-serif"],
      },
      borderRadius: {
        tile: "12px",
      },
      boxShadow: {
        tile: "0 1px 3px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
