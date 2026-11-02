// The engine for other apps, in a worker so a review never holds up the app that asked for it: takes a solve, answers with its metrics
// Its engine runs go to the solve server first, and solve on this device when the server can't answer (see solveMethod in evaluate.js)
import { evaluateSolution, cleanMoves } from "./evaluate.js";
import { METHOD, METHODS } from "./method.js";
import { solveMetrics } from "./metrics.js";

// A solve to review: { id, scramble, solution, time, method } (no method, or an unknown one = the one the site starts on)
self.addEventListener("message", async ({ data: { id, scramble, solution, time, method } }) => {
  try {
    const picked = METHODS.find((one) => one.name === method) ?? METHOD;
    const evaluation = await evaluateSolution(cleanMoves(scramble), cleanMoves(solution), picked, (run, runs, step) => {
      // Which engine run is going, of how many, and the step it starts from
      self.postMessage({ type: "cubisz-progress", id, run, runs, step });
    });
    self.postMessage({ type: "cubisz-metrics", id, metrics: solveMetrics(evaluation, time) });
  } catch (error) {
    self.postMessage({ type: "cubisz-error", id, message: error.message });
  }
});
