import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          dark: "#0a0e1a",
        },
        panel: {
          DEFAULT: "#f8fafc",
          dark: "#111827",
        },
        card: {
          DEFAULT: "#ffffff",
          dark: "#1a1f2e",
        },
        sidebar: {
          DEFAULT: "#0f1629",
          dark: "#0f1629",
        },
        accent: {
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          light: "#a78bfa",
          muted: "rgba(124, 58, 237, 0.15)",
        },
        border: {
          DEFAULT: "#e2e8f0",
          dark: "#1e293b",
        },
      },
      backgroundImage: {
        "gradient-accent": "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)",
        "gradient-card": "linear-gradient(135deg, rgba(124, 58, 237, 0.05) 0%, rgba(99, 102, 241, 0.05) 100%)",
        "gradient-dark-card": "linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)",
        "gradient-success": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        "gradient-danger": "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
        "gradient-warning": "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
        "gradient-info": "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
      },
      boxShadow: {
        "glow-sm": "0 0 15px -3px rgba(124, 58, 237, 0.15)",
        "glow": "0 0 25px -5px rgba(124, 58, 237, 0.2)",
        "glow-lg": "0 0 35px -5px rgba(124, 58, 237, 0.3)",
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)",
        "card-dark": "0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.1)",
        "card-dark-hover": "0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
