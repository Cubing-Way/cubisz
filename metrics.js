// A reviewed solve's metrics: what apps get back from the engine (engine-worker.js), small enough to keep with every solve
import { scoreEvaluation, rated } from "./evaluate.js";

// This format's version, kept with the metrics, so statistics can tell solves reviewed under an older one apart
const METRICS_VERSION = 1;

// A figure to 2 decimals (no figure stays null)
function round(value) {
  return value === null || value === undefined ? null : Math.round(value * 100) / 100;
}

// One step: your moves and effort against the engine's pick from the same spot, and how your step did with what it left for the rest
function stepMetrics(step) {
  return {
    name: step.name,
    // null = your solution stops in this step
    moves: step.yours ? step.yours.moves : null,
    effort: step.yours ? round(step.yours.speed) : null,
    engineMoves: step.engine.moves,
    engineEffort: round(step.engine.speed),
    // Only for steps you made moves in: your step against the pick, with what it left taken off (below 0 = better than the engine)
    netMoves: rated(step) ? step.net.moves : null,
    netEffort: rated(step) ? round(step.net.speed) : null,
    // The step whose moves finished this one too (an OLL skip, say)
    solvedBy: step.solvedBy ?? null,
  };
}

// The engine runs a review used, keeping only what a review reads of them, so the same review can be rebuilt later without the engine (seedRuns in evaluate.js)
function savedRuns(evaluation) {
  return evaluation.runs.map(({ at, run }) => ({
    at,
    moves: run.moves,
    starts: run.starts,
    text: run.wide ?? run.solution,
    rows: run.steps.map((step) => step.wide ?? step.solution.toString()),
  }));
}

// The whole solve's metrics, from a review and your time in seconds (no time = no pace figures)
export function solveMetrics(evaluation, time = null) {
  const { rating, pace } = scoreEvaluation(evaluation, time);
  return {
    version: METRICS_VERSION,
    method: evaluation.method,
    complete: evaluation.complete,
    // Your whole solution
    moves: evaluation.yours.moves,
    effort: round(evaluation.yours.speed),
    regrips: evaluation.yours.fingering?.regrips ?? null,
    // Per step against the engine's picks: its pick over yours (1 = as good as the engine, above = better), averaged over the steps you made moves in
    moveScore: round(rating.moves),
    effortScore: round(rating.speed),
    // Totals with what each step left for the rest (below 0 = better than the engine), and each step alone
    netMoves: rating.netMoves,
    netEffort: round(rating.netSpeed),
    stepEffort: round(rating.stepSpeed),
    // Steps that set up the rest, and later steps your moves solved along the way
    setups: rating.setups,
    alsoSolved: rating.alsoSolved,
    // The engine's own solve from the scramble
    engineMoves: evaluation.engine.moves,
    engineEffort: round(evaluation.engine.speed),
    // Your pace, with your time: moves per second, effort per second, the engine's solve at that rate, and what your choices cost at it
    time: pace ? pace.time : null,
    tps: pace ? round(pace.tps) : null,
    execution: pace ? round(pace.execution) : null,
    engineTime: pace ? round(pace.engineTime) : null,
    netTime: pace ? round(pace.netTime) : null,
    choicesTime: pace ? round(pace.choicesTime) : null,
    steps: evaluation.steps.map(stepMetrics),
    runs: savedRuns(evaluation),
  };
}
