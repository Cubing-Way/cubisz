import { resetCube, restoreCubeState, cloneCubeState } from "./cube.js";
import { genRanState, scramble, printScrambleMoves } from "./scramble.js";

function resolveElement(target) {
  if (target instanceof HTMLElement) return target;
  if (typeof target === "string") return document.querySelector(target);
  return null;
}

function chooseCubeContainer(containerTarget, cubeTarget = "#cube-net") {
  const container = resolveElement(containerTarget);
  const cubeElement = resolveElement(cubeTarget);

  if (!container) {
    throw new Error("Container element was not found.");
  }

  if (!cubeElement) {
    throw new Error("Cube element was not found.");
  }

  container.appendChild(cubeElement);
  return cubeElement;
}

function setCubeView({
  cubeTarget = "#cube-net",
  stickerSize = 28,
  displayMode = "2d"
} = {}) {
  const cubeElement = resolveElement(cubeTarget);

  if (!cubeElement) {
    throw new Error("Cube element was not found.");
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

  return { stickerSize, displayMode: is3d ? "3d" : "2d" };
}

function scrambleCube({
  scrambleText = "",
  useRandom = false,
  shouldReset = true
} = {}) {
  const sequence = useRandom ? (genRanState(), scramble.trim()) : scrambleText.trim();

  printScrambleMoves(sequence, shouldReset);

  return {
    sequence,
    state: cloneCubeState()
  };
}

function solveCube({
  solutionText = "",
  restoreFromState = null,
  reset = false
} = {}) {
  if (restoreFromState) {
    restoreCubeState(restoreFromState);
  }

  if (reset) {
    resetCube();
    return { solved: true, mode: "reset" };
  }

  printScrambleMoves(solutionText.trim(), false);
  return {
    solved: solutionText.trim().length === 0,
    state: cloneCubeState()
  };
}

export {
  chooseCubeContainer,
  setCubeView,
  scrambleCube,
  solveCube
};
