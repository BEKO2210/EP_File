import type { Config } from "tailwindcss";

/**
 * Design-Sprache: hochmodern, übersichtlich, "elevated neutrals".
 * Bewusst KEIN Lila. Ein zurückhaltender Teal-Akzent, neutrale Zinc-Basis,
 * warmes Off-White als Flächenfarbe.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#FAFAF9", // warmes Off-White (elevated neutral)
        surface: "#FFFFFF",
        ink: "#18181B", // zinc-900
        muted: "#71717A", // zinc-500
        line: "#E4E4E7", // zinc-200
        accent: {
          DEFAULT: "#0D9488", // teal-600
          soft: "#CCFBF1", // teal-100
          ink: "#134E4A", // teal-900
        },
        // Entitätstypen — klar unterscheidbar, kein Lila.
        person: "#0D9488", // teal
        org: "#D97706", // amber-600
        place: "#475569", // slate-600
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,24,27,0.04), 0 1px 8px rgba(24,24,27,0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
