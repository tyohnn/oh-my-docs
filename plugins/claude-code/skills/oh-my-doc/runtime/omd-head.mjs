/**
 * Shared <head> assets for local HTML catalogs.
 * Tailwind CDN is intentional: `.omd` pages have no bundler.
 * Offline fallback styles live in omd-doc.css (shadcn-like tables).
 */

export const OMD_TAILWIND_CDN = 'https://cdn.tailwindcss.com';

/** Inline Tailwind config + shadcn-ish CSS variables for catalog pages. */
export function omdTailwindBootstrapScript() {
  return `<script src="${OMD_TAILWIND_CDN}"></script>
<script>
  tailwind.config = {
    darkMode: ["class"],
    theme: {
      extend: {
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))",
          },
          card: {
            DEFAULT: "hsl(var(--card))",
            foreground: "hsl(var(--card-foreground))",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
        },
        fontFamily: {
          sans: ["var(--omd-font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
          mono: ["var(--omd-font-mono)", "ui-monospace", "monospace"],
          display: ["var(--omd-font-display)", "ui-serif", "Georgia", "serif"],
        },
      },
    },
  };
</script>`;
}

/**
 * @param {string} cssHref relative path to omd-doc.css
 */
export function omdDocumentHeadExtras(cssHref) {
  return `  <link rel="stylesheet" href="${cssHref}" />
  ${omdTailwindBootstrapScript()}`;
}
