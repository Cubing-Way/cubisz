// Solve review engine: splits a typed solution into the method's steps, compares each with the engine's pick from the same spot, and solves single steps
// (no page code in here: review.js draws what this finds)
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
  joinSteps,
  server,
  RemoteEngineError,
} from "./puzzly.js";
// How the engine solves with a method: Search fastest keeping this many, or a plain run (0), and whether it goes to the solve server
import { keepingFor, onServer } from "./method.js";

// ============ METHODS ============
// Methods read (checked) once each, by their data object
const readMethods = new WeakMap();

// A method's data checked and read by puzzly, made once per method
function methodOf(data) {
  let method = readMethods.get(data);
  if (!method) {
    method = readMethod(data);
    readMethods.set(data, method);
  }
  return method;
}

// Whether a method's steps each map onto one stretch of a typed solution (BLD and repeated steps don't), so it can review solves and solve single steps
export function reviewable(data) {
  return !data.steps.some((step) => step.buffer || step.untouched || step.repeat);
}

// ============ RUN CACHE ============
// Method runs made so far, by method, scramble and moves before (the newest last); past RUN_CACHE_SIZE the oldest goes
const RUN_CACHE_SIZE = 64;
const runCache = new Map();

// ============ SOLVE SERVER ============
// Set once the server can't take any call this session (its month's budget is spent, or it can't be reached): every method solves in the page after that
let serverOff = false;
// Methods the server was too slow or too busy for this session: they solve in the page after that, so a long one doesn't wait 120 s every run
const pageOnly = new Set();

// ============ RUN PROGRESS ============
// A run's live progress, as puzzly's page follows it: the step (and round) under way, partial solves (Search fastest), table work, and its time once done
function newProgress(method) {
  return {
    // The method's name without its note in brackets, its steps, and how many partial solves Search fastest keeps (0 = a plain run)
    method: method.name.replace(/\s*\(.*\)\s*$/, ""),
    steps: method.steps,
    keeping: keepingFor(method),
    // On the solve server (no step-by-step progress comes back from it), or in the page because the server couldn't answer
    remote: onServer(method) && !serverOff && !pageOnly.has(method.name),
    fallback: false,
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
      progress.tableNote = table.action === "build" ? " · building tables (first time only)…" : " · loading stored tables…";
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
export function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

// A run's live status in plain words: the step under way (or its partial solves), the time so far and any table work
export function progressText(progress) {
  const step = progress.index === null ? null : progress.steps[progress.index];
  // Step name, numbered by round for a repeated step, and its place in the method
  const name = step ? (step.repeat ? `${step.name} ${progress.round}` : step.name) : "";
  const where = step ? `${name} (step ${progress.index + 1} of ${progress.steps.length})` : "";
  const time = formatMs(progress.ms ?? performance.now() - progress.started);
  // On the solve server: only the time so far
  if (progress.remote) return `Solving on the server… ${time}`;
  // In the page after the server couldn't answer
  const here = progress.fallback ? "The server couldn't answer, solving here: " : "";
  // Search fastest: its plain run first, then the step it extends and how many partial solves
  if (progress.keeping) {
    const state = step ? `${where}, ${plural(progress.partials, "partial solve")}` : "plain run first";
    return `${here}Searching for the fastest solve: ${state}… ${time}${progress.tableNote}`;
  }
  // Plain run: the step under way
  return `${here}Solving ${where || "…"} ${time}${progress.tableNote}`;
}

// A finished run's time and where it ran or its table work, e.g. "12.40 s, built 2 tables" or "3.10 s, on the server"
export function progressSummary(progress) {
  const where = progress.remote ? ", on the server" : "";
  const built = progress.built ? `, built ${plural(progress.built, "table")}` : "";
  const loaded = progress.loaded ? `, loaded ${plural(progress.loaded, "stored table")}` : "";
  return `${formatMs(progress.ms ?? performance.now() - progress.started)}${where}${built}${loaded}`;
}

// ============ ENGINE RUNS ============
// One engine solve of a method from a spot: puzzly's Search fastest keeping keepingFor(method) (its cheapest whole solve), or a plain run when that's 0;
// a plain run goes to the solve server first, and the page takes over when the server can't answer; progress follows it as it goes
async function solveMethod(scramble, method, done, progress) {
  if (progress.remote) {
    try {
      return await server.runMethod(scramble, method, { done });
    } catch (error) {
      // A bad call or an engine error would fail the same way in the page
      if (!(error instanceof RemoteEngineError && error.local)) throw error;
      // Budget spent or out of reach: no more calls this session; too slow or busy: not for this method
      if (error.status === 429 || error.status === 0) serverOff = true;
      else pageOnly.add(method.name);
      console.warn(`[puzzly] ${progress.method}: the solve server couldn't answer (${error.message}), solving in the page`);
      Object.assign(progress, { remote: false, fallback: true });
    }
  }
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
// so the review, the step solver and steps starting from the same spot share it
function cachedRun(scramble, method, done = "") {
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
function runProgress(scramble, method, done = "") {
  return runCache.get(runKey(scramble, method, done))?.progress ?? null;
}

// Starts the method's run from the scramble in the background (what a review needs first), so it's ready or under way when you press Review
export function prefetchRun(scramble, methodData) {
  // A failure here is ignored: the review runs it again and reports it
  cachedRun(scramble, methodOf(methodData)).catch(() => {});
}

// ============ MOVES ============
// A move text as a list of moves (rotations included)
export function words(text) {
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

// Move texts one after the other, either of them possibly empty
function joinText(...texts) {
  return texts.filter(Boolean).join(" ");
}

// Rows of moves joined as the engine joins its own steps: turns of one layer where steps meet become one (y2 then y2 is nothing)
function joinRows(rows) {
  return joinSteps(...rows.map((row) => row.join(" ")).filter(Boolean));
}

// ============ STEP GOALS ============
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

// Whether a step holds after these plain moves in any grip it allows
function holdsAfter(scramble, moves, steps, index) {
  const grips = gripRotations(steps[index].grips.bottom, steps[index].grips.anyFront);
  return grips.some((grip) => stepDone(scramble, `${moves} ${grip}`.trim(), steps, index));
}

// Where each step of a typed solution ends, as move counts: for each step in order, the first point from the last step's end where it's done
// (in any grip the step allows); stops at the first step the solution never finishes
function stepEnds(scramble, moves, steps) {
  const ends = [];
  let from = 0;
  for (let index = 0; index < steps.length; index++) {
    // First point where the step holds (-1 = never)
    let end = -1;
    for (let at = from; at <= moves.length && end < 0; at++) {
      if (holdsAfter(scramble, moves.slice(0, at).join(" "), steps, index)) end = at;
    }
    if (end < 0) break;
    ends.push(end);
    from = end;
  }
  return ends;
}

// Your solution's steps for the timeline, found live as you type: each finished step's stretch of moves (later steps finished by the same moves go
// with it, in `also`), then the moves after the last finished step (the step they're in, unfinished)
export function splitSolution(scramble, moves, methodData) {
  const method = methodOf(methodData);
  const ends = stepEnds(scramble, moves.map(plainMove), method.steps);
  const segments = [];
  let from = 0;
  ends.forEach((end, index) => {
    const name = method.steps[index].name;
    // Done by the same moves as the step before: named along with it
    if (end === from && segments.length) {
      segments.at(-1).also.push(name);
      return;
    }
    segments.push({ name, index, start: from, end, also: [] });
    from = end;
  });
  // Moves after the last finished step: the step they work on, or moves after the whole method
  if (moves.length > from) {
    const next = method.steps[ends.length];
    segments.push({ name: next ? `${next.name} (unfinished)` : "After the solve", index: ends.length, start: from, end: moves.length, also: [], unfinished: true });
  }
  return { segments, done: ends.length, total: method.steps.length, stopsIn: method.steps[ends.length]?.name ?? null };
}

// How many of the method's steps in a row are done on the cube right after these typed moves (where the step solver starts from)
export function stepsDoneAt(scramble, moves, methodData) {
  const method = methodOf(methodData);
  const done = moves.map(plainMove).join(" ");
  let count = 0;
  while (count < method.steps.length && holdsAfter(scramble, done, method.steps, count)) count++;
  return count;
}

// ============ ENGINE PICKS ============
// The steps a run of moves is made of, named by the engine's step and each with its fingertricks: rows with no moves before the first that turns were
// done already (left out), later empty ones were done along the way (listed in `also` of the part before); fresh = the first part starts the solve
function rowParts(names, rows, fresh) {
  const parts = [];
  rows.forEach((moves, at) => {
    if (moves.length) {
      const text = moves.join(" ");
      parts.push({ name: names[at], text, moves: countMoves(text), fingering: fingering(text, undefined, fresh && !parts.length), also: [] });
    } else if (parts.length) {
      parts.at(-1).also.push(names[at]);
    }
  });
  return parts;
}

// Each row of an engine run as moves (its wide writing when it has one, which keeps the moves that cancel where joined steps meet), with its step names
function runRows(run) {
  return { rows: run.steps.map((step) => words(step.wide ?? step.solution.toString())), names: run.steps.map((step) => step.name) };
}

// The engine's answer for one step from your spot, judged by the same goal your moves are split by: the engine run's moves in order, up to the first one
// after which that step holds (in any grip it allows), so a run that counts steps differently (a pair the cross solved by luck, say) still lines up with yours;
// cut move by move, since the engine joins a step with the next ones when their moves cancel where they meet (L then Rw'), so one of its rows can hold several steps.
// Gives the pick, the steps it's made of, and the rest of the run after it
function enginePick(scramble, done, run, steps, index, fresh) {
  const { rows, names } = runRows(run);
  // Whether the step holds after these plain moves
  const holds = (moves) => holdsAfter(scramble, moves.join(" "), steps, index);
  const plain = [...done];
  if (holds(plain)) return { pick: "", parts: [], rest: joinRows(rows) };
  for (let row = 0; row < rows.length; row++) {
    for (let move = 0; move < rows[row].length; move++) {
      // Each move as plain turns to check the goal with
      plain.push(...words(plainMove(rows[row][move])));
      if (!holds(plain)) continue;
      // Holds: the pick is every move so far, partway through this row; the rest is what follows it
      const used = [...rows.slice(0, row), rows[row].slice(0, move + 1)];
      return {
        pick: joinRows(used),
        parts: rowParts(names, used, fresh),
        rest: joinRows([rows[row].slice(move + 1), ...rows.slice(row + 1)]),
      };
    }
  }
  // Never holds: the whole run
  return { pick: joinRows(rows), parts: rowParts(names, rows, fresh), rest: "" };
}

// ============ FIGURES ============
// Moves after the moves before them, as the engine scores a step: count and effort (speed cost: lower = faster; nothing before = they start the solve,
// so a rotation first is free), counting what they save by cancelling into the moves before
function restFigures(text, before) {
  return {
    text,
    moves: text ? countMoves(text) : 0,
    speed: text ? speedCostAfter(text, before, undefined, before === "") : 0,
  };
}

// The same, with the suggested fingertricks (puzzly's cheapest fingering: who turns each move, and the regrips)
function stepFigures(text, before) {
  return { ...restFigures(text, before), fingering: text ? fingering(text, undefined, before === "") : null };
}

// A whole run of moves split into steps (starts = where each step starts): count, effort and fingertricks, each step's counts starting over at its start
function runFigures(text, moves, starts, fresh) {
  return {
    text,
    moves,
    speed: text ? speedCost(text, undefined, fresh, starts) : 0,
    fingering: text ? fingering(text, undefined, fresh, starts) : null,
  };
}

// A method run's figures, from its moves as the hands make them (its wide writing when it has one), with the steps it's made of
function methodFigures(run, fresh) {
  const { rows, names } = runRows(run);
  return { ...runFigures(run.wide ?? run.solution, run.moves, run.starts, fresh), parts: rowParts(names, rows, fresh) };
}

// One step's slice of a fingering made over the whole solve (so the hands carry on from step to step), or the step's own when the moves don't line up
function sliceFingering(whole, start, end, text, fresh) {
  if (whole && whole.steps.length >= end) return { steps: whole.steps.slice(start, end) };
  return text ? fingering(text, undefined, fresh) : null;
}

// Your moves in the step your solution stops in: count, effort and their slice of your whole solve's fingering
function partialFigures(text, before, whole, start, end) {
  return { ...restFigures(text, before), fingering: sliceFingering(whole, start, end, text, start === 0) };
}

// ============ LOOKAHEAD ============
// Effort a step must leave the rest easier (or harder) than the engine's pick did before it's marked as setting up (or spoiling) the rest
const SETUP_MIN = 1;

// What each step you made moves in leaves for the rest of the solve, so a slower pair that skips OLL (or an XCross) shows what it gains, as figures
// of moves and effort: after = the engine's whole way on from your step's end (the next step's run, nothing once the cube is solved), against
// engineRest = the engine's run after its own pick, each counted after the moves before it;
// setup = engineRest less after (above 0 = you left the rest easier); net = your step against the pick, with the setup taken off (below 0 = better;
// the steps' nets add up to about the whole-solve gap); alsoSolved = the later steps your step's moves finished too, each marked solvedBy that step
function addLookahead(steps, ends, moves) {
  steps.forEach((step, index) => {
    // Already-done steps and the one your solution stops in leave nothing of their own
    if (!rated(step)) return;
    const { yours, engine, engineRest } = step;
    // The engine from your step's end, after your moves up to there: the next step starts there (a finished last step leaves the cube solved)
    const next = steps[index + 1];
    const after = restFigures(next ? next.fromHere.text : "", moves.slice(0, ends[index]).join(" "));
    // Of moves or of effort: what your step left the rest against the engine's pick, and the net that makes
    const setup = (key) => engineRest[key] - after[key];
    const net = (key) => yours[key] - engine[key] - setup(key);
    Object.assign(step, {
      after,
      setup: { moves: setup("moves"), speed: setup("speed") },
      net: { moves: net("moves"), speed: net("speed") },
      alsoSolved: [],
    });
    // Later steps done where this one ends (an OLL skip, an XCross's pair): solved by the same moves
    for (let next = index + 1; next < ends.length && ends[next] === ends[index]; next++) {
      step.alsoSolved.push(steps[next].name);
      steps[next].solvedBy = step.name;
    }
  });
}

// Whether a step's choice changed what's left by enough to say so: +1 = it set up the rest, -1 = it left the rest harder, 0 = neither
export function setupSign(step) {
  if (!step.setup || Math.abs(step.setup.speed) < SETUP_MIN) return 0;
  return Math.sign(step.setup.speed);
}

// ============ REVIEW ============
// Review a typed solution against a method: per step, your moves (with where they are in your solution) and the engine's pick from the same spot,
// and the engine's whole way on from there (onProgress hears which engine run is going, of how many, the step it starts from, and that run's live progress)
export async function evaluateSolution(scramble, solution, methodData, onProgress = () => {}) {
  await engineReady;
  if (!reviewable(methodData)) throw new Error("this method has BLD or repeated steps, which don't map onto one stretch of a solution.");
  const method = methodOf(methodData);
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
  // Your whole solution's fingering, each step starting over where it starts (the hands carry on from one step to the next)
  const stepStarts = [0, ...ends].filter((at) => at < moves.length);
  const yours = runFigures(all, all ? countMoves(all) : 0, stepStarts, true);
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
    // The engine's answer for this step, cut where this step's goal first holds (the same yardstick as yours), and the rest of its run after it
    const { pick, rest } = enginePick(scramble, plain.slice(0, start), run, method.steps, index, before === "");
    // Your moves for this step (null = your solution stops in it), and where they end
    const end = index < ends.length ? ends[index] : moves.length;
    const text = index < ends.length ? moves.slice(start, end).join(" ") : null;
    steps.push({
      name: method.steps[index].name,
      index,
      start,
      end,
      yours: text === null ? null : { ...restFigures(text, before), fingering: sliceFingering(yours.fingering, start, end, text, start === 0) },
      // Your moves after your last finished step, in the step you stopped in (null = none), with their fingertricks
      partial: text === null && end > start ? partialFigures(moves.slice(start, end).join(" "), before, yours.fingering, start, end) : null,
      engine: stepFigures(pick, before),
      engineRest: restFigures(rest, joinText(before, pick)),
      fromHere: methodFigures(run, before === ""),
    });
  }
  // What each step leaves for the rest of the solve, and the later steps it solved too
  addLookahead(steps, ends, moves);
  // The engine's way on from your last move, when your solution stops partway through a step
  let fromYourEnd = null;
  if (unfinishedTail) {
    // Started first, so its live progress can be passed on
    const pending = cachedRun(scramble, method, plain.join(" "));
    onProgress(runs, runs, "the end of yours", runProgress(scramble, method, plain.join(" ")));
    fromYourEnd = methodFigures(await pending, false);
  }
  // The engine's whole method solution from the scramble (the first run starts there)
  const engine = steps[0].fromHere;
  return {
    method: method.name,
    // The method's steps, for splitting engine lines into them (see engineLine)
    methodSteps: method.steps,
    scramble,
    moves,
    ends,
    complete: ends.length === method.steps.length,
    stopsIn: method.steps[ends.length]?.name ?? null,
    yours,
    engine,
    fromYourEnd,
    steps,
  };
}

// ============ ENGINE LINES ============
// Engine lines made so far, per review (step index → line)
const madeLines = new WeakMap();

// The engine's line to follow in a review: its own solve from the scramble (index 0), or a branch off your solution at the start of your step `index`
// (your moves up to there, then the engine's run from your cube). Split into the method's steps by the same goals as yours, so the two line up step
// by step; parts made of your moves alone (before the branch) are marked shared. Made once per review and step
export function engineLine(evaluation, index = 0) {
  let made = madeLines.get(evaluation);
  if (!made) {
    made = new Map();
    madeLines.set(evaluation, made);
  }
  if (made.has(index)) return made.get(index);
  const step = evaluation.steps[index];
  // Your moves before the branch, then the engine's run from there
  const base = evaluation.moves.slice(0, step.start);
  const moves = [...base, ...words(step.fromHere.text)];
  // Fingertricks: yours for the shared moves, then the run's (none when they don't line up with the moves)
  const fingers = [...(evaluation.yours.fingering?.steps.slice(0, base.length) ?? []), ...(step.fromHere.fingering?.steps ?? [])];
  const fingering = fingers.length === moves.length ? { steps: fingers } : null;
  // The step your moves finished last before the branch, for its name
  const after = [...evaluation.steps.slice(0, index)].reverse().find((one) => one.end > one.start)?.name ?? null;
  const line = {
    index,
    label: after ? `Engine after your ${after}` : "Engine's own solve",
    after,
    shared: base.length,
    moves,
    fingering,
    parts: splitLine(evaluation.scramble, moves, fingering, evaluation.methodSteps, base.length),
  };
  made.set(index, line);
  return line;
}

// A line of moves split into the method's steps by the same goals your solution is split by: each step's moves (where they start and end among the
// line's moves), count, effort and fingertricks, and whether they're all before `shared` (your moves, before a branch); a step its moves finished
// along with the one before has no moves and names that step in solvedWith
function splitLine(scramble, moves, fingering, steps, shared = 0) {
  const ends = stepEnds(scramble, moves.map(plainMove), steps);
  let from = 0;
  let last = null;
  return steps.map((step, index) => {
    // A step the line never finishes (the engine always should) takes the rest of its moves
    const end = ends[index] ?? moves.length;
    const text = moves.slice(from, end).join(" ");
    const part = {
      name: step.name,
      index,
      start: from,
      end,
      shared: end <= shared,
      figures: { ...restFigures(text, moves.slice(0, from).join(" ")), fingering: sliceFingering(fingering, from, end, text, from === 0) },
      solvedWith: end === from ? last : null,
    };
    if (end > from) last = step.name;
    from = end;
    return part;
  });
}

// Sum of a list of numbers (0 when it's empty)
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

// Mean of a list of numbers (null when it's empty)
function mean(values) {
  return values.length ? sum(values) / values.length : null;
}

// Whether you made moves in a step: already-done steps and the one your solution stops in aren't choices to rate
export function rated(step) {
  return Boolean(step.yours && step.yours.moves > 0 && step.yours.speed > 0);
}

// Score a review. Rating: per step, the engine's pick from your spot over yours (100% = as good as the engine, above = better), for moves and
// for effort, averaged over the steps you made moves in; and the net, summed over them: your steps with what each left for the rest (0 = even, below = better).
// Pace (with your time in seconds): TPS, execution (effort per second, i.e. TPS weighted by how hard the moves are), the engine's whole method
// solution made at that execution rate, and the time your step choices cost at it, net and step only
export function scoreEvaluation(evaluation, time = null) {
  const steps = evaluation.steps.filter(rated);
  // Per-step averages: scores and differences
  const rating = {
    steps: steps.length,
    moves: mean(steps.map((step) => step.engine.moves / step.yours.moves)),
    speed: mean(steps.map((step) => step.engine.speed / step.yours.speed)),
    movesDiff: mean(steps.map((step) => step.yours.moves - step.engine.moves)),
    speedDiff: mean(steps.map((step) => step.yours.speed - step.engine.speed)),
    // Totals: the net with what each step left, and the step-only difference it replaces
    netMoves: sum(steps.map((step) => step.net.moves)),
    netSpeed: sum(steps.map((step) => step.net.speed)),
    stepSpeed: sum(steps.map((step) => step.yours.speed - step.engine.speed)),
    // Steps that set up the rest, and the later steps your moves solved along the way
    setups: steps.filter((step) => setupSign(step) > 0).length,
    alsoSolved: sum(steps.map((step) => step.alsoSolved.length)),
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
      // Your step choices at that rate: with what each left for the rest, and each step alone
      netTime: rating.netSpeed / execution,
      choicesTime: rating.stepSpeed / execution,
    },
  };
}

// ============ STEP SOLVER ============
// The engine's moves for one step of the method (target = its index), or for every step left (target "all"), from the cube after these typed moves:
// the method's run from there, cut where that step first holds, with its count, effort and fingertricks and the steps it's made of
export async function solveFrom(scramble, moves, methodData, target) {
  await engineReady;
  if (!reviewable(methodData)) throw new Error("this method has BLD or repeated steps, which the step solver can't cut into single steps.");
  const method = methodOf(methodData);
  const plain = moves.map(plainMove);
  const before = moves.join(" ");
  const run = await cachedRun(scramble, method, plain.join(" "));
  // Every step left: the whole run
  if (target === "all") {
    const { rows, names } = runRows(run);
    return { ...stepFigures(joinRows(rows), before), parts: rowParts(names, rows, before === "") };
  }
  // One step: the run up to where it holds
  const { pick, parts } = enginePick(scramble, plain, run, method.steps, target, before === "");
  return { ...stepFigures(pick, before), parts };
}

// The live progress of the run solveFrom makes for these moves (null = none asked for yet)
export function solveProgress(scramble, moves, methodData) {
  return runProgress(scramble, methodOf(methodData), moves.map(plainMove).join(" "));
}
