// Vite setup for cubisz
import { defineConfig } from "vite";

// cubing.js's own files (puzzly's dependency), except its search worker's entry
const CUBING = /[\/]node_modules[\/]cubing[\/](?!.*search-worker-entry)/;

export default defineConfig({
  // Workers as ES modules, so puzzly's search worker can split chunks and start its helpers
  worker: { format: "es" },
  build: {
    rolldownOptions: {
      output: {
        // cubing.js starts its search worker from this exact file name, next to its own code
        chunkFileNames: (chunk) => (chunk.name === "search-worker-entry" ? "assets/search-worker-entry.js" : "assets/[name]-[hash].js"),
        // cubing.js in its own chunk, apart from cubisz's page code, since its worker loads it too
        codeSplitting: { groups: [{ name: "cubing", test: CUBING }] },
      },
    },
  },
});
