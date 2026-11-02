// Vite setup for cubisz
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// cubing.js's own files (puzzly's dependency), except its search worker's entry
const CUBING = /[\/]node_modules[\/]cubing[\/](?!.*search-worker-entry)/;

export default defineConfig({
  // Relative paths in the built site, so it works from a subfolder (GitHub Pages serves it under /cubisz/)
  base: "./",
  // Workers as ES modules, so puzzly's search worker can split chunks and start its helpers
  worker: { format: "es" },
  build: {
    rolldownOptions: {
      // Two pages: the site, and the hidden engine page other apps load
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        engine: fileURLToPath(new URL("./engine.html", import.meta.url)),
      },
      output: {
        // cubing.js starts its search worker from this exact file name, next to its own code
        chunkFileNames: (chunk) => (chunk.name === "search-worker-entry" ? "assets/search-worker-entry.js" : "assets/[name]-[hash].js"),
        // cubing.js in its own chunk, apart from cubisz's page code, since its worker loads it too
        codeSplitting: { groups: [{ name: "cubing", test: CUBING }] },
      },
    },
  },
});
