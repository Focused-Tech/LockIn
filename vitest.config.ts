import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Components use the automatic JSX runtime (like the Next app) — no `import React` needed.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only`/`client-only` throw at import to enforce the RSC boundary at build time; vitest
      // has no bundler to strip them, so stub them to a no-op. Server modules are lazy — inert on import.
      "server-only": fileURLToPath(new URL("./test-stubs/empty-module.js", import.meta.url)),
      "client-only": fileURLToPath(new URL("./test-stubs/empty-module.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
