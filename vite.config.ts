import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const optimizeFontDisplay = {
  name: "optimize-font-display",
  enforce: "pre" as const,

  transform(code: string, id: string) {
    if (
      id.includes("@fontsource/dm-sans/") ||
      id.includes("@fontsource/playfair-display/")
    ) {
      return code.replace(/font-display:\s*swap/g, "font-display: optional");
    }

    return null;
  },

  generateBundle(_options: unknown, bundle: Record<string, any>) {
    const html = bundle["index.html"];

    if (!html || html.type !== "asset" || typeof html.source !== "string") {
      return;
    }

    const fontFiles = Object.keys(bundle).filter((fileName) =>
      /(?:^|\/)(playfair-display-latin-400-normal|dm-sans-latin-(400|700)-normal)-[^/]+\.woff2$/.test(fileName)
    );

    const preloadLinks = fontFiles
      .map(
        (fileName) =>
          `<link rel="preload" href="/Hotel-Booking-Platform/${fileName}" as="font" type="font/woff2" crossorigin />`
      )
      .join("\n    ");

    if (preloadLinks) {
      html.source = html.source.replace(
        "</head>",
        `    ${preloadLinks}\n  </head>`
      );
    }

    const cssFiles = Object.keys(bundle).filter(
      (fileName) => fileName.endsWith(".css") && bundle[fileName].type === "asset"
    );

    if (cssFiles.length === 0) {
      return;
    }

    const inlineStyles = cssFiles
      .map((fileName) => {
        const asset = bundle[fileName];
        let css = typeof asset.source === "string"
          ? asset.source
          : new TextDecoder().decode(asset.source);

        css = css.replace(
          /url\((['"]?)(?!data:|https?:|\/|#)([^)'"]+)\1\)/g,
          (_match: string, quote: string, resource: string) => {
            const resolved = path.posix.normalize(
              path.posix.join(path.posix.dirname(fileName), resource.trim())
            );

            return `url(${quote}/Hotel-Booking-Platform/${resolved}${quote})`;
          }
        );

        return `<style>${css}</style>`;
      })
      .join("\n");

    html.source = html.source.replace(
      /<link\b[^>]*href=["'][^"']+\.css["'][^>]*>/g,
      ""
    );

    html.source = html.source.replace(
      "</head>",
      `${inlineStyles}\n  </head>`
    );

    for (const fileName of cssFiles) {
      delete bundle[fileName];
    }
  },
};

export default defineConfig({
  base: "/Hotel-Booking-Platform/",
  plugins: [optimizeFontDisplay, react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: true,
  },
});

