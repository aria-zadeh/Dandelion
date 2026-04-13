/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Focal warm palette
        // Primary action — warm amber/golden
        primary: {
          DEFAULT: "hsl(35, 85%, 55%)",
          light: "hsl(35, 85%, 70%)",
          dark: "hsl(35, 85%, 45%)",
          foreground: "hsl(30, 10%, 10%)",
        },
        // Backgrounds — warm off-whites and darks
        surface: {
          DEFAULT: "hsl(40, 33%, 98%)",
          card: "hsl(35, 40%, 97%)",
          elevated: "hsl(35, 35%, 95%)",
          dark: "hsl(25, 15%, 10%)",
          "dark-card": "hsl(25, 12%, 14%)",
          "dark-elevated": "hsl(25, 10%, 18%)",
        },
        // Text — warm tones
        content: {
          DEFAULT: "hsl(30, 10%, 15%)",
          secondary: "hsl(30, 8%, 45%)",
          muted: "hsl(30, 6%, 60%)",
          inverse: "hsl(35, 20%, 95%)",
          "dark-primary": "hsl(35, 20%, 95%)",
          "dark-secondary": "hsl(30, 10%, 65%)",
          "dark-muted": "hsl(30, 8%, 45%)",
        },
        // Semantic colors
        success: {
          DEFAULT: "hsl(145, 55%, 48%)",
          light: "hsl(145, 55%, 92%)",
          dark: "hsl(145, 55%, 35%)",
        },
        warning: {
          DEFAULT: "hsl(38, 90%, 55%)",
          light: "hsl(38, 90%, 92%)",
          dark: "hsl(38, 90%, 40%)",
        },
        danger: {
          DEFAULT: "hsl(0, 70%, 58%)",
          light: "hsl(0, 70%, 93%)",
          dark: "hsl(0, 70%, 45%)",
        },
        // UI elements
        border: {
          DEFAULT: "hsl(30, 15%, 90%)",
          dark: "hsl(25, 10%, 20%)",
        },
        // Accent — softer amber for highlights
        accent: {
          DEFAULT: "hsl(33, 74%, 62%)",
          light: "hsl(33, 74%, 90%)",
          dark: "hsl(33, 74%, 50%)",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
      },
      spacing: {
        // Additional spacing tokens
        18: "72px",
        22: "88px",
      },
      fontSize: {
        display: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        title: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        heading: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        caption: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        small: ["12px", { lineHeight: "16px", fontWeight: "400" }],
      },
    },
  },
  plugins: [],
};
