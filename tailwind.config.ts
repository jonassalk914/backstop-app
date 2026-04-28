import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark sport-utility palette
        bg: {
          DEFAULT: "#0a0a0a",
          panel: "#141414",
          elev: "#1c1c1c",
          hover: "#222222",
        },
        line: "#2a2a2a",
        ink: {
          DEFAULT: "#f5f5f5",
          muted: "#a3a3a3",
          dim: "#737373",
        },
        // Single sharp accent — coaching field chalk yellow / athletic
        signal: {
          DEFAULT: "#d4ff00",
          dim: "#a8cc00",
        },
        ok: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
      fontFamily: {
        display: ['"Bebas Neue"', "Impact", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      letterSpacing: {
        wider: "0.08em",
        widest: "0.16em",
      },
    },
  },
  plugins: [],
};

export default config;
