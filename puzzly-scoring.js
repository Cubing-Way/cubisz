// Puzzly scoring worker: scores the answers of steps ranked by speed with the Rust speed model while the search worker lists more, so the page stays free
import wasm from "puzzly/search/pkg/puzzly_search_bg.wasm?url";
import { runScoringWorker } from "puzzly/src/engine/worker/scoring-worker.ts";

runScoringWorker({
  wasm,
  // Helpers that work out answers' looks and writings ahead (only on devices with more than 4 threads); skipped where a worker can't start workers of its own
  helper: typeof Worker === "function" ? () => new Worker(new URL("./puzzly-scoring-helper.js", import.meta.url), { type: "module" }) : undefined,
});
