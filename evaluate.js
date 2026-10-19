// Solution evaluation: splits a typed solution into the method's steps and compares each with the engine's pick from the same spot
import {
  engineReady,
  readMethod,
  runMethod,
  beamSearchMethod,
  reachesGoal,
  gripRotations,
  offsetsFromText,
  solvableFromText,
  splitAlternatives,
  countMoves,
  speedCost,
  speedCostAfter,
  fingering,
  fingeringText,
  joinSteps,
} from "./puzzly.js";
// How the engine solves with a method: Search fastest keeping this many, or a plain run (0)
import { keepingFor } from "./method.js";

// ============ RUN CACHE ============
// Method runs made so far, by method, scramble and moves before (the newest last); past RUN_CACHE_SIZE the oldest goes
const RUN_CACHE_SIZE = 64;
const runCache = new Map();

// ============ RUN PROGRESS ============
// A run's live progress, as puzzly's page follows it: the step (and round) under way, partial solves (Search fastest), table work, and its time once done
function newProgress(method) {
  return {
    // The method's name without its note in brackets, its steps, and how many partial solves Search fastest keeps (0 = a plain run)
    method: method.name.replace(/\s*\(.*\)\s*$/, ""),
    steps: method.steps,
    keeping: keepingFor(method),
    // When it started, and how long it took once it's done
    started: performance.now(),
    ms: null,
    // The step (and round) under way (null = none yet: Search fastest makes a plain run first), and the partial solves it extends
    index: null,
    round: 1,
    partials: 0,
    // The search worker's table work: a note while a table is built or loaded, and how many were
    tableNote: "",
    built: 0,
    loaded: 0,
  };
}

// Listener for the search worker's table work (puzzly's onProgress), kept in a run's progress
function tableListener(progress) {
  return (table) => {
    // Under way: a note for the live status
    if (!table.finished) {
      progress.tableNote = table.action === "build" ? " · building tables…" : " · loading stored tables…";
      return;
    }
    // Done: note cleared, and counted when it really made a table
    progress.tableNote = "";
    if (table.states && table.action === "build") progress.built++;
    if (table.states && table.action === "load") progress.loaded++;
  };
}

// Time as "850 ms" or "1.42 s", like puzzly's page
function formatMs(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

// Count with its word, e.g. "1 table" or "4 tables"
function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

// A run's live status, worded like puzzly's page: the step under way (looking ahead, or its partial solves), the time so far and any table work
export function progressText(progress) {
  const step = progress.index === null ? null : progress.steps[progress.index];
  // Step name, numbered by round for a repeated step, and its place in the method
  const name = step ? (step.repeat ? `${step.name} ${progress.round}` : step.name) : "";
  const where = step ? `step ${progress.index + 1} of ${progress.steps.length} (${name})` : "";
  const time = formatMs(progress.ms ?? performance.now() - progress.started);
  // Search fastest: its plain run first, then the step it extends and how many partial solves
  if (progress.keeping) {
    const state = step ? `${where}, ${plural(progress.partials, "partial solve")}` : "plain run first";
    return `Searching ${progress.method} for the fastest solve (${state})… ${time}${progress.tableNote}`;
  }
  // Plain run: the step under way, and whether it judges its answers by the next steps
  const looking = step?.lookahead && (step.repeat || progress.index < progress.steps.length - 1) ? " · looking ahead" : "";
  return `Running ${progress.method}: ${where || "starting"}${looking}… ${time}${progress.tableNote}`;
}

// A finished run's time and table work, for the final status, e.g. "12.40 s, built 2 tables"
export function progressSummary(progress) {
  const built = progress.built ? `, built ${plural(progress.built, "table")}` : "";
  const loaded = progress.loaded ? `, loaded ${plural(progress.loaded, "stored table")}` : "";
  return `${formatMs(progress.ms ?? performance.now() - progress.started)}${built}${loaded}`;
}

// ============ ENGINE RUNS ============
// One engine solve of a method from a spot: puzzly's Search fastest keeping keepingFor(method) (its cheapest whole solve), or a plain run when that's 0;
// progress follows it as it goes
async function solveMethod(scramble, method, done, progress) {
  // Table builds and loads, for the live status
  const onProgress = tableListener(progress);
  // Plain run: each step its own pick, lookahead included
  if (!progress.keeping) {
    return runMethod(scramble, method, {
      done,
      onProgress,
      // Which step (and round) runs now
      onStart: (index, round) => Object.assign(progress, { index, round }),
      // Each step in the console as soon as it finishes, with its time, so a slow step shows even when the run never ends
      onStep: (step, index) => console.log(`[puzzly] ${progress.method}: ${index + 1}. ${step.name} in ${formatMs(step.ms)} · ${step.moves} moves${step.alg ? ` · ${step.alg}` : ""}`),
    });
  }
  // Beam search by speed; it starts from the plain run, so it never does worse
  const found = await beamSearchMethod(scramble, method, {
    done,
    width: progress.keeping,
    onProgress,
    // Which step (and round) the search extends now, and how many partial solves
    onLevel: (index, round, partials) => Object.assign(progress, { index, round, partials }),
  });
  // No partial solve got through every step
  if (!found.best) throw new Error("no solve gets through every step.");
  return found.best;
}

// The cache key of a method run from one spot
function runKey(scramble, method, done) {
  return JSON.stringify([method.name, scramble.trim(), done.trim()]);
}

// A method run from one spot, made once: asking again for the same method, scramble and moves before gets the same run (finished or still going),
// so Solve, a re-evaluation and steps starting from the same spot share it
export function cachedRun(scramble, method, done = "") {
  const key = runKey(scramble, method, done);
  let entry = runCache.get(key);
  if (entry) {
    // Used again: moved to the newest end
    runCache.delete(key);
  } else {
    // A new run with its live progress
    const progress = newProgress(method);
    entry = { run: solveMethod(scramble, method, done, progress), progress };
    // Its time once done; one that fails is dropped, so asking again tries again
    entry.run.then(
      () => (progress.ms = performance.now() - progress.started),
      () => runCache.get(key) === entry && runCache.delete(key),
    );
  }
  runCache.set(key, entry);
  // Oldest out past the limit
  if (runCache.size > RUN_CACHE_SIZE) runCache.delete(runCache.keys().next().value);
  return entry.run;
}

// The live progress of the run cachedRun made (or is making) for this method, scramble and moves before (null = none asked for)
export function runProgress(scramble, method, done = "") {
  return runCache.get(runKey(scramble, method, done))?.progress ?? null;
}

// A move text as a list of moves (rotations included)
function words(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Wide and slice turns as the face turn plus cube rotation they make (the same on the cube), so the engine follows the grip by x, y, z alone
const PLAIN = {
  Rw: ["L", "x"],
  Lw: ["R", "x'"],
  Uw: ["D", "y"],
  Dw: ["U", "y'"],
  Fw: ["B", "z"],
  Bw: ["F", "z'"],
  M: ["R", "L'", "x'"],
  E: ["U", "D'", "y'"],
  S: ["F'", "B", "z"],
};

// A face turn or rotation ("L'", "x") turned by an amount ("" = as is, "'" = inverted, "2" or "2'" = doubled)
function turn(part, amount) {
  const base = part.replace("'", "");
  if (amount.startsWith("2")) return `${base}2`;
  return base + (part.endsWith("'") !== (amount === "'") ? "'" : "");
}

// One typed move as plain face turns and rotations: wide (Rw or r) and slice turns rewritten, anything else kept as typed
function plainMove(move) {
  const [, layer, amount] = move.match(/^([A-Za-z]w?)(2'?|'?)$/) ?? [];
  // Lowercase r, l, u, d, f, b are wide turns too
  const family = layer && /^[rludfb]$/.test(layer) ? `${layer.toUpperCase()}w` : layer;
  const parts = PLAIN[family];
  return parts ? parts.map((part) => turn(part, amount)).join(" ") : move;
}

// Whether one step's own goal holds after these moves, in the grip they end in; with several steps of the same pieces (CFOP's pairs),
// as many of its alternatives must hold as its place among them (Pair 3 = any 3 pairs)
function ownDone(scramble, moves, steps, index) {
  const step = steps[index];
  // How many steps up to this one ask for the same pieces
  const needed = steps.slice(0, index + 1).filter((other) => other.pieces === step.pieces).length;
  const offsets = offsetsFromText(step.offsets ?? "");
  const solvable = solvableFromText(step.solvableWith ?? "");
  // The alternatives that hold right now
  const held = splitAlternatives(step.pieces).filter((pieces) => reachesGoal(scramble, moves, pieces, offsets, solvable));
  return held.length >= needed;
}

// Whether a step is done after these moves: its own goal, and the earlier steps' too when it keeps their pieces
function stepDone(scramble, moves, steps, index) {
  if (!ownDone(scramble, moves, steps, index)) return false;
  return !steps[index].keep || index === 0 || stepDone(scramble, moves, steps, index - 1);
}

// Where each step of a typed solution ends, as move counts: for each step in order, the first point from the last step's end where it's done
// (in any grip the step allows); stops at the first step the solution never finishes
function stepEnds(scramble, moves, steps) {
  const ends = [];
  let from = 0;
  for (let index = 0; index < steps.length; index++) {
    const grips = gripRotations(steps[index].grips.bottom, steps[index].grips.anyFront);
    // First point where the step holds (-1 = never)
    let end = -1;
    for (let at = from; at <= moves.length && end < 0; at++) {
      const done = moves.slice(0, at).join(" ");
      if (grips.some((grip) => stepDone(scramble, `${done} ${grip}`.trim(), steps, index))) end = at;
    }
    if (end < 0) break;
    ends.push(end);
    from = end;
  }
  return ends;
}

// The engine's answer for one step from your spot, judged by the same goal your moves are split by: the engine run's steps in order, up to the first one
// after which that step holds (in any grip it allows), so a run that counts steps differently (a pair the cross solved by luck, say) still lines up with yours
function enginePick(scramble, done, run, steps, index) {
  const grips = gripRotations(steps[index].grips.bottom, steps[index].grips.anyFront);
  // Whether the step holds after these plain moves
  const holds = (moves) => grips.some((grip) => stepDone(scramble, `${moves.join(" ")} ${grip}`.trim(), steps, index));
  const plain = [...done];
  const texts = [];
  if (holds(plain)) return "";
  for (const step of run.steps) {
    // This engine step's moves as shown (its wide writing when it has one), and as plain turns to check the goal with
    const text = step.wide ?? step.solution.toString();
    if (text) texts.push(text);
    plain.push(...words(step.solution.toString()).map(plainMove));
    if (holds(plain)) break;
  }
  // Joined as the engine joins its own steps: turns of one layer where steps meet become one (y2 then y2 is nothing)
  return joinSteps(...texts);
}

// Moves after the moves before them, as the engine scores a step: count, speed (lower = faster) and suggested fingertricks
// (nothing before = they start the solve, so a rotation first is free)
function stepFigures(text, before) {
  const fresh = before === "";
  return {
    text,
    moves: text ? countMoves(text) : 0,
    speed: text ? speedCostAfter(text, before, undefined, fresh) : 0,
    tricks: text ? fingeringText(fingering(text, undefined, fresh)) : "",
  };
}

// A whole run of moves split into steps (starts = where each step starts): count, speed and fingertricks, each step's counts starting over at its start
function runFigures(text, moves, starts, fresh) {
  return {
    text,
    moves,
    speed: text ? speedCost(text, undefined, fresh, starts) : 0,
    tricks: text ? fingeringText(fingering(text, undefined, fresh, starts)) : "",
  };
}

// A method run's figures, from its moves as the hands make them (its wide writing when it has one)
function methodFigures(run, fresh) {
  return runFigures(run.wide ?? run.solution, run.moves, run.starts, fresh);
}

// Evaluate a typed solution against a method: per step, your moves and the engine's pick from the same spot, and the engine's whole way on from there
// (onProgress hears which engine run is going, of how many, the step it starts from, and that run's live progress for progressText)
export async function evaluateSolution(scramble, solution, methodData, onProgress = () => {}) {
  await engineReady;
  const method = readMethod(methodData);
  // BLD and repeated steps don't map onto one stretch of a typed solution
  if (method.steps.some((step) => step.buffer || step.untouched || step.repeat)) throw new Error("Evaluation doesn't handle BLD or repeated steps.");
  // Your moves as typed (scored and shown as you wrote them), and as plain face turns and rotations (what the engine starts from)
  const moves = words(solution);
  const plain = moves.map(plainMove);
  const all = moves.join(" ");
  const ends = stepEnds(scramble, plain, method.steps);
  // Steps to compare: the ones your solution finishes, plus the one it stops in
  const count = Math.min(ends.length + 1, method.steps.length);
  // Your solution goes on past its last finished step (or never finishes one)
  const unfinishedTail = ends.length < method.steps.length && moves.length > (ends.at(-1) ?? 0);
  // Where each step starts: steps your moves found already done start where the last one did, and share its run
  const starts = Array.from({ length: count }, (_, index) => (index === 0 ? 0 : ends[index - 1]));
  const spots = [...new Set(starts)];
  const runs = spots.length + (unfinishedTail ? 1 : 0);
  const steps = [];
  for (let index = 0; index < count; index++) {
    const start = starts[index];
    // Your moves before this step: the engine starts from there too
    const before = moves.slice(0, start).join(" ");
    // The engine starts from your moves in plain turns, so it knows how the cube is held (a spot already run comes from the cache)
    const startMoves = plain.slice(0, start).join(" ");
    const pending = cachedRun(scramble, method, startMoves);
    // A new spot: say which run is going, from which step, and that run's live progress
    if (index === 0 || start !== starts[index - 1]) onProgress(spots.indexOf(start) + 1, runs, method.steps[index].name, runProgress(scramble, method, startMoves));
    const run = await pending;
    // The engine's answer for this step, cut where this step's goal first holds (the same yardstick as yours)
    const pick = enginePick(scramble, plain.slice(0, start), run, method.steps, index);
    const yours = index < ends.length ? moves.slice(start, ends[index]).join(" ") : null;
    steps.push({
      name: method.steps[index].name,
      yours: yours === null ? null : stepFigures(yours, before),
      engine: stepFigures(pick, before),
      fromHere: methodFigures(run, before === ""),
      run,
    });
  }
  // The engine's way on from your last move, when your solution stops partway through a step
  let fromYourEnd = null;
  if (unfinishedTail) {
    // Started first, so its live progress can be passed on
    const pending = cachedRun(scramble, method, plain.join(" "));
    onProgress(runs, runs, "the end of yours", runProgress(scramble, method, plain.join(" ")));
    fromYourEnd = methodFigures(await pending, false);
  }
  return {
    method: method.name,
    complete: ends.length === method.steps.length,
    // Your whole solution, each step's counts starting over where the step starts
    yours: runFigures(all, all ? countMoves(all) : 0, [0, ...ends].filter((at) => at < moves.length), true),
    // The engine's whole method solution from the scramble (the first run starts there)
    engine: methodFigures(steps[0].run, true),
    fromYourEnd,
    steps,
  };
}

// Mean of a list of numbers (null when it's empty)
function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// Whether you made moves in a step: already-done steps and the one your solution stops in aren't choices to rate
function rated(step) {
  return Boolean(step.yours && step.yours.moves > 0 && step.yours.speed > 0);
}

// Score an evaluation. Rating: per step, the engine's pick from your spot over yours (100% = as good as the engine, above = better), for moves and
// for speed, averaged over the steps you made moves in. Pace (with your time in seconds): TPS, execution (speed cost per second, i.e. TPS weighted by how
// hard the moves are), the engine's whole method solution made at that execution rate, and the time your step choices cost at it
export function scoreEvaluation(evaluation, time = null) {
  const steps = evaluation.steps.filter(rated);
  // Per-step averages: scores and differences
  const rating = {
    steps: steps.length,
    moves: mean(steps.map((step) => step.engine.moves / step.yours.moves)),
    speed: mean(steps.map((step) => step.engine.speed / step.yours.speed)),
    movesDiff: mean(steps.map((step) => step.yours.moves - step.engine.moves)),
    speedDiff: mean(steps.map((step) => step.yours.speed - step.engine.speed)),
  };
  // No time (or nothing turned): no pace figures
  if (!(time > 0) || !(evaluation.yours.speed > 0)) return { rating, pace: null };
  // Easy turns per second: how fast you turned, whatever the moves were
  const execution = evaluation.yours.speed / time;
  return {
    rating,
    pace: {
      time,
      tps: evaluation.yours.moves / time,
      execution,
      engineTime: evaluation.engine.speed / execution,
      choicesTime: steps.reduce((sum, step) => sum + step.yours.speed - step.engine.speed, 0) / execution,
    },
  };
}

// A share as a whole percentage ("—" when there's none)
function percent(value) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

// Seconds as "7.68 s", or "1:02.50" from a minute up
function clock(seconds) {
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
}

// A summary tile: a small label, a big value and a note under it
function tile(label, value, note) {
  const element = document.createElement("div");
  element.className = "tile";
  // Label, value and note, each on its own line
  for (const [className, text] of [["tile-label", label], ["tile-value", value], ["tile-note", note]]) {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    element.append(line);
  }
  return element;
}

// A row of summary tiles
function tileRow(...tiles) {
  const row = document.createElement("div");
  row.className = "eval-summary";
  row.append(...tiles);
  return row;
}

// The score's tiles, each row under its title: the per-step rating, then TPS, execution and the engine at your pace (or a hint to add your time)
function summary(score, evaluation) {
  const { rating, pace } = score;
  // Rating per step: moves and speed, with the average difference per step
  const over = rating.steps === 1 ? "1 step" : `${rating.steps} steps`;
  const ratingRow = tileRow(
    tile("Moves", percent(rating.moves), rating.steps ? `avg of ${over} · ${signed(rating.movesDiff, 1)} moves/step` : "no step to rate yet"),
    tile("Speed", percent(rating.speed), rating.steps ? `avg of ${over} · ${signed(rating.speedDiff, 1)} speed/step` : "no step to rate yet"),
  );
  const parts = [sectionTitle("Rating · per step, engine = 100%"), ratingRow, sectionTitle("Pace · from your time")];
  // Without a time: a hint where the pace tiles would be
  if (!pace) {
    const hint = document.createElement("p");
    hint.className = "eval-hint";
    hint.textContent = "Add your solve time next to the method to see TPS, execution and the engine at your pace.";
    return [...parts, hint];
  }
  // Pace: TPS, execution, and the engine's solution at your execution rate
  const paceRow = tileRow(
    tile("TPS", pace.tps.toFixed(2), `${evaluation.yours.moves} moves in ${clock(pace.time)}`),
    tile("Execution", pace.execution.toFixed(2), "easy turns/s: TPS weighted by move difficulty"),
    tile("Engine at your pace", clock(pace.engineTime), `you: ${clock(pace.time)} · step choices: ${signed(pace.choicesTime, 2)} s`),
  );
  return [...parts, paceRow];
}

// A small section title inside the panel
function sectionTitle(text) {
  const title = document.createElement("h4");
  title.className = "eval-section";
  title.textContent = text;
  return title;
}

// A cell with plain text
function textCell(text, tag = "td") {
  const cell = document.createElement(tag);
  cell.textContent = text;
  return cell;
}

// A cell with moves, their count and speed, and their fingertricks folded away ("—" = nothing to show)
function movesCell(figures) {
  if (!figures) return textCell("—");
  const cell = document.createElement("td");
  // The moves, or a note when the step took none
  const moves = document.createElement("div");
  moves.className = "moves";
  moves.textContent = figures.text || "(already done)";
  // Count and speed
  const score = document.createElement("div");
  score.className = "score";
  score.textContent = `${figures.moves} moves · speed ${figures.speed.toFixed(1)}`;
  cell.append(moves, score);
  // Suggested fingertricks, opened on click
  if (figures.tricks) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Fingertricks";
    const tricks = document.createElement("pre");
    tricks.textContent = figures.tricks;
    details.append(summary, tricks);
    cell.append(details);
  }
  return cell;
}

// A number with its sign (+2, -1.5, 0)
function signed(value, digits = 0) {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

// One signed difference, tinted: below zero = yours did better, above = worse
function deltaSpan(value, digits, unit) {
  const span = document.createElement("span");
  const rounded = Number(value.toFixed(digits));
  span.className = `delta ${rounded < 0 ? "better" : rounded > 0 ? "worse" : "even"}`;
  span.textContent = `${signed(value, digits)} ${unit}`;
  return span;
}

// Your step against the engine's pick: how many more moves and how much more speed cost yours took (negative = yours did better), then the step's
// score, and with a pace the time the difference makes at your execution rate
function diffCell(step, pace) {
  const { yours, engine } = step;
  if (!yours) return textCell("—");
  const cell = document.createElement("td");
  cell.append(deltaSpan(yours.moves - engine.moves, 0, "moves"), " · ", deltaSpan(yours.speed - engine.speed, 1, "speed"));
  // Steps you made no moves in aren't rated
  if (!rated(step)) return cell;
  // This step's score: engine over yours, for moves and speed
  const score = document.createElement("div");
  score.className = "score";
  score.textContent = `score ${percent(engine.moves / yours.moves)} moves · ${percent(engine.speed / yours.speed)} speed`;
  cell.append(score);
  // At your execution rate: the time this step's choice cost (or saved)
  if (pace) {
    const time = document.createElement("div");
    time.className = "score";
    time.textContent = `≈ ${signed((yours.speed - engine.speed) / pace.execution, 2)} s at your pace`;
    cell.append(time);
  }
  return cell;
}

// A table with a header row, then rows of ready cells
function table(headers, rows) {
  const element = document.createElement("table");
  const head = element.insertRow();
  for (const header of headers) head.append(textCell(header, "th"));
  for (const cells of rows) element.insertRow().append(...cells);
  return element;
}

// A table in a box that scrolls sideways when the panel is narrower than the table
function scrollBox(element) {
  const box = document.createElement("div");
  box.className = "table-wrap";
  box.append(element);
  return box;
}

// Show an evaluation in an element: the rating and pace tiles, one row per step, then the raw whole-solve figures (time = your solve time in seconds, or null)
export function renderEvaluation(element, evaluation, time = null) {
  element.replaceChildren();
  const score = scoreEvaluation(evaluation, time);
  // Close button: empties the panel, which hides it
  const close = document.createElement("button");
  close.className = "close";
  close.type = "button";
  close.title = "Close";
  close.setAttribute("aria-label", "Close evaluation");
  close.textContent = "×";
  close.addEventListener("click", () => element.replaceChildren());
  // Title with the method's name, under a small "Evaluation" label
  const title = document.createElement("h3");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Evaluation";
  title.append(eyebrow, evaluation.method);
  // Header: title and close button
  const head = document.createElement("div");
  head.className = "eval-head";
  head.append(title, close);
  // Whole solve: yours, the engine's, and the engine's way on from where yours stops
  const whole = table(
    ["Whole solve", "Moves"],
    [
      [textCell(evaluation.complete ? "Yours" : "Yours (unfinished)", "th"), movesCell(evaluation.yours)],
      [textCell("Engine's method solution", "th"), movesCell(evaluation.engine)],
      ...(evaluation.fromYourEnd ? [[textCell("Engine from the end of yours", "th"), movesCell(evaluation.fromYourEnd)]] : []),
    ],
  );
  // Per step: yours, the engine's pick from the same spot, the difference with the step's score, and the engine's whole way on from there
  const perStep = table(
    ["Step", "Yours", "Engine's pick", "You vs engine", "Engine from here"],
    evaluation.steps.map((step) => [textCell(step.name, "th"), movesCell(step.yours), movesCell(step.engine), diffCell(step, score.pace), movesCell(step.fromHere)]),
  );
  // The per-step table keeps a minimum width (its box scrolls instead)
  perStep.className = "per-step";
  // Tiles first, then the steps the rating comes from, then the raw totals
  element.append(
    head,
    ...summary(score, evaluation),
    sectionTitle("Per step"),
    scrollBox(perStep),
    sectionTitle("Whole solve · raw, luck included"),
    scrollBox(whole),
  );
}
