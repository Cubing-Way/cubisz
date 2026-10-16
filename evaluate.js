// Solution evaluation: splits a typed solution into the method's steps and compares each with the engine's pick from the same spot
import {
  engineReady,
  readMethod,
  runMethod,
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
} from "./puzzly.js";

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
// (onProgress hears which engine run is going, of how many)
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
  const runs = count + (unfinishedTail ? 1 : 0);
  const steps = [];
  for (let index = 0; index < count; index++) {
    onProgress(index + 1, runs);
    // Your moves before this step: the engine starts from there too
    const start = index === 0 ? 0 : ends[index - 1];
    const before = moves.slice(0, start).join(" ");
    // The engine starts from your moves in plain turns, so it knows how the cube is held
    const run = await runMethod(scramble, method, { done: plain.slice(0, start).join(" ") });
    // The engine's answer for this step (earlier steps are done already, so they take no moves)
    const pick = run.steps.find((step) => step.step === index);
    const yours = index < ends.length ? moves.slice(start, ends[index]).join(" ") : null;
    steps.push({
      name: method.steps[index].name,
      yours: yours === null ? null : stepFigures(yours, before),
      engine: stepFigures(pick ? pick.wide ?? pick.solution.toString() : "", before),
      fromHere: methodFigures(run, before === ""),
      run,
    });
  }
  // The engine's way on from your last move, when your solution stops partway through a step
  let fromYourEnd = null;
  if (unfinishedTail) {
    onProgress(runs, runs);
    fromYourEnd = methodFigures(await runMethod(scramble, method, { done: plain.join(" ") }), false);
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

// Your step against the engine's pick: how many more moves and how much more speed cost yours took (negative = yours did better)
function diffCell(yours, engine) {
  if (!yours) return textCell("—");
  const cell = document.createElement("td");
  cell.append(deltaSpan(yours.moves - engine.moves, 0, "moves"), " · ", deltaSpan(yours.speed - engine.speed, 1, "speed"));
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

// Show an evaluation in an element: the whole solve compared, then one row per step
export function renderEvaluation(element, evaluation) {
  element.replaceChildren();
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
  // Per step: yours, the engine's pick from the same spot, the difference, and the engine's whole way on from there
  const perStep = table(
    ["Step", "Yours", "Engine's pick", "You vs engine", "Engine from here"],
    evaluation.steps.map((step) => [textCell(step.name, "th"), movesCell(step.yours), movesCell(step.engine), diffCell(step.yours, step.engine), movesCell(step.fromHere)]),
  );
  // The per-step table keeps a minimum width (its box scrolls instead)
  perStep.className = "per-step";
  element.append(head, scrollBox(whole), scrollBox(perStep));
}
