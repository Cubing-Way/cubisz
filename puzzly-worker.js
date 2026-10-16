// Puzzly search worker: the engine's worker with the Rust search code, fetched by URL
import wasm from "puzzly/search/pkg/puzzly_search_bg.wasm?url";
import { runSearchWorker } from "puzzly/src/engine/worker/search-worker.ts";

runSearchWorker({
  wasm,
  // Helper workers for long searches; skipped where a worker can't start workers of its own
  helper: typeof Worker === "function" ? () => new Worker(new URL("./puzzly-helper.js", import.meta.url), { type: "module" }) : undefined,
});
