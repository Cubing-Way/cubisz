// cubisz page wiring: your solve (scramble, solution, time, method), the cube player, the review and the step solver
import { mountCube, setSize, setView, applyScramble, setFMC, puzzleSelect } from "./api.js";
import { genRanState, scramble } from "./scramble.js";

// puzzly engine: random-state scrambles, and the fingering the player's readout shows
import { engineReady, randomScramble, fingering } from "./puzzly.js";
// Every method, the one the picker starts on, and which ones search (slow)
import { METHODS, METHOD, keepingFor } from "./method.js";
// The review and step solver engine: reviews, live step splits, single steps, and their live progress
import { evaluateSolution, prefetchRun, progressText, progressSummary, reviewable, splitSolution, stepsDoneAt, solveFrom, solveProgress, words, plural } from "./evaluate.js";
// Drawing reviews, the step solver's answers, notices and move chips
import { renderReview, renderSolverResult, renderNotice, highlightMoves, stepColor, methodName, methodNote } from "./review.js";
// The cube player under the cube
import { createPlayer, simMove } from "./player.js";

// ============ ELEMENTS ============
// The cube's area, and the puzzle select renderer.js reads
const container = document.getElementById("cube-wrapper");
const puzzleSelector = document.getElementById("select-puzzle");
// Your solve: move boxes, FMC switch, method picker (and its slow warning and note), time box, review button and status line
const scrambleInput = document.getElementById("custom-scramble");
const solveInput = document.getElementById("custom-solve");
const solveInfo = document.getElementById("solve-info");
// Offer to swap S and S' when that's what keeps the solution from solving, and its button
const sliceHint = document.getElementById("slice-hint");
const sliceFix = document.getElementById("slice-fix");
const fmcToggle = document.getElementById("fmc-toggle");
const methodSelector = document.getElementById("select-method");
const methodSlow = document.getElementById("method-slow");
const methodNoteLine = document.getElementById("method-note");
const timeInput = document.getElementById("solve-time");
const reviewBtn = document.getElementById("review-btn");
const statusLine = document.getElementById("status");
// Tabs, their panels and the fingertricks switch
const tabs = { review: document.getElementById("tab-review"), solver: document.getElementById("tab-solver") };
const panels = { review: document.getElementById("review-panel"), solver: document.getElementById("solver-panel") };
const tricksToggle = document.getElementById("tricks-toggle");
// Step solver: where it starts, the step picker, its button, status and answer
const solverFrom = document.getElementById("solver-from");
const solverDone = document.getElementById("solver-done");
const solverStep = document.getElementById("solver-step");
const solverBtn = document.getElementById("solver-btn");
const solverStatus = document.getElementById("solver-status");
const solverResult = document.getElementById("solver-result");
// The left column, scrolled to on small screens when the cube starts playing
const viewer = document.querySelector(".viewer");

// ============ SAVED SETTINGS ============
// A setting remembered in this browser (null when there's none, or storage is blocked)
function recall(key) {
  try {
    return localStorage.getItem(`cubisz.${key}`);
  } catch {
    return null;
  }
}

// Remembers a setting in this browser (skipped when storage is blocked)
function remember(key, value) {
  try {
    localStorage.setItem(`cubisz.${key}`, value);
  } catch {
    // Private windows and blocked storage: the setting just isn't kept
  }
}

// ============ EXAMPLE ============
// A sample solve to try the review on: a scramble and a plain CFOP solution with a comment per step
const EXAMPLE = {
  scramble: "D2 F2 U' B2 R2 U' L2 D' F2 U2 R2 F' L' U B' R D2 F' U' L2",
  solution: [
    "y' B D2 L' D' R' F2 // cross",
    "R' U' R U R' U' R // pair 1",
    "y' R U R2 U' R // pair 2",
    "D' L' U L D // pair 3",
    "y' R' U R U' R' U' R // pair 4",
    "F' Rw U R' U' Rw' F R // OLL",
    "U x R' U R' D2 R U' R' D2 R2 x' U2 // PLL",
  ].join("\n"),
  time: "16.48",
};

// ============ MOVES AND TIME ============
// Move text on one line with single spaces: // comments go first (up to their line's end), then brackets reconstructions use, then extra spaces
function cleanMoves(text) {
  return text.replace(/\/\/[^\n]*/g, " ").replace(/[()[\]{}]/g, " ").replace(/\s+/g, " ").trim();
}

// S and S' the other way round in a list of moves (S2 stays)
function swapSlices(moves) {
  return moves.map((move) => (move === "S" ? "S'" : move === "S'" ? "S" : move));
}

// The same in the solution box's text: only in the moves, not in // comments, keeping its lines and brackets
function swapSlicesText(text) {
  return text
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      const [code, comment] = at < 0 ? [line, ""] : [line.slice(0, at), line.slice(at)];
      return code.replace(/(^|[\s()[\]{}])S('?)(?=[\s()[\]{}]|$)/g, (_, before, prime) => `${before}S${prime ? "" : "'"}`) + comment;
    })
    .join("\n");
}

// Moves without cube rotations, the count the solution box shows
function turnCount(moves) {
  return moves.filter((move) => !/^[xyz]/.test(move)).length;
}

// Solve time from the time box, in seconds: "12.34", "12,34" or "1:02.50" (null when empty or unreadable)
function readTime() {
  const match = timeInput.value.trim().replace(",", ".").match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const seconds = Number(match[1] ?? 0) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

// ============ STATE ============
// The scramble as applied, your solution's moves, and the live split of them into the method's steps
let currentScramble = "";
let solutionMoves = [];
let liveSplit = null;
// The review on show ({ evaluation, key }: key = the scramble, solution and method it reviewed), and whether one is running
let shown = null;
let reviewing = false;
// The step the step solver's picker was set to by hand (null = it follows the next step to do), and whether it's solving
let solverPicked = null;
let solving = false;
// Engine state: "loading", "ready" or "failed"
let engineState = "loading";

// Whether the 3x3 is picked (puzzly only knows the 3x3)
function is3x3() {
  return puzzleSelector.value === "3x3Opt";
}

// Whether the engine can read the solve now: the 3x3, the engine loaded
function canAnalyze() {
  return is3x3() && engineState === "ready";
}

// ============ METHOD PICKER ============
// Methods the picker offers: the ones whose steps map onto a stretch of a solution (BLD and repeated steps don't)
const PICKABLE = METHODS.filter(reviewable);

// The group a method goes under in the picker
function groupOf(method) {
  if (method.name.startsWith("Computer fastest")) return "Computer fastest (slow)";
  return method.name.startsWith("CFOP") ? "CFOP" : "Other methods";
}

// Picker: one option per method (its place in PICKABLE as value), grouped, named without its note (the full name when two would read the same)
methodSelector.replaceChildren(
  ...["CFOP", "Other methods", "Computer fastest (slow)"].map((label) => {
    const group = document.createElement("optgroup");
    group.label = label;
    PICKABLE.forEach((method, index) => {
      if (groupOf(method) !== label) return;
      const short = methodName(method.name);
      const clash = PICKABLE.filter((other) => methodName(other.name) === short).length > 1;
      group.append(new Option(clash ? method.name : short, String(index), method === METHOD, method === METHOD));
    });
    return group;
  }),
);

// The method picked
function currentMethod() {
  return PICKABLE[methodSelector.value] ?? METHOD;
}

// The picked method's note under the pickers, and the slow warning beside its label
function showMethodNote() {
  const method = currentMethod();
  const slow = keepingFor(method) > 0;
  methodSlow.hidden = !slow;
  methodNoteLine.textContent = [methodNote(method.name), slow ? "Searches for the fastest solve: a review can take minutes." : ""].filter(Boolean).join(" · ");
}

// Note for busy texts while a slow method solves, "" for every other method
function slowNote() {
  return keepingFor(currentMethod()) ? " Slow method: this can take a few minutes." : "";
}

// ============ STATUS ============
// Shows a short message under the review button; tone: "info", "busy", "ok" or "error"
function setStatus(text, tone = "info") {
  statusLine.textContent = text;
  statusLine.dataset.tone = tone;
}

// The same for the step solver's status line
function setSolverStatus(text, tone = "info") {
  solverStatus.textContent = text;
  solverStatus.dataset.tone = tone;
}

// Review and step solver work on the 3x3 only: their controls on or off, and the status line says why (or how the engine is doing)
function showEngineState() {
  for (const control of [methodSelector, reviewBtn, solverBtn, solverStep]) control.disabled = !is3x3();
  if (!is3x3()) setStatus("The review and the step solver work on the 3×3; the 2×2 is a viewer.", "info");
  else if (engineState === "ready") setStatus("Engine ready.", "ok");
  else if (engineState === "loading") setStatus("Loading the solver engine…", "busy");
  else setStatus("The solver engine failed to load.", "error");
}

// ============ CUBE SIZE ============
// Largest sticker size per view: the flat net's, and the 3D cube's, which is only one face across
const MAX_STICKER = { "2d": 40, "3d": 60 };
// Room the 3D cube takes with its floating faces, in face widths each way, for 2x2 and 3x3 (from the view's angles in style.css)
const SPAN_3D = { 2: 2.15, 3: 1.95 };
// The view on show, "2d" or "3d": starts on the checked view button
let view = document.querySelector('input[name="view"]:checked').value;
let stickerSize = null;

// Sticker size that fits the cube in the stage, across and down: MAX_STICKER for the view, smaller when the stage is small
function fitCube() {
  const n = is3x3() ? 3 : 2;
  const roomX = container.clientWidth - 32;
  const roomY = container.clientHeight - 32;
  // One face's width, with the gap and padding renderer.js's resize gives that size (and the grids' -2px margins)
  const face = (size) => {
    const gap = Math.max(2, Math.round(size * 0.18));
    return n * size + (n - 1) * gap + 2 * gap - 4;
  };
  // The net is four faces wide and three tall; the 3D cube with its floating faces is SPAN_3D faces each way
  const [across, down] = view === "3d" ? [SPAN_3D[n], SPAN_3D[n]] : [4, 3];
  let size = MAX_STICKER[view];
  while (size > 12 && (across * face(size) > roomX || down * face(size) > roomY)) size--;
  // Only resize when the size changes
  if (size === stickerSize) return;
  stickerSize = size;
  setSize(size);
}

// ============ PLAYER ============
// The player under the cube, on its elements; every change lights up the move in the review and moves the step solver's start
const player = createPlayer(
  {
    timeline: document.getElementById("timeline"),
    track: document.getElementById("timeline-track"),
    cursor: document.getElementById("timeline-cursor"),
    labels: document.getElementById("timeline-labels"),
    start: document.getElementById("start-btn"),
    prev: document.getElementById("prev-btn"),
    play: document.getElementById("play-btn"),
    playIcon: document.getElementById("play-icon"),
    next: document.getElementById("next-btn"),
    end: document.getElementById("end-btn"),
    step: document.getElementById("now-step"),
    stepPos: document.getElementById("now-step-pos"),
    move: document.getElementById("now-move"),
    finger: document.getElementById("now-finger"),
    count: document.getElementById("now-count"),
    solved: document.getElementById("solved-badge"),
    banner: document.getElementById("preview-banner"),
    bannerText: document.getElementById("preview-label"),
    back: document.getElementById("preview-back"),
  },
  { onChange: playerMoved },
);

// After the player moves: the review's chip of the move just made lit up (none during a preview), and the step solver's start updated
// (once the moves stop coming, so dragging the timeline stays smooth)
let solverTimer = null;
function playerMoved() {
  highlightMoves(panels.review, player.inPreview ? -1 : player.position);
  clearTimeout(solverTimer);
  solverTimer = setTimeout(updateSolver, 40);
}

// Plays the engine's moves on the cube after some moves (your moves before the step), with their fingertricks, until "Back to my solve"
function showEngineMoves(base, text, label) {
  const added = words(text);
  const steps = text ? fingering(text, undefined, base.length === 0).steps : [];
  player.showPreview({ base, added, label, color: "var(--engine)", fingering: steps });
  // Small screens: the cube is above, out of sight
  if (matchMedia("(max-width: 900px)").matches) viewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Makes the engine's moves part of your solution after some moves: added at the end (keeping your text) or, from earlier, replacing what came after
function addMoves(base, text) {
  const atEnd = base.length === solutionMoves.length && base.every((move, index) => move === solutionMoves[index]);
  solveInput.value = atEnd ? `${solveInput.value.trimEnd()}${solveInput.value.trim() ? "\n" : ""}${text}` : [...base, ...words(text)].join(" ");
  refreshSolve();
  setStatus(`Added ${plural(words(text).length, "move")} to your solution.`, "ok");
}

// ============ YOUR SOLVE ============
// Reads your solution again after a change: the player gets its moves and fingertricks, the steps are found again, the review marked if it's out of date
function refreshSolve({ keepPosition = false } = {}) {
  solutionMoves = words(cleanMoves(solveInput.value));
  player.setSolution(solutionMoves, { keepPosition });
  // Each move's suggested fingertrick, for the readout under the cube (puzzly's fingering takes a few ms)
  const steps = solutionMoves.length ? fingering(solutionMoves.join(" "), undefined, true).steps : [];
  player.setDetails({ fingers: steps.length === solutionMoves.length ? steps : [] });
  scheduleSplit();
  markStale();
  // The engine's run from the scramble is the slowest part of a review: started in the background once there's a solution
  if (canAnalyze() && currentScramble && solutionMoves.length) prefetchRun(currentScramble, currentMethod());
}

// Finds your solution's steps again shortly after typing stops: the timeline's pieces and the note beside "Your solution"
let splitTimer = null;
function scheduleSplit() {
  clearTimeout(splitTimer);
  splitTimer = setTimeout(splitNow, 150);
}

// Splits your solution into the method's steps (when the engine can read it) for the timeline, then updates the solution's note
function splitNow() {
  liveSplit = null;
  if (canAnalyze() && currentScramble && solutionMoves.length) {
    try {
      liveSplit = splitSolution(currentScramble, solutionMoves, currentMethod());
    } catch (e) {
      // Moves the engine can't read: no steps, the note says so
      console.warn("[cubisz] step split failed:", e);
    }
  }
  const segments = (liveSplit?.segments ?? []).map((segment) => ({ ...segment, color: segment.unfinished ? "" : stepColor(segment.index) }));
  player.setDetails({ segments });
  showSolveInfo();
  showSliceHint();
}

// Offers to swap S and S' when the solution doesn't solve the cube as typed but does with them swapped (typed for cubisz's old S, or a slip)
function showSliceHint() {
  let solves = false;
  if (liveSplit && liveSplit.done < liveSplit.total && solutionMoves.some((move) => move === "S" || move === "S'")) {
    try {
      const swapped = splitSolution(currentScramble, swapSlices(solutionMoves), currentMethod());
      solves = swapped.done === swapped.total;
    } catch {
      // Moves the engine can't read: no offer
    }
  }
  sliceHint.hidden = !solves;
}

// Swap button: S and S' swapped in the solution box, read again
sliceFix.addEventListener("click", () => {
  solveInput.value = swapSlicesText(solveInput.value);
  refreshSolve();
  setStatus("Swapped S and S' in your solution.", "ok");
});

// The note beside "Your solution": its move count, and whether it solves the cube or where it stops
function showSolveInfo() {
  if (!solutionMoves.length) {
    solveInfo.textContent = "";
    return;
  }
  const count = plural(turnCount(solutionMoves), "move");
  if (!liveSplit) {
    solveInfo.textContent = count;
    return;
  }
  const state = liveSplit.done === liveSplit.total ? "solves the cube ✓" : liveSplit.stopsIn ? `stops in ${liveSplit.stopsIn}` : "";
  solveInfo.textContent = [count, state].filter(Boolean).join(" · ");
  solveInfo.dataset.tone = liveSplit.done === liveSplit.total ? "ok" : "warn";
}

// New scramble: a random-state one from puzzly for the 3x3, cubisz's random moves for the 2x2; your solution was for the old one, so it goes
async function newRandomScramble() {
  if (is3x3()) {
    // Wait for the engine, then ask it for a scramble
    await engineReady;
    setScramble(await randomScramble());
  } else {
    // cubisz's own random moves
    genRanState();
    setScramble(cleanMoves(scramble));
  }
  solveInput.value = "";
  refreshSolve();
}

// Puts a scramble in the box and on the cube
function setScramble(text) {
  scrambleInput.value = text;
  applyCurrentScramble();
}

// Applies the scramble box's moves to the cube (as cubisz's cube model writes them)
function applyCurrentScramble() {
  currentScramble = cleanMoves(scrambleInput.value);
  applyScramble(words(currentScramble).map(simMove).join(" "));
}

// Loads the example solve and reviews it
function loadExample() {
  // The example is a 3x3 solve
  if (!is3x3()) document.querySelector('input[name="puzzle"][value="3x3Opt"]').click();
  setScramble(EXAMPLE.scramble);
  solveInput.value = EXAMPLE.solution;
  timeInput.value = EXAMPLE.time;
  refreshSolve();
  runReview();
}

// Typing a scramble: applied live, your solution kept on top of it (fixing a typo shouldn't cost you your solution)
scrambleInput.addEventListener("input", () => {
  applyCurrentScramble();
  refreshSolve({ keepPosition: true });
});

// Enter doesn't start a new line in the scramble box: a scramble stays on one line
scrambleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.preventDefault();
});

// Typing a solution: played live on the cube, the player at its end
solveInput.addEventListener("input", () => refreshSolve());

// New button: a new random scramble
document.getElementById("scramble-btn").addEventListener("click", () => newRandomScramble());

// FMC switch: scramble applied again under the new rules, with the solution on top
fmcToggle.addEventListener("change", (e) => {
  setFMC(e.target.checked);
  applyCurrentScramble();
  refreshSolve({ keepPosition: true });
});

// Another method: its note, the steps found again, the step solver's picker rebuilt, the review marked out of date
methodSelector.addEventListener("change", () => {
  showMethodNote();
  solverPicked = null;
  solverMethod = null;
  scheduleSplit();
  markStale();
  updateSolver();
  if (canAnalyze() && currentScramble && solutionMoves.length) prefetchRun(currentScramble, currentMethod());
});

// ============ TABS ============
// Shows one tab's panel (review or solver) and remembers it
function selectTab(name) {
  for (const [key, tab] of Object.entries(tabs)) {
    tab.setAttribute("aria-selected", String(key === name));
    panels[key].hidden = key !== name;
  }
  remember("tab", name);
  if (name === "solver") updateSolver();
}

// Tab buttons
for (const [name, tab] of Object.entries(tabs)) tab.addEventListener("click", () => selectTab(name));

// Fingertricks switch: the labels under every move on or off, remembered
function showTricks(on) {
  document.body.classList.toggle("hide-tricks", !on);
  remember("tricks", on ? "on" : "off");
}
tricksToggle.addEventListener("change", () => showTricks(tricksToggle.checked));

// ============ REVIEW ============
// What a review covers: the scramble, the solution and the method, to tell when it's out of date
function reviewKey() {
  return JSON.stringify([currentScramble, solutionMoves.join(" "), currentMethod().name]);
}

// Banner over a review whose solve changed since, with a button to review again
const staleBanner = document.createElement("div");
staleBanner.className = "banner info stale-banner";
staleBanner.hidden = true;
staleBanner.innerHTML = '<p>Your solve changed since this review.</p><button class="btn btn-sm btn-primary" type="button">Review again</button>';
staleBanner.querySelector("button").addEventListener("click", () => runReview());

// Shows the stale banner when the review on show no longer matches your solve
function markStale() {
  staleBanner.hidden = !shown || shown.key === reviewKey();
}

// What the review's buttons do with the cube: jump to a move, play a step, show the engine's moves, add the engine's finish
const reviewActions = {
  // Shows the cube after this many of your moves
  jump: (pos) => {
    player.exitPreview();
    player.seek(pos);
  },
  // Plays one of your steps from its start
  playStep: (start, end) => {
    player.exitPreview();
    player.play(start, end);
  },
  // The engine's pick for a step, from your moves before it
  showEngine: (start, text, label) => showEngineMoves(shown.evaluation.moves.slice(0, start), text, label),
  // The engine's whole solve, from the scramble
  showFromStart: (text, label) => showEngineMoves([], text, label),
  // The engine's way to finish from your last move
  showFromEnd: (text) => showEngineMoves(shown.evaluation.moves, text, "Engine's finish"),
  addFromEnd: (text) => addMoves(shown.evaluation.moves, text),
};

// Draws the review on show with the time typed so far, the stale banner on top
function drawReview() {
  renderReview(panels.review, shown.evaluation, readTime(), reviewActions);
  panels.review.prepend(staleBanner);
  markStale();
  highlightMoves(panels.review, player.inPreview ? -1 : player.position);
}

// The review panel before any review: how it works, with an example to try (or why there's none on the 2x2)
function showEmptyReview() {
  if (!is3x3()) {
    renderNotice(panels.review, { title: "Reviews are for the 3×3", text: "Switch to the 3×3 to review a solve. The 2×2 works as a viewer: type a scramble and a solution to play them." });
    return;
  }
  renderNotice(panels.review, {
    title: "Review a solve in three steps",
    items: [
      "Paste your scramble, or press New for a random one.",
      "Type how you solved it: the timeline under the cube finds your steps as you type.",
      "Press Review my solve: each step is compared with the engine's pick from the same cube, with a fingertrick under every move.",
    ],
    buttons: [
      { label: "Try an example solve", onClick: loadExample, kind: "btn-primary" },
      { label: "Open the step solver", onClick: () => selectTab("solver") },
    ],
  });
}

// Reviews your solution: splits it into the method's steps and compares each with the engine's pick from the same spot
async function runReview() {
  // puzzly only knows the 3x3
  if (!is3x3() || reviewing) return;
  if (!currentScramble || !solutionMoves.length) {
    setStatus(currentScramble ? "Type your solution first (or get one from the step solver)." : "Add a scramble first.", "error");
    (currentScramble ? solveInput : scrambleInput).focus();
    return;
  }
  selectTab("review");
  reviewing = true;
  reviewBtn.disabled = true;
  reviewBtn.classList.add("is-busy");
  // What this review covers, taken now in case you keep typing
  const key = reviewKey();
  const notice = renderNotice(panels.review, { title: "Reviewing your solve…", text: "Starting the engine…", tone: "busy" });
  const line = notice.querySelector("p");
  // Which engine run is going (and from which step), and that run's live progress
  let runNote = "";
  let live = null;
  // Progress text every 100 ms
  const tick = () => {
    line.textContent = `${runNote}${live ? progressText(live) : "Waiting for the engine…"}${slowNote()}`;
  };
  const timer = setInterval(tick, 100);
  try {
    // Runs the method once per spot a step starts from, so say which run is going, from which step, and how it's doing
    const evaluation = await evaluateSolution(currentScramble, solutionMoves.join(" "), currentMethod(), (run, runs, from, progress) => {
      runNote = `Engine run ${run} of ${runs}, from ${from}. `;
      live = progress;
      tick();
    });
    clearInterval(timer);
    shown = { evaluation, key };
    drawReview();
    setStatus("Review ready.", "ok");
  } catch (e) {
    // A typo in the moves, a bad method field, or the engine failing to load
    console.error("[puzzly]", e);
    renderNotice(panels.review, { title: "The review failed", text: e.message, tone: "error", buttons: [{ label: "Try again", onClick: runReview }] });
    setStatus(`Review failed: ${e.message}`, "error");
  } finally {
    // Progress stopped, and the button back
    clearInterval(timer);
    reviewing = false;
    reviewBtn.classList.remove("is-busy");
    reviewBtn.disabled = !is3x3();
  }
}

// Review button
reviewBtn.addEventListener("click", () => runReview());

// Time box: marked when its text can't be read, and the review on show scored again with the new time (no engine run needed)
timeInput.addEventListener("input", () => {
  timeInput.setAttribute("aria-invalid", String(timeInput.value.trim() !== "" && readTime() === null));
  if (shown && !reviewing) drawReview();
});

// ============ STEP SOLVER ============
// The method the step picker's options were made for (rebuilt when it changes)
let solverMethod = null;

// Where the step solver starts, in words: the scramble, a move of your solution, or a move of a preview
function solverStart() {
  const pos = player.position;
  if (player.inPreview) return `the preview on the cube, after move ${pos}`;
  if (pos === 0) return "the scramble";
  return pos === solutionMoves.length ? `the end of your solution (move ${pos})` : `move ${pos} of your solution`;
}

// The step solver's start, what's done there, and its step picker: each step marked done or next, the next one picked unless you picked one yourself
function updateSolver() {
  solverFrom.textContent = solverStart();
  const method = currentMethod();
  // The picker's options, once per method: each step, then every step left
  if (solverMethod !== method) {
    solverMethod = method;
    solverStep.replaceChildren(...method.steps.map((step, index) => new Option(step.name, String(index))), new Option("Everything left (full solve)", "all"));
  }
  if (!canAnalyze()) {
    solverDone.textContent = is3x3() ? "" : "(3×3 only)";
    return;
  }
  // Steps done in a row on the cube as shown
  let done = 0;
  try {
    done = stepsDoneAt(currentScramble, player.shownMoves, method);
  } catch {
    // Moves the engine can't read: counted as nothing done
  }
  const total = method.steps.length;
  solverDone.textContent = done === total ? "· the cube is solved" : done ? `· done up to ${method.steps[done - 1].name}` : "· no step done yet";
  // Options marked: done steps, and the next one
  method.steps.forEach((step, index) => {
    solverStep.options[index].text = `${step.name}${index < done ? " — done" : index === done ? " — next" : ""}`;
  });
  // A step picked by hand stays picked until it's done; otherwise the next step
  if (solverPicked !== null && solverPicked !== "all" && Number(solverPicked) < done) solverPicked = null;
  solverStep.value = solverPicked ?? (done < total ? String(done) : "all");
  solverBtn.disabled = done === total || solving;
}

// Step picked by hand: kept until it's done
solverStep.addEventListener("change", () => {
  solverPicked = solverStep.value;
});

// Finds the engine's moves for the picked step from the cube as shown, and offers to show them or add them to your solution
async function runSolver() {
  if (!is3x3() || solving) return;
  if (!currentScramble) {
    setSolverStatus("Add a scramble first.", "error");
    return;
  }
  // The spot, method and step of this solve, taken now (the player may move meanwhile)
  const from = player.shownMoves;
  const pos = player.position;
  const inPreview = player.inPreview;
  const method = currentMethod();
  const scr = currentScramble;
  const target = solverStep.value === "all" ? "all" : Number(solverStep.value);
  const title = target === "all" ? "Everything left" : method.steps[target].name;
  // An engine run from this spot already made (by the review, or an earlier step): the answer comes from it at once
  const cached = solveProgress(scr, from, method)?.ms != null;
  solving = true;
  solverBtn.disabled = true;
  solverBtn.classList.add("is-busy");
  // Live progress every 100 ms
  const tick = () => {
    const live = solveProgress(scr, from, method);
    setSolverStatus(`${live ? progressText(live) : `Finding ${title}…`}${slowNote()}`, "busy");
  };
  tick();
  const timer = setInterval(tick, 100);
  try {
    const result = await solveFrom(scr, from, method, target);
    clearInterval(timer);
    // What the button does: add at the end, replace your moves after the spot, or make the preview's moves your solution
    const addLabel = inPreview ? "Use as my solution" : pos < solutionMoves.length ? `Replace my moves after move ${pos}` : "Add to my solution";
    // A pick that had to do earlier steps first says so in its title
    const heading = target !== "all" && result.parts.length > 1 ? `${result.parts[0].name} → ${title}` : title;
    renderSolverResult(solverResult, result, { title: heading, from: pos === 0 ? "from the scramble" : `after move ${pos}` }, {
      addLabel,
      show: () => showEngineMoves(from, result.text, `Engine's ${title}`),
      add: () => {
        // The next step gets picked next
        solverPicked = null;
        addMoves(from, result.text);
      },
    });
    // How long the engine took, unless the answer came from a run made earlier
    const finished = solveProgress(scr, from, method);
    const took = cached ? " (from an engine run made earlier)" : finished ? ` (${progressSummary(finished)})` : "";
    setSolverStatus(`Found ${title}: ${plural(result.moves, "move")}${took}.`, "ok");
  } catch (e) {
    // A typo in the moves, or the engine failing to load
    console.error("[puzzly]", e);
    setSolverStatus(`Couldn't find ${title}: ${e.message}`, "error");
  } finally {
    clearInterval(timer);
    solving = false;
    solverBtn.classList.remove("is-busy");
    updateSolver();
  }
}

// Find button
solverBtn.addEventListener("click", () => runSolver());

// ============ VIEW (2D / 3D) ============
// View buttons: flat net or 3D cube, fitted to the stage again for that view
document.querySelectorAll('input[name="view"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    view = radio.value;
    setView(view);
    fitCube();
  });
});

// ============ CUBE SIDE ============
// Puts the cube's column on the left or the right of the page (wide windows only: narrow ones keep it on top), and remembers it
function setSide(side) {
  document.querySelector(".app").classList.toggle("cube-right", side === "right");
  document.querySelector(`input[name="side"][value="${side}"]`).checked = true;
  remember("side", side);
}

// Side buttons
document.querySelectorAll('input[name="side"]').forEach((radio) => {
  radio.addEventListener("change", () => setSide(radio.value));
});

// ============ PUZZLE ============
// Puzzle buttons: set the hidden select and let its change listeners (here and in renderer.js) switch the puzzle
document.querySelectorAll('input[name="puzzle"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    puzzleSelector.value = radio.value;
    puzzleSelector.dispatchEvent(new Event("change"));
  });
});

// Another puzzle: a new scramble for it, the controls on or off, the review cleared, the cube fitted to the stage
puzzleSelector.addEventListener("change", () => {
  puzzleSelect(puzzleSelector.value);
  shown = null;
  showEmptyReview();
  newRandomScramble();
  showEngineState();
  updateSolver();
  fitCube();
});

// ============ START ============
// The puzzle, the cube on a solved state, an empty solution, and the view
puzzleSelect(puzzleSelector.value);
mountCube(container);
applyScramble("");
player.setSolution([]);
setView(view);
// Settings from last time: the cube's side, the tab and the fingertricks switch
setSide(recall("side") === "right" ? "right" : "left");
tricksToggle.checked = recall("tricks") !== "off";
showTricks(tricksToggle.checked);
selectTab(recall("tab") === "solver" ? "solver" : "review");
showMethodNote();
showEngineState();
showEmptyReview();
// Cube sized to the stage now, and again whenever the stage changes size
fitCube();
new ResizeObserver(fitCube).observe(container);
// A first scramble once the engine is in
newRandomScramble();

// Engine loaded: the status says so, and the steps of anything typed meanwhile are found
engineReady.then(
  () => {
    engineState = "ready";
    showEngineState();
    scheduleSplit();
    updateSolver();
  },
  (e) => {
    engineState = "failed";
    setStatus(`The solver engine failed to load: ${e.message}`, "error");
  },
);
