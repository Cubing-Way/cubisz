import { resetCube, U, D, R, L, F, B, M, E, S, y, x, z } from "./cube.js";

let scramble = '';
let _moveCount = 0;
let _isFMC = false;

function isFMC() {
  return _isFMC;
}

function setFMC(value) {
  _isFMC = Boolean(value);
}

function genRanState() {
  const moves1 = ['U', 'D'];
  const moves2 = ['L', 'R'];
  const moves3 = ['F', 'B'];
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

  console.log(scramble)
}

function getMoveCount() {
  return _moveCount;
}


function printScrambleMoves(scr, shouldReset = true) {
  const displayedScramble = scr;
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
    "B2": () => { B(); B(); },
    "M": M,
    "M'": () => { M(); M(); M(); },
    "M2": () => { M(); M(); },
    "E": E,
    "E'": () => { E(); E(); E(); },
    "E2": () => { E(); E(); },
    "S": S,
    "S'": () => { S(); S(); S(); },
    "S2": () => { S(); S(); },
    "Rw": () => { R(); M(); M(); M(); },
    "Rw'": () => { R(); R(); R(); M(); },
    "Rw2": () => { R(); R(); M(); M(); },
    "Lw": () => { L(); M(); },
    "Lw'": () => { L(); L(); L(); M(); M(); M(); },
    "Lw2": () => { L(); L(); M(); M(); },
    "Uw": () => { U(); E(); E(); E(); },
    "Uw'": () => { U(); U(); U(); E(); },
    "Uw2": () => { U(); U(); E(); E(); },
    "Dw": () => { D(); E(); },
    "Dw'": () => { D(); D(); D(); E(); E(); E(); },
    "Dw2": () => { D(); D(); E(); E(); },
    "Fw": () => { F(); S(); S(); S(); },
    "Fw'": () => { S(); F(); F(); F(); },
    "Fw2": () => { F(); F(); S(); S(); },
    "Bw": () => { B(); S(); },
    "Bw'": () => { S(); S(); S(); B(); B(); B(); },
    "Bw2": () => { B(); B(); S(); S(); },
    "y": y,
    "y'": () => { y(); y(); y(); },
    "y2": () => { y(); y(); },
    "x": x,
    "x'": () => { x(); x(); x(); },
    "x2": () => { x(); x(); },
    "z": z,
    "z'": () => { z(); z(); z(); },
    "z2": () => { z(); z(); }
  };

  if (shouldReset) resetCube();

  _moveCount = 0;

  moves.forEach(move => {
    if (_isFMC && ["M", "M'", "M2", "E", "E'", "E2", "S", "S'", "S2"].includes(move)) return;
    const func = moveFunctions[move];
    if (func) {
      func();
      if (!["y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2"].includes(move)) _moveCount++;   // count only valid moves
    }
  });

}

export {
  scramble,
  getMoveCount,
  genRanState,
  printScrambleMoves,
  isFMC,
  setFMC
};
