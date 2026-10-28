// Puzzly engine for cubisz: starts the engine with its search worker, connects to the solve server, and re-exports everything it has
import { loadEngine, remoteEngine } from "puzzly/src/engine/index.ts";

// Resolves once the engine is loaded; await it before solving
export const engineReady = loadEngine({
  searchWorker: () => new Worker(new URL("./puzzly-worker.js", import.meta.url), { type: "module" }),
});

// The solve server: puzzly's engine on AWS (its server/handler.ts), one engine call a request, up to 120 s each, so the page builds no tables for it
export const server = remoteEngine("https://mqk2qwohtvuie2fxutaa4nghpa0qrkfl.lambda-url.us-east-2.on.aws/");

// The whole engine API (solveStep, solveFull, randomScramble, parseMoves…)
export * from "puzzly/src/engine/index.ts";
