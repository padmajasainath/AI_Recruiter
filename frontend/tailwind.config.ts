import type { Config } from "tailwindcss";

const config: any = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
            },
            borderRadius: {
                "3xl": "3rem",
                "4xl": "40px",
                "5xl": "48px",
            },
            boxShadow: {
                "2xl": "0 20px 60px rgba(0,0,0,0.4)",
                "3xl": "0 20px 60px rgba(0,0,0,0.3)",
            },
            spacing: {
                "7xl": "80px",
            },
        },
    },
    safelist: [
        // Ensure these classes are always included
        { pattern: /rounded-\[.*\]/ },
        { pattern: /bg-.*\/.*/ },
        { pattern: /border-.*\/.*/ },
        { pattern: /text-.*/ },
        { pattern: /shadow-\[.*\]/ },
    ],
    plugins: [],
};
export default config;
