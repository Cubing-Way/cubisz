import {
  cube2x2,
  reset2x2,
  clone2x2State,
  restore2x2State,
  is2x2Solved,
  U2x2, D2x2, R2x2, L2x2, F2x2, B2x2,
  x2x2, y2x2, z2x2
} from "./2x2.js";

import {
  cube3x3,
  reset3x3,
  clone3x3State,
  restore3x3State,
  is3x3Solved,
  U3x3, D3x3, R3x3, L3x3, F3x3, B3x3,
  x3x3, y3x3, z3x3,
  M3x3, E3x3, S3x3
} from "./3x3.js";

let
  cube,
  resetCube,
  cloneCubeState,
  restoreCubeState,
  isSolved,
  U, D, R, L, F, B,
  x, y, z,
  M, E, S;


/**
 * Selects which cube implementation to use.
 *
 * @param {"2x2" | "3x3"} puzzle
 */
function selectPuzzle(puzzle) {
  if (puzzle === "2x2Opt") {
    cube = cube2x2;
    resetCube = reset2x2;
    cloneCubeState = clone2x2State;
    restoreCubeState = restore2x2State;
    isSolved = is2x2Solved;

    U = U2x2;
    D = D2x2;
    R = R2x2;
    L = L2x2;
    F = F2x2;
    B = B2x2;

    x = x2x2;
    y = y2x2;
    z = z2x2;

    M = undefined;
    E = undefined;
    S = undefined;

  } else if (puzzle === "3x3Opt") {
    cube = cube3x3;
    resetCube = reset3x3;
    cloneCubeState = clone3x3State;
    restoreCubeState = restore3x3State;
    isSolved = is3x3Solved;

    U = U3x3;
    D = D3x3;
    R = R3x3;
    L = L3x3;
    F = F3x3;
    B = B3x3;

    x = x3x3;
    y = y3x3;
    z = z3x3;

    M = M3x3;
    E = E3x3;
    S = S3x3;

  } else {
    throw new Error(`Unknown puzzle: ${puzzle}`);
  }
}





export {
  selectPuzzle,

  cube,
  resetCube,
  cloneCubeState,
  restoreCubeState,
  isSolved,

  U, D, R, L, F, B,
  x, y, z,
  M, E, S
};
