import {
  mountCube,
  setSize,
  setView,
  applyScramble,
  applySolution,
  setFMC
} from "./api.js";



import { genRanState, scramble } from "./scramble.js";
import "./cubieMapping.js"; // Ensure cube state is initialized
import "./kociemba test.js"; // Ensure solver is initialized
import { isPhase1Solved } from "./cubieMapping.js"; // Ensure cube state is initialized
const container = document.getElementById("cube-wrapper");

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

const scrambleInput = document.getElementById("custom-scramble");
const fmcToggle = document.getElementById("fmc-toggle");
let currentScramble = '';

function newRandomScramble() {
  genRanState();
  currentScramble = scramble;
  scrambleInput.value = scramble;
  applyScramble(scramble);
}

// On page load → same as before
newRandomScramble();

// Live typing → same as before
scrambleInput.addEventListener("input", (e) => {
  currentScramble = e.target.value.trim();
  applyScramble(currentScramble);
  solveInput.value = ""; // Clear solution after scramble is applied
  console.log("Phase 1 Solved?", isPhase1Solved());
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

  console.log("Phase 1 Solved?", isPhase1Solved());