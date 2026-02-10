import { resetCube, U, D, R, L, F, B } from "./cube.js";
import { paintCubeFromStickers } from "./main.js";

let scramble = '';

function generateWcaScramble() {
  const moves1 = ['U', 'D'];
  const moves2 = ['L', 'R'];
  const moves3 = ['F'];
  const moves = moves1.concat(moves2, moves3);
  const modifiers = ['', "'", '2'];

  scramble = '';

  let lastMove = null;
  let lastMoveGroup = null;
  let secondLastMoveGroup = null;
  let secondLastMove = null;

  for (let i = 0; i < 20 + Math.floor(Math.random() * 3); i++) {
    let move;
    let moveGroup;
    do {
      move = moves[Math.floor(Math.random() * moves.length)];
      if (moves1.includes(move)) moveGroup = 1;
      else if (moves2.includes(move)) moveGroup = 2;
      else if (moves3.includes(move)) moveGroup = 3;
    } while (move === lastMove || (moveGroup === lastMoveGroup && moveGroup === secondLastMoveGroup));

    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble += `${move}${modifier} `;

    secondLastMove = lastMove;
    lastMove = move;
    secondLastMoveGroup = lastMoveGroup;
    lastMoveGroup = moveGroup;
  }
}

function printScrambleMoves() {
  const displayedScramble = document.getElementById('scramble').textContent;
  const moves = displayedScramble.split(' ');

  const moveFunctions = {
    "U": U,
    "U'": () => { U(); U(); U(); },
    "U2": () => { U(); U(); },
    "D": D,
    "D'": () => { D(); D(); D(); },
    "D2": () => { D(); D(); },
    "R": R,
    "R'": () => { R(); R(); R(); },
    "R2": () => { R(); R(); },
    "L": L,
    "L'": () => { L(); L(); L(); },
    "L2": () => { L(); L(); },
    "F": F,
    "F'": () => { F(); F(); F(); },
    "F2": () => { F(); F(); },
    "B": B,
    "B'": () => { B(); B(); B(); },
    "B2": () => { B(); B(); }
  };

  resetCube();

  moves.forEach(move => {
    const func = moveFunctions[move];
    if (func) func();
  });

  paintCubeFromStickers();
}

export {
  scramble,
  generateWcaScramble,
  printScrambleMoves
};
