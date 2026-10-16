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
import { engineReady, solveStep, randomScramble, readMethod, runMethod } from "./puzzly.js";
// The method the Solve button uses
import { METHOD } from "./method.js";
// Solution evaluation against the method, per step
import { evaluateSolution, renderEvaluation } from "./evaluate.js";

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
// Method picker, solver buttons and the evaluation panel
const methodSelector = document.getElementById("select-method");
const solveBtn = document.getElementById("solve-btn");
const crossBtn = document.getElementById("cross-btn");
const evalBtn = document.getElementById("eval-btn");
const evalPanel = document.getElementById("evaluation");
// Status line, solution move count and solved badge
const statusLine = document.getElementById("status");
const moveCount = document.getElementById("move-count");
const solvedBadge = document.getElementById("solved-badge");
let currentScramble = '';

// Methods in the method picker, by option value (only CFOP for now)
const METHOD_CHOICES = { cfop: METHOD };

// The method picked in the method picker
function currentMethod() {
  return METHOD_CHOICES[methodSelector.value] ?? METHOD;
}

// The picked method's name as the picker shows it
function currentMethodLabel() {
  return methodSelector.selectedOptions[0]?.text ?? "method";
}

// Move text on one line with single spaces (pasted line breaks and double spaces included)
function cleanMoves(text) {
  return text.replace(/\s+/g, " ").trim();
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
});

// Runs a puzzly solve on the current 3x3 scramble and plays its answer on the cube (label names the answer in the status line)
async function playPuzzly(button, label, solve) {
  // puzzly only knows the 3x3
  if (!is3x3()) return;
  button.disabled = true;
  button.classList.add("is-busy");
  try {
    // Wait for the engine (only slow the first time), then solve
    if (engineState === "loading") setStatus("Waiting for the solver engine…", "busy");
    await engineReady;
    setStatus(`Finding the ${label}…`, "busy");
    const solution = (await solve(currentScramble.trim())).toString();
    // Show it in the solution box and play it on the scrambled cube
    solveInput.value = solution;
    playSolution();
    setStatus(`Found the ${label}: ${getLastMoveCount()} moves.`, "ok");
  } catch (e) {
    // A typo in a custom scramble, or the engine failing to load
    console.error("[puzzly]", e);
    setStatus(`Couldn't find the ${label}: ${e.message}`, "error");
  } finally {
    // Button back, unless the puzzle was switched to the 2x2 meanwhile
    button.classList.remove("is-busy");
    button.disabled = !is3x3();
  }
}

// Solve button: solves the scramble with the picked method, step by step
solveBtn.addEventListener("click", () => playPuzzly(solveBtn, `${currentMethodLabel()} solution`, async (scr) => {
  // Check the method's fields, then run its steps one after another
  const result = await runMethod(scr, readMethod(currentMethod()));
  // Each step's own moves, in the console
  console.table(result.steps.map((s) => ({ step: s.name, solution: s.solution.toString(), moves: s.moves })));
  return result.solution;
}));

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

// ============ EVALUATION ============
// Evaluate button: splits your solution into the method's steps and compares each with the engine's pick from the same spot
evalBtn.addEventListener("click", async () => {
  // puzzly only knows the 3x3
  if (!is3x3()) return;
  evalBtn.disabled = true;
  evalBtn.classList.add("is-busy");
  // The panel shows a spinner and the progress while the runs go
  evalPanel.classList.add("is-loading");
  evalPanel.textContent = "Evaluating…";
  try {
    // Runs the method once per step, so show which run is going
    const evaluation = await evaluateSolution(currentScramble.trim(), cleanMoves(solveInput.value), currentMethod(), (run, runs) => {
      evalPanel.textContent = `Evaluating… engine run ${run} of ${runs}`;
    });
    evalPanel.classList.remove("is-loading");
    renderEvaluation(evalPanel, evaluation);
    setStatus("Evaluation ready.", "ok");
  } catch (e) {
    // A typo in the solution, a bad method field, or the engine failing to load: said in the status line, panel closed
    evalPanel.replaceChildren();
    setStatus(`Evaluation failed: ${e.message}`, "error");
    console.error("[puzzly]", e);
  } finally {
    // Panel and button back to normal
    evalPanel.classList.remove("is-loading");
    evalBtn.classList.remove("is-busy");
    evalBtn.disabled = !is3x3();
  }
});
