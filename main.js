import { cube } from "./cube.js";
import { generateWcaScramble, scramble, printScrambleMoves } from "./scramble.js";

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

generateWcaScramble();
document.getElementById('scramble').textContent = scramble;
printScrambleMoves();

export {
  createGrid,
  paintCubeFromStickers
};
