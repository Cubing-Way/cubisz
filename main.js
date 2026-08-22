import {
  mountCube,
  setSize,
  setView,
  applyScramble,
  applySolution,
  setFMC,
  puzzleSelect
} from "./api.js";

import { genRanState, scramble } from "./scramble.js";
const container = document.getElementById("cube-wrapper");

// Read the puzzle selector.
const puzzleSelector = document.getElementById("select-puzzle");

if (!puzzleSelector) {
  throw new Error('Could not find element with id "select-puzzle".');
}

const scrambleInput = document.getElementById("custom-scramble");
const fmcToggle = document.getElementById("fmc-toggle");
let currentScramble = '';

// Initial selection
puzzleSelect(puzzleSelector.value);
newRandomScramble();
mountCube(container);
setSize(28);
setView("2d");

// ============ 3D toggle ============
let is3D = false;
document.getElementById('toggle-3d').addEventListener('click', () => {
  is3D = !is3D;
  setView(is3D ? "3d" : "2d");
});

// ============ SCRAMBLE INPUT (LIVE) ============
function newRandomScramble() {
  genRanState();
  currentScramble = scramble;
  scrambleInput.value = scramble;
  applyScramble(scramble);
}

// Live typing → same as before
scrambleInput.addEventListener("input", (e) => {
  currentScramble = e.target.value.trim();
  applyScramble(currentScramble);
  solveInput.value = ""; // Clear solution after scramble is applied
});

// FMC toggle
fmcToggle.addEventListener("change", (e) => {
  setFMC(e.target.checked);
  applyScramble(currentScramble);
});

// Scramble button → same as before
document.getElementById("scramble-btn").addEventListener("click", () => {
  newRandomScramble();
});

// ============ SOLVE INPUT (LIVE) ============
const solveInput = document.getElementById("custom-solve");

solveInput.addEventListener("input", (e) => {
  applySolution(e.target.value.trim());
});

// Solve button clears solution like before
document.getElementById("solve-btn").addEventListener("click", () => {
  solveInput.value = "";
});

// Change implementation whenever the user changes the selector
puzzleSelector.addEventListener("change", () => {
  puzzleSelect(puzzleSelector.value);
  newRandomScramble();
});