// Puzzly engine for cubisz: starts the engine with its search and scoring workers and the Rust speed model, connects to the solve server, and re-exports
// everything it has
import wasm from "puzzly/search/pkg/puzzly_search_bg.wasm?url";
import { loadEngine, remoteEngine } from "puzzly/src/engine/index.ts";

// Resolves once the engine is loaded; await it before solving. Answers ranked by speed are scored in the scoring worker while the search worker lists
// more, and what the page scores itself with the Rust speed model (a few times quicker than the TypeScript one, the same costs)
export const engineReady = loadEngine({
  searchWorker: () => new Worker(new URL("./puzzly-worker.js", import.meta.url), { type: "module" }),
  scoringWorker: () => new Worker(new URL("./puzzly-scoring.js", import.meta.url), { type: "module" }),
  wasm,
});

// The solve server: puzzly's engine on AWS (its server/handler.ts), one engine call a request, up to 120 s each, so the page builds no tables for it
export const server = remoteEngine("https://mqk2qwohtvuie2fxutaa4nghpa0qrkfl.lambda-url.us-east-2.on.aws/");

// The whole engine API (solveStep, solveFull, randomScramble, parseMoves…)
export * from "puzzly/src/engine/index.ts";
