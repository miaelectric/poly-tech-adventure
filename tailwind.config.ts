import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        dohyeon: ['"Do Hyeon"', "sans-serif"],
        orbitron: ['"Orbitron"', '"Do Hyeon"', "sans-serif"],
      },
      colors: {
        // 테크토닉 팔레트 (docs/PRD.md §4)
        tech: {
          bg: "#0B1120",
          panel: "#0F172A",
          cyan: "#06B6D4",
          blue: "#3B82F6",
          amber: "#F59E0B",
        },
      },
      boxShadow: {
        "neon-cyan": "0 0 0 1px rgba(34,211,238,0.25), 0 0 18px rgba(6,182,212,0.35)",
        "neon-amber": "0 0 0 1px rgba(251,191,36,0.25), 0 0 18px rgba(245,158,11,0.35)",
        "start-btn": "0 6px 0 #1E3A8A, 0 0 28px rgba(6,182,212,0.45)",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        jiggle: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-4px)" },
          "75%": { transform: "translateX(4px)" },
        },
        popIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        bob: "bob 2.2s ease-in-out infinite",
        jiggle: "jiggle 0.3s ease-in-out",
        "pop-in": "popIn 0.22s ease-out",
        scan: "scan 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
