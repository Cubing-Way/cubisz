import { cube, resetCube, restoreCubeState, cloneCubeState, U, D, R, L, F, B, x, y, z } from "./cube.js";

const moveFunctions = {
  U,
  "U'": () => { U(); U(); U(); },
  U2: () => { U(); U(); },
  D,
  "D'": () => { D(); D(); D(); },
  D2: () => { D(); D(); },
  R,
  "R'": () => { R(); R(); R(); },
  R2: () => { R(); R(); },
  L,
  "L'": () => { L(); L(); L(); },
  L2: () => { L(); L(); },
  F,
  "F'": () => { F(); F(); F(); },
  F2: () => { F(); F(); },
  B,
  "B'": () => { B(); B(); B(); },
  B2: () => { B(); B(); },
  x,
  "x'": () => { x(); x(); x(); },
  x2: () => { x(); x(); },
  y,
  "y'": () => { y(); y(); y(); },
  y2: () => { y(); y(); },
  z,
  "z'": () => { z(); z(); z(); },
  z2: () => { z(); z(); }
};

function hasDOM() {
  return typeof document !== "undefined";
}

function isHTMLElement(value) {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function resolveElement(target) {
  if (!hasDOM()) return null;
  if (isHTMLElement(target)) return target;
  if (typeof target === "string") return document.querySelector(target);
  return null;
}

function chooseCubeContainer(containerTarget, cubeTarget = "#cube-net") {
  const container = resolveElement(containerTarget);
  const cubeElement = resolveElement(cubeTarget);

  if (!container) {
    throw new Error("Container element was not found (or DOM is unavailable).");
  }

  if (!cubeElement) {
    throw new Error("Cube element was not found (or DOM is unavailable).");
  }

  container.appendChild(cubeElement);
  return cubeElement;
}

function setCubeView({ cubeTarget = "#cube-net", stickerSize = 28, displayMode = "2d" } = {}) {
  const cubeElement = resolveElement(cubeTarget);

  if (!cubeElement) {
    return { stickerSize, displayMode, domApplied: false };
  }

  const is3d = displayMode === "3d";
  cubeElement.classList.toggle("cube3d", is3d);

  if (!is3d) {
    cubeElement.style.transform = "none";
  }

  const stickerGap = Math.round(stickerSize * 0.08);
  const facePadding = stickerGap;

  cubeElement.querySelectorAll(".grid").forEach((grid) => {
    grid.style.gridTemplateColumns = `repeat(3, ${stickerSize}px)`;
    grid.style.gap = `${stickerGap}px`;
    grid.style.padding = `${facePadding}px`;
  });

  cubeElement.querySelectorAll(".square").forEach((square) => {
    square.style.width = `${stickerSize}px`;
    square.style.height = `${stickerSize}px`;
  });

  return { stickerSize, displayMode: is3d ? "3d" : "2d", domApplied: true };
}

function runMoves(sequence = "", shouldReset = true, onAfterMoves = null) {
  if (shouldReset) {
    resetCube();
  }

  sequence
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((move) => {
      const func = moveFunctions[move];
      if (func) func();
    });

  if (typeof onAfterMoves === "function") {
    onAfterMoves(cube);
  }
}

function generateRandomScramble(length = 20) {
  const moves1 = ["U", "D"];
  const moves2 = ["L", "R"];
  const moves3 = ["F", "B"];
  const moves = [...moves1, ...moves2, ...moves3];
  const modifiers = ["", "'", "2"];

  let result = "";
  let lastMove = null;
  let lastMoveGroup = null;
  let secondLastMoveGroup = null;

  for (let i = 0; i < length; i++) {
    let move;
    let moveGroup;

    do {
      move = moves[Math.floor(Math.random() * moves.length)];
      if (moves1.includes(move)) moveGroup = 1;
      else if (moves2.includes(move)) moveGroup = 2;
      else moveGroup = 3;
    } while (move === lastMove || (moveGroup === lastMoveGroup && moveGroup === secondLastMoveGroup));

    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    result += `${move}${modifier} `;

    lastMove = move;
    secondLastMoveGroup = lastMoveGroup;
    lastMoveGroup = moveGroup;
  }

  return result.trim();
}

function scrambleCube({ scrambleText = "", useRandom = false, shouldReset = true, randomLength = 20, onAfterMoves = null } = {}) {
  const sequence = useRandom ? generateRandomScramble(randomLength) : scrambleText.trim();
  runMoves(sequence, shouldReset, onAfterMoves);

  return {
    sequence,
    state: cloneCubeState()
  };
}

function solveCube({ solutionText = "", restoreFromState = null, reset = false, onAfterMoves = null } = {}) {
  if (restoreFromState) {
    restoreCubeState(restoreFromState);
  }

  if (reset) {
    resetCube();
    if (typeof onAfterMoves === "function") onAfterMoves(cube);
    return { solved: true, mode: "reset", state: cloneCubeState() };
  }

  runMoves(solutionText, false, onAfterMoves);

  return {
    solved: solutionText.trim().length === 0,
    state: cloneCubeState()
  };
}

export { chooseCubeContainer, setCubeView, scrambleCube, solveCube, generateRandomScramble };
