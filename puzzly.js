// Puzzly engine for cubisz: starts the engine with its search worker, and re-exports everything it has
import { loadEngine } from "puzzly/src/engine/index.ts";

// Resolves once the engine is loaded; await it before solving
export const engineReady = loadEngine({
  searchWorker: () => new Worker(new URL("./puzzly-worker.js", import.meta.url), { type: "module" }),
});

// The whole engine API (solveStep, solveFull, randomScramble, parseMoves…)
export * from "puzzly/src/engine/index.ts";
