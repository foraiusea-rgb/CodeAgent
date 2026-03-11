import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "sans-serif"],
      },
      colors: {
        void: "var(--c-void)",
        ink: "var(--c-ink)",
        surface: "var(--c-surface)",
        card: "var(--c-card)",
        border: "var(--c-border)",
        muted: "var(--c-muted)",
        dim: "var(--c-dim)",
        ghost: "var(--c-ghost)",
        soft: "var(--c-soft)",
        text: "var(--c-text)",
        azure: "#4d9eff",
        violet: "#8b5cf6",
        emerald: "#10d98e",
        rose: "#ff4d6d",
        amber: "#ffb830",
      },
      backgroundImage: {
        "gradient-azure": "linear-gradient(135deg, #4d9eff, #8b5cf6)",
        "gradient-emerald": "linear-gradient(135deg, #10d98e, #4d9eff)",
        "noise": "url('/noise.svg')",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(77,158,255,0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(139,92,246,0.5)" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
