import {
  mountCube,
  setSize,
  setView,
  applyScramble,
  applySolution,
  getLastMoveCount,
  checkSolved,
  setFMC,
  puzzleSelect
} from "./api.js";

import { genRanState, scramble } from "./scramble.js";

// puzzly engine: full and step solves of the 3x3, and random-state scrambles
import { engineReady, solveStep, randomScramble, readMethod } from "./puzzly.js";
// Every method the method picker offers, the one it starts on, and which ones search (slow)
import { METHODS, METHOD, keepingFor } from "./method.js";
// Solution evaluation against the method, per step, the method runs it shares with Solve, and their live progress
import { evaluateSolution, renderEvaluation, cachedRun, runProgress, progressText, progressSummary } from "./evaluate.js";

const container = document.getElementById("cube-wrapper");

// Read the puzzle selector.
const puzzleSelector = document.getElementById("select-puzzle");

if (!puzzleSelector) {
  throw new Error('Could not find element with id "select-puzzle".');
}

// Move boxes and the FMC switch
const scrambleInput = document.getElementById("custom-scramble");
const solveInput = document.getElementById("custom-solve");
const fmcToggle = document.getElementById("fmc-toggle");
// Method picker (and its slow warning), solve time box, solver buttons and the evaluation panel
const methodSelector = document.getElementById("select-method");
const methodSlow = document.getElementById("method-slow");
const timeInput = document.getElementById("solve-time");
const solveBtn = document.getElementById("solve-btn");
const crossBtn = document.getElementById("cross-btn");
const evalBtn = document.getElementById("eval-btn");
const evalPanel = document.getElementById("evaluation");
// Status line, solution move count and solved badge
const statusLine = document.getElementById("status");
const moveCount = document.getElementById("move-count");
const solvedBadge = document.getElementById("solved-badge");
let currentScramble = '';

// Method picker: one option per method (its place in METHODS as value), starting on method.js's pick; the slow ones (Search fastest) say so after their name
methodSelector.replaceChildren(...METHODS.map((method, index) => {
  const label = keepingFor(method) ? `${method.name} ⚠ slow` : method.name;
  return new Option(label, String(index), method === METHOD, method === METHOD);
}));

// The method picked in the method picker
function currentMethod() {
  return METHODS[methodSelector.value] ?? METHOD;
}

// Slow warning beside the Method label while a slow method is picked (the closed picker cuts long names, so its own warning may not show)
function showMethodWarning() {
  methodSlow.hidden = !keepingFor(currentMethod());
}
showMethodWarning();
methodSelector.addEventListener("change", showMethodWarning);

// Note for the busy status while a slow method (Search fastest) solves or evaluates, "" for every other method
function slowNote() {
  return keepingFor(currentMethod()) ? " Slow method: this can take a few minutes." : "";
}

// The picked method's name for the status line, without its note in brackets or the slow warning
function currentMethodLabel() {
  return currentMethod().name.replace(/\s*\(.*\)\s*$/, "");
}

// Move text on one line with single spaces (pasted line breaks and double spaces included); // comments go first, up to their line's end, since on
// one line a comment would swallow every move after it (the engine reads the rest of the line as comment)
function cleanMoves(text) {
  return text.replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, " ").trim();
}

// Whether the 3x3 is picked (puzzly only knows the 3x3)
function is3x3() {
  return puzzleSelector.value === "3x3Opt";
}

// ============ STATUS ============
// Shows a short message under the solver buttons; tone: "info", "busy", "ok" or "error"
function setStatus(text, tone = "info") {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

// Engine state: "loading", "ready" or "failed"
let engineState = "loading";
engineReady.then(
  () => {
    engineState = "ready";
    showSolverState();
  },
  (e) => {
    engineState = "failed";
    setStatus(`The solver engine failed to load: ${e.message}`, "error");
  },
);

// Solver controls work on the 3x3 only: disabled on the 2x2, and the status line says why (or how the engine is doing)
function showSolverState() {
  for (const control of [methodSelector, solveBtn, crossBtn, evalBtn]) control.disabled = !is3x3();
  if (!is3x3()) setStatus("The solver works on the 3×3 only.", "info");
  else if (engineState === "ready") setStatus("Solver ready.", "ok");
  else if (engineState === "loading") setStatus("Loading the solver engine…", "busy");
  else setStatus("The solver engine failed to load.", "error");
}

// ============ CUBE SIZE ============
// Largest sticker size: the size the cube had before the redesign
const MAX_STICKER = 28;
let stickerSize = null;

// Sticker size that fits the net's width in the stage: MAX_STICKER, smaller only on narrow screens
function fitCube() {
  const n = is3x3() ? 3 : 2;
  const room = container.clientWidth - 32;
  // One face's width, with the gap and padding renderer.js's resize gives that size (and the grids' -2px margins)
  const face = (size) => {
    const gap = Math.max(2, Math.round(size * 0.18));
    return n * size + (n - 1) * gap + 2 * gap - 4;
  };
  // The net is four faces wide
  let size = MAX_STICKER;
  while (size > 12 && 4 * face(size) > room) size--;
  // Only resize when the size changes
  if (size === stickerSize) return;
  stickerSize = size;
  setSize(size);
}

// ============ SOLUTION STATE ============
// Solution move count (rotations not counted) and the solved badge, after the solution is played
function showSolutionState() {
  const hasSolution = cleanMoves(solveInput.value) !== "";
  moveCount.hidden = !hasSolution;
  moveCount.textContent = `${getLastMoveCount()} moves`;
  solvedBadge.hidden = !(hasSolution && checkSolved());
}

// Plays the typed solution on the scrambled cube, then updates its move count and solved badge
function playSolution() {
  applySolution(cleanMoves(solveInput.value));
  showSolutionState();
}

// Initial selection
puzzleSelect(puzzleSelector.value);
newRandomScramble();
mountCube(container);
setView("2d");
showSolverState();
// Cube sized to the stage now, and again whenever the stage changes size
fitCube();
new ResizeObserver(fitCube).observe(container);

// ============ VIEW (2D / 3D) ============
// View buttons: flat net or 3D cube
document.querySelectorAll('input[name="view"]').forEach((radio) => {
  radio.addEventListener("change", () => setView(radio.value));
});

// ============ SCRAMBLE INPUT (LIVE) ============
// New scramble: a random-state one from puzzly for the 3x3, cubisz's random moves for the 2x2
async function newRandomScramble() {
  if (is3x3()) {
    // Wait for the engine, then ask it for a scramble
    await engineReady;
    currentScramble = await randomScramble();
  } else {
    // cubisz's own random moves
    genRanState();
    currentScramble = cleanMoves(scramble);
  }
  // Show it and apply it to the cube; the old solution was for the old scramble, so it goes
  scrambleInput.value = currentScramble;
  applyScramble(currentScramble);
  solveInput.value = "";
  showSolutionState();
}

// Live typing → same as before
scrambleInput.addEventListener("input", (e) => {
  currentScramble = cleanMoves(e.target.value);
  applyScramble(currentScramble);
  solveInput.value = ""; // Clear solution after scramble is applied
  showSolutionState();
});

// Enter doesn't start a new line in the move boxes: moves stay on one line
for (const box of [scrambleInput, solveInput]) {
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
  });
}

// FMC toggle: scramble applied again under the new rules, with the solution on top
fmcToggle.addEventListener("change", (e) => {
  setFMC(e.target.checked);
  applyScramble(currentScramble);
  playSolution();
});

// Scramble button → same as before
document.getElementById("scramble-btn").addEventListener("click", () => {
  newRandomScramble();
});

// ============ SOLVE INPUT (LIVE) ============
solveInput.addEventListener("input", () => {
  playSolution();
  prefetchRun();
});

// The engine's run from the scramble is the slowest part of an evaluation (and what Solve shows): start it in the background once you type a solution,
// so it's ready (or under way) by the time you press Evaluate; asking again for the same scramble and method costs nothing
function prefetchRun() {
  if (!is3x3() || engineState !== "ready" || !currentScramble) return;
  // A failure here is ignored: Solve or Evaluate run it again and report it
  cachedRun(currentScramble, readMethod(currentMethod())).catch(() => {});
}

// Runs a puzzly solve on the current 3x3 scramble and plays its answer on the cube (label names the answer in the status line, note follows it while busy,
// progress gives the engine run's live progress when there is one, as evaluate.js's runProgress does)
async function playPuzzly(button, label, solve, note = "", progress = () => null) {
  // puzzly only knows the 3x3
  if (!is3x3()) return;
  button.disabled = true;
  button.classList.add("is-busy");
  // Live status, every 100 ms like puzzly's page: the run's step, time and table work when it reports them, else what's being found
  const tick = () => {
    const live = progress();
    setStatus(`${live ? progressText(live) : `Finding the ${label}…`}${note}`, "busy");
  };
  let timer = null;
  try {
    // Wait for the engine (only slow the first time), then solve
    if (engineState === "loading") setStatus("Waiting for the solver engine…", "busy");
    await engineReady;
    timer = setInterval(tick, 100);
    const solving = solve(currentScramble.trim());
    tick();
    const solution = (await solving).toString();
    clearInterval(timer);
    // Show it in the solution box and play it on the scrambled cube
    solveInput.value = solution;
    playSolution();
    // How long the run took and its table work, when it reports them
    const finished = progress();
    setStatus(`Found the ${label}: ${getLastMoveCount()} moves${finished ? ` (${progressSummary(finished)})` : ""}.`, "ok");
  } catch (e) {
    // A typo in a custom scramble, or the engine failing to load
    console.error("[puzzly]", e);
    setStatus(`Couldn't find the ${label}: ${e.message}`, "error");
  } finally {
    // Live status stopped, and the button back, unless the puzzle was switched to the 2x2 meanwhile
    clearInterval(timer);
    button.classList.remove("is-busy");
    button.disabled = !is3x3();
  }
}

// Solve button: solves the scramble with the picked method, step by step, its live progress in the status line
solveBtn.addEventListener("click", () => {
  // The method and scramble of this solve, so its progress is looked up even if they change meanwhile
  const method = currentMethod();
  const scr = currentScramble.trim();
  playPuzzly(solveBtn, `${currentMethodLabel()} solution`, async () => {
    // Check the method's fields, then solve it as method.js says (Search fastest, or a plain run), or take the solve already made for this scramble
    const result = await cachedRun(scr, readMethod(method));
    // Each step's own moves, time and alg case, in the console
    console.table(result.steps.map((s) => ({ step: s.name, solution: s.solution.toString(), moves: s.moves, ms: Math.round(s.ms), alg: s.alg ?? "" })));
    return result.solution;
  }, slowNote(), () => runProgress(scr, method));
});

// Cross button: puzzly's shortest cross on D
crossBtn.addEventListener("click", () => playPuzzly(crossBtn, "shortest cross", async (scr) => (await solveStep(scr, "DF DR DB DL")).solution));

// ============ PUZZLE ============
// Puzzle buttons: set the hidden select and let its change listeners (here and in renderer.js) switch the puzzle
document.querySelectorAll('input[name="puzzle"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    puzzleSelector.value = radio.value;
    puzzleSelector.dispatchEvent(new Event("change"));
  });
});

// Change implementation whenever the user changes the selector
puzzleSelector.addEventListener("change", () => {
  puzzleSelect(puzzleSelector.value);
  newRandomScramble();
  // Solver controls on or off, and the new puzzle fitted to the stage
  showSolverState();
  fitCube();
});

// ============ SOLVE TIME ============
// Solve time from the time box, in seconds: "12.34", "12,34" or "1:02.50" (null when empty or unreadable)
function readTime() {
  const match = timeInput.value.trim().replace(",", ".").match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

// The evaluation on show, so a new time can score it again without running the engine
let shownEvaluation = null;

// Time box: marked when its text can't be read, and the open evaluation scored again with the new time
timeInput.addEventListener("input", () => {
  timeInput.setAttribute("aria-invalid", String(timeInput.value.trim() !== "" && readTime() === null));
  // Only while that evaluation is still in the panel (closing it empties the panel)
  if (shownEvaluation && evalPanel.querySelector(".eval-head")) renderEvaluation(evalPanel, shownEvaluation, readTime());
});

// ============ EVALUATION ============
// Evaluate button: splits your solution into the method's steps and compares each with the engine's pick from the same spot
evalBtn.addEventListener("click", async () => {
  // puzzly only knows the 3x3
  if (!is3x3()) return;
  evalBtn.disabled = true;
  evalBtn.classList.add("is-busy");
  // The panel shows a spinner and the progress while the runs go
  shownEvaluation = null;
  evalPanel.classList.add("is-loading");
  evalPanel.textContent = "Evaluating…";
  // Which engine run is going (and from which step), and that run's live progress
  let runNote = "";
  let live = null;
  // Panel text every 100 ms like puzzly's page: the run, then its step, time and table work
  const tick = () => {
    evalPanel.textContent = `Evaluating…${runNote}${live ? ` ${progressText(live)}` : ""}${slowNote()}`;
  };
  const timer = setInterval(tick, 100);
  try {
    // Runs the method once per spot a step starts from, so show which run is going, from which step, and how it's doing
    const evaluation = await evaluateSolution(currentScramble.trim(), cleanMoves(solveInput.value), currentMethod(), (run, runs, from, progress) => {
      runNote = ` engine run ${run} of ${runs} (from ${from}).`;
      live = progress;
      tick();
    });
    clearInterval(timer);
    // Show it scored with the time typed so far (if any)
    evalPanel.classList.remove("is-loading");
    shownEvaluation = evaluation;
    renderEvaluation(evalPanel, evaluation, readTime());
    setStatus("Evaluation ready.", "ok");
  } catch (e) {
    // A typo in the solution, a bad method field, or the engine failing to load: said in the status line, panel closed
    evalPanel.replaceChildren();
    setStatus(`Evaluation failed: ${e.message}`, "error");
    console.error("[puzzly]", e);
  } finally {
    // Live text stopped, and the panel and button back to normal
    clearInterval(timer);
    evalPanel.classList.remove("is-loading");
    evalBtn.classList.remove("is-busy");
    evalBtn.disabled = !is3x3();
  }
});
