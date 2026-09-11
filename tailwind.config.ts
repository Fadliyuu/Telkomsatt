import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        telkomsat: {
          red: "#E31E24",
          "red-dark": "#B91C22",
          "red-light": "#F43F47",
          black: "#1F2937",
          "gray-dark": "#4B5563",
          gray: "#6B7280",
          "gray-light": "#9CA3AF",
          "gray-lighter": "#E5E7EB",
        },
      },
    },
  },
  plugins: [],
};
export default config;

