import { cube, resetCube, cloneCubeState, restoreCubeState } from "./cube.js";
import { genRanState, scramble, printScrambleMoves } from "./scramble.js";

let scrambledState = null;

const net = document.getElementById('cube-net');
let is3D = false;

document.getElementById('toggle-3d').addEventListener('click', () => {
  is3D = !is3D;

  if (is3D) {
    net.classList.add('cube3d');
  } else {
    net.classList.remove('cube3d');
    net.style.transform = 'none';
  }
});


function createGrid(containerId, squareClass) {
  let squaregrid = document.getElementById(containerId);
  for (let i = 0; i < 9; i++) {
    let square = document.createElement('div');
    square.className = 'square ' + squareClass;
    squaregrid.appendChild(square);
  }
}

createGrid('whiteSquareGrid', 'white-square');
createGrid('orangeSquareGrid', 'orange-square');
createGrid('greenSquareGrid', 'green-square');
createGrid('redSquareGrid', 'red-square');
createGrid('blueSquareGrid', 'blue-square');
createGrid('yellowSquareGrid', 'yellow-square');

let blueSquares = document.querySelectorAll('#blueSquareGrid .blue-square');
let redSquares = document.querySelectorAll('#redSquareGrid .red-square');
let yellowSquares = document.querySelectorAll('#yellowSquareGrid .yellow-square');
let greenSquares = document.querySelectorAll('#greenSquareGrid .green-square');
let whiteSquares = document.querySelectorAll('#whiteSquareGrid .white-square');  
let orangeSquares = document.querySelectorAll('#orangeSquareGrid .orange-square'); 

const facesToSquares = {
  U: whiteSquares,
  R: redSquares,
  F: greenSquares,
  D: yellowSquares,
  L: orangeSquares,
  B: blueSquares
};

function paintCubeFromStickers() {
  const colorMap = {
    W: 'white',
    R: 'red',
    G: 'green',
    Y: 'yellow',
    O: 'orange',
    B: 'blue'
  };

  for (const face in cube) {
    const squares = facesToSquares[face];

    for (let i = 0; i < 9; i++) {
      const color = colorMap[cube[face][i]];
      squares[i].className = `square ${color}-square`;
    }
  }
}

function resizeCube(stickerSize) {
  const stickerGap = Math.round(stickerSize * 0.08);
  const facePadding = stickerGap;

  // Resize every face grid
  document.querySelectorAll('.grid').forEach(grid => {
    grid.style.gridTemplateColumns = `repeat(3, ${stickerSize}px)`;
    grid.style.gap = `${stickerGap}px`;
    grid.style.padding = `${facePadding}px`;
  });

  // Resize every sticker
  document.querySelectorAll('.square').forEach(square => {
    square.style.width = `${stickerSize}px`;
    square.style.height = `${stickerSize}px`;
  });
}
resizeCube(28); // try 20, 25, 35, 50, etc


document.getElementById("custom-scramble").addEventListener("input", (event) => {
  const customScramble = event.target.value.trim();
  printScrambleMoves(customScramble, true);
});

document.getElementById("scramble-btn").addEventListener("click", () => {
  genRanState();
  document.getElementById('custom-scramble').value = scramble;
  printScrambleMoves(scramble);
  scrambledState = cloneCubeState();
});

document.getElementById("solve-btn").addEventListener("click", () => {
  resetCube();
  paintCubeFromStickers();
  document.getElementById('custom-scramble').value = "";
});

document.getElementById('custom-solve').addEventListener('input', (event) => {
  const customSolution = event.target.value.trim();

  restoreCubeState(scrambledState);
  printScrambleMoves(customSolution, false);
});


genRanState();
document.getElementById('custom-scramble').value = scramble;
printScrambleMoves(scramble);
scrambledState = cloneCubeState();   // ← THIS WAS MISSING



export {
  createGrid,
  paintCubeFromStickers
};
