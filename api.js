// api.js
import { cloneCubeState, restoreCubeState, isSolved, selectPuzzle } from "./puzzles/cube.js";
import { printScrambleMoves, getMoveCount, isFMC, setFMC } from "./scramble.js";
import { mountRenderer, paintCube, resize, set3D } from "./renderer.js";
let scrambledState = null;

async function mountCube(div) {
  await mountRenderer(div);
  paintCube();
}

function setSize(px) {
  resize(px);
}

function setView(mode) {
  set3D(mode === "3d");
}

function applyScramble(scr, skipPaint = false) {
  printScrambleMoves(scr, true);
  if (!skipPaint) paintCube();
  scrambledState = cloneCubeState();
}

function applySolution(sol, skipPaint = false) {
  restoreCubeState(scrambledState);
  printScrambleMoves(sol, false);
  if (!skipPaint) paintCube();
}

function getLastMoveCount() {
  return getMoveCount();
}

function checkSolved() {
  return isSolved();
}

function puzzleSelect(puzzle) {
  selectPuzzle(puzzle);
}


export { 
  mountCube, 
  setSize, 
  setView, 
  applyScramble, 
  applySolution, 
  getLastMoveCount, 
  checkSolved, 
  setFMC, 
  puzzleSelect
}