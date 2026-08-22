import { cube } from "./puzzles/cube.js";

const colorMap = {
  W: "white",
  R: "red",
  G: "green",
  Y: "yellow",
  O: "orange",
  B: "blue"
};

const faceGridIds = {
  U: "whiteSquareGrid",
  L: "orangeSquareGrid",
  F: "greenSquareGrid",
  R: "redSquareGrid",
  B: "blueSquareGrid",
  D: "yellowSquareGrid"
};

const faceClasses = {
  U: "white-square",
  L: "orange-square",
  F: "green-square",
  R: "red-square",
  B: "blue-square",
  D: "yellow-square"
};


/**
 * Get the currently selected puzzle.
 */
function getPuzzleSize() {
  const selector = document.getElementById("select-puzzle");

  if (!selector) {
    return 3;
  }

  return selector.value === "2x2Opt" ? 2 : 3;
}


/**
 * Inject cube CSS.
 */
function injectCubeCSS() {
  if (document.getElementById("cubisz-css")) return;

  const link = document.createElement("link");

  link.id = "cubisz-css";
  link.rel = "stylesheet";
  link.href = new URL("../style.css", import.meta.url).href;

  document.head.appendChild(link);
}


function createFace(face) {
  console.log(
  "[CREATE FACE]",
  face,
  "puzzle size:",
  getPuzzleSize()
);

  const grid = document.getElementById(faceGridIds[face]);

  if (!grid) return null;

  grid.innerHTML = "";

  const size = getPuzzleSize();
  const stickerCount = size * size;

  grid.style.gridTemplateColumns =
    `repeat(${size}, var(--sticker-size))`;

  grid.style.gridTemplateRows =
    `repeat(${size}, var(--sticker-size))`;

  for (let i = 0; i < stickerCount; i++) {
    const square = document.createElement("div");

    square.className = `square ${faceClasses[face]}`;

    grid.appendChild(square);
  }

  return grid;
}



/**
 * Paint the cube according to its current state.
 */
function paintCube() {
  const size = getPuzzleSize();
  const stickerCount = size * size;

  for (const face of Object.keys(faceGridIds)) {
    const squares = document.querySelectorAll(
      `#${faceGridIds[face]} .square`
    );

    const stickers = cube[face];

    if (!stickers) continue;

    for (let i = 0; i < stickerCount; i++) {
      const color = colorMap[stickers[i]];

      if (!squares[i]) continue;

      squares[i].className = `square ${color}-square`;
    }
  }
}


/**
 * Resize the cube renderer.
 */
function resize(size) {
  console.log(
  "[RESIZE]",
  "size:",
  size,
  "puzzle:",
  getPuzzleSize()
);

  const puzzleSize = getPuzzleSize();

  const gap = Math.max(
    2,
    Math.round(size * 0.18)
  );

  const padding = Math.max(2, gap);

  document.documentElement.style.setProperty(
    "--sticker-size",
    `${size}px`
  );

  document.documentElement.style.setProperty(
    "--sticker-gap",
    `${gap}px`
  );

  document.documentElement.style.setProperty(
    "--face-padding",
    `${padding}px`
  );

  /*
   * Calculate the size of one face.

   * 3x3:
   *   3 stickers + 2 gaps
   *
   * 2x2:
   *   2 stickers + 1 gap
   */
  const faceSize =
    (size * puzzleSize) +
    (gap * (puzzleSize - 1)) +
    (padding * 2);

  const depth = faceSize / 2;

  document.documentElement.style.setProperty(
    "--cube-depth",
    `${depth}px`
  );

document.querySelectorAll(".grid").forEach((grid) => {
  grid.style.gridTemplateColumns =
    `repeat(${puzzleSize}, ${size}px)`;

  grid.style.gridTemplateRows =
    `repeat(${puzzleSize}, ${size}px)`;

  grid.style.gap = `${gap}px`;

  grid.style.padding = `${padding}px`;
});

  document.querySelectorAll(".square").forEach((square) => {
    square.style.width = `${size}px`;
    square.style.height = `${size}px`;
  });
}


/**
 * Mount the cube renderer.
 */
async function mountRenderer(container) {
  injectCubeCSS();

  container.innerHTML = `
    <div id="cube-net">
      <div class="page-center">
        <div class="grid-container">

          <div id="whiteSquareGrid" class="grid"></div>

          <div id="orangeSquareGrid" class="grid"></div>

          <div id="greenSquareGrid" class="grid"></div>

          <div id="redSquareGrid" class="grid"></div>

          <div id="blueSquareGrid" class="grid"></div>

          <div id="yellowSquareGrid" class="grid"></div>

        </div>
      </div>
    </div>
  `;

  for (const face of Object.keys(faceGridIds)) {
    createFace(face);
  }

  paintCube();
}


/**
 * Rebuild the renderer when the puzzle changes.
 *
 * Call this when switching between 2x2 and 3x3.
 */
function updateRenderer() {
  const size = getPuzzleSize();

  for (const face of Object.keys(faceGridIds)) {
    createFace(face);
  }

  paintCube();

  /*
   * Reapply the current sticker size.
   */
  const currentSize =
    parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--sticker-size")
    ) || 40;

  resize(currentSize);
}


/**
 * Enable/disable 3D mode.
 */
function set3D(enabled) {
  const net = document.getElementById("cube-net");

  if (net) {
    net.classList.toggle("cube3d", enabled);
  }
}


/*
 * Automatically adapt the renderer when the
 * puzzle selector changes.
 */
const puzzleSelector =
  document.getElementById("select-puzzle");

if (puzzleSelector) {
  puzzleSelector.addEventListener("change", () => {
    console.log(
      "[SELECTOR CHANGED]",
      puzzleSelector.value
    );

    updateRenderer();
  });
}



export {
  paintCube,
  mountRenderer,
  resize,
  set3D,
  updateRenderer
};
