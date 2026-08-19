import { cube } from "./cube.js"

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

function injectCubeCSS() {
  if (document.getElementById("cubisz-css")) return;

  const link = document.createElement("link");
  link.id = "cubisz-css";
  link.rel = "stylesheet";
  link.href = new URL("../style.css", import.meta.url).href;

  document.head.appendChild(link);
}

function createFace(face) {
  const grid = document.getElementById(faceGridIds[face]);
  if (!grid) return null;

  grid.innerHTML = "";

  for (let i = 0; i < 9; i++) {
    const square = document.createElement("div");
    square.className = `square ${faceClasses[face]}`;
    grid.appendChild(square);
  }

  return grid;
}

function paintCube() {
  for (const face of Object.keys(faceGridIds)) {
    const squares = document.querySelectorAll(`#${faceGridIds[face]} .square`);

    for (let i = 0; i < 9; i++) {
      const color = colorMap[cube[face][i]];
      squares[i].className = `square ${color}-square`;
    }
  }
}

function resize(size) {
  const gap = Math.max(2, Math.round(size * 0.18));
  const padding = Math.max(2, gap);

  document.documentElement.style.setProperty("--sticker-size", `${size}px`);
  document.documentElement.style.setProperty("--sticker-gap", `${gap}px`);
  document.documentElement.style.setProperty("--face-padding", `${padding}px`);

  const depth = (size * 3) + (gap * 2) + (padding * 2);
  document.documentElement.style.setProperty("--cube-depth", `${depth / 2}px`);

  document.querySelectorAll(".grid").forEach((grid) => {
    grid.style.gridTemplateColumns = `repeat(3, ${size}px)`;
    grid.style.gap = `${gap}px`;
    grid.style.padding = `${padding}px`;
  });

  document.querySelectorAll(".square").forEach((square) => {
    square.style.width = `${size}px`;
    square.style.height = `${size}px`;
  });
}

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

function set3D(enabled) {
  const net = document.getElementById("cube-net");
  if (net) net.classList.toggle("cube3d", enabled);
}

export { paintCube, mountRenderer, resize, set3D }
