/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        /** Макет dofamy.html */
        paper: "#F5F3EE",
        canvas: "#E8E4DA",
        ink: "#1A1915",
        muted: "#8C8A82",
        line: "#E8E5DC",
        mist: "#ECEAE4",
        accent: "#F5C842",
        "accent-dark": "#C9A025",
        success: "#1D9E75",
        "success-dark": "#085041",
        "success-light": "#E1F5EE",
        "amber-soft": "#FDF3D0",
        "amber-ink": "#633806",
        "teal-soft": "#E1F5EE",
        teal: "#0F6E56",
        "coral-soft": "#FAECE7",
        coral: "#993C1D",
        tab: "#C4C2BB",
        dot: "#D3D1C7",
        "ya-yellow": "#F5C842",
        "ya-ink": "#1A1915",
      },
      fontFamily: {
        sans: ["GolosText_400Regular"],
        "sans-medium": ["GolosText_500Medium"],
        "sans-semibold": ["GolosText_600SemiBold"],
        display: ["Unbounded_500Medium"],
        "display-semibold": ["Unbounded_600SemiBold"],
      },
      borderRadius: {
        card: "20px",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
