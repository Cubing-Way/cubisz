const cube = {
  U: Array(9).fill('W'),
  R: Array(9).fill('R'),
  F: Array(9).fill('G'),
  D: Array(9).fill('Y'),
  L: Array(9).fill('O'),
  B: Array(9).fill('B')
};

function rotateFaceCW(face) {
  [face[0], face[1], face[2],
   face[3], face[4], face[5],
   face[6], face[7], face[8]] =
  [face[6], face[3], face[0],
   face[7], face[4], face[1],
   face[8], face[5], face[2]];
}

function rotateFaceCCW(face) {
  rotateFaceCW(face);
  rotateFaceCW(face);
  rotateFaceCW(face);
}

function M() {
  const u1 = cube.U[1], u4 = cube.U[4], u7 = cube.U[7];
  const f1 = cube.F[1], f4 = cube.F[4], f7 = cube.F[7];
  const d1 = cube.D[1], d4 = cube.D[4], d7 = cube.D[7];
  const b7 = cube.B[7], b4 = cube.B[4], b1 = cube.B[1];

  cube.F[1] = u1; cube.F[4] = u4; cube.F[7] = u7;
  cube.D[1] = f1; cube.D[4] = f4; cube.D[7] = f7;
  cube.B[7] = d1; cube.B[4] = d4; cube.B[1] = d7;
  cube.U[1] = b7; cube.U[4] = b4; cube.U[7] = b1;
}

function E() {
  const f3 = cube.F[3], f4 = cube.F[4], f5 = cube.F[5];
  const r3 = cube.R[3], r4 = cube.R[4], r5 = cube.R[5];
  const b3 = cube.B[3], b4 = cube.B[4], b5 = cube.B[5];
  const l3 = cube.L[3], l4 = cube.L[4], l5 = cube.L[5];

  cube.R[3] = f3; cube.R[4] = f4; cube.R[5] = f5;
  cube.B[3] = r3; cube.B[4] = r4; cube.B[5] = r5;
  cube.L[3] = b3; cube.L[4] = b4; cube.L[5] = b5;
  cube.F[3] = l3; cube.F[4] = l4; cube.F[5] = l5;
}

function S() {
  const u3 = cube.U[3], u4 = cube.U[4], u5 = cube.U[5];
  const r1 = cube.R[1], r4 = cube.R[4], r7 = cube.R[7];
  const d5 = cube.D[5], d4 = cube.D[4], d3 = cube.D[3];
  const l7 = cube.L[7], l4 = cube.L[4], l1 = cube.L[1];

  cube.R[1] = u3; cube.R[4] = u4; cube.R[7] = u5;
  cube.D[5] = r1; cube.D[4] = r4; cube.D[3] = r7;
  cube.L[7] = d5; cube.L[4] = d4; cube.L[1] = d3;
  cube.U[3] = l7; cube.U[4] = l4; cube.U[5] = l1;
}

function x() {
  R();
  M(); M(); M(); // M'
  L(); L(); L(); // L'
}

function y() {
  U();
  E(); E(); E(); // E'
  D(); D(); D(); // D'
}

function z() {
  F();
  S();
  B(); B(); B(); // B'
}




function resetCube() {
  cube.U.fill('W');
  cube.R.fill('R');
  cube.F.fill('G');
  cube.D.fill('Y');
  cube.L.fill('O');
  cube.B.fill('B');
}


function cloneCubeState() {
  return {
    U: [...cube.U],
    R: [...cube.R],
    F: [...cube.F],
    D: [...cube.D],
    L: [...cube.L],
    B: [...cube.B],
  };
}

function restoreCubeState(state) {
  cube.U = [...state.U];
  cube.R = [...state.R];
  cube.F = [...state.F];
  cube.D = [...state.D];
  cube.L = [...state.L];
  cube.B = [...state.B];
}


/* YOUR MOVE FUNCTIONS (U, D, R, L, F, B) STAY HERE EXACTLY AS THEY ARE */
function U() {
  rotateFaceCW(cube.U);

  const f0 = cube.F[0], f1 = cube.F[1], f2 = cube.F[2];
  const r0 = cube.R[0], r1 = cube.R[1], r2 = cube.R[2];
  const b0 = cube.B[0], b1 = cube.B[1], b2 = cube.B[2];
  const l0 = cube.L[0], l1 = cube.L[1], l2 = cube.L[2];

  cube.F[0] = r0; cube.F[1] = r1; cube.F[2] = r2;
  cube.R[0] = b0; cube.R[1] = b1; cube.R[2] = b2;
  cube.B[0] = l0; cube.B[1] = l1; cube.B[2] = l2;
  cube.L[0] = f0; cube.L[1] = f1; cube.L[2] = f2;
}

function D() {
  rotateFaceCW(cube.D);

  // Snapshot
  const f6 = cube.F[6], f7 = cube.F[7], f8 = cube.F[8];
  const r6 = cube.R[6], r7 = cube.R[7], r8 = cube.R[8];
  const b6 = cube.B[6], b7 = cube.B[7], b8 = cube.B[8];
  const l6 = cube.L[6], l7 = cube.L[7], l8 = cube.L[8];

  // Cycle: F → R → B → L → F
  cube.R[6] = f6; cube.R[7] = f7; cube.R[8] = f8;
  cube.B[6] = r6; cube.B[7] = r7; cube.B[8] = r8;
  cube.L[6] = b6; cube.L[7] = b7; cube.L[8] = b8;
  cube.F[6] = l6; cube.F[7] = l7; cube.F[8] = l8;
}

function R() {
  rotateFaceCW(cube.R);

  // Snapshot
  const u2 = cube.U[2], u5 = cube.U[5], u8 = cube.U[8];
  const f2 = cube.F[2], f5 = cube.F[5], f8 = cube.F[8];
  const d2 = cube.D[2], d5 = cube.D[5], d8 = cube.D[8];
  const b6 = cube.B[6], b3 = cube.B[3], b0 = cube.B[0];

  // Correct R cycle: U → B → D → F → U
  cube.B[6] = u2; cube.B[3] = u5; cube.B[0] = u8;
  cube.D[2] = b6; cube.D[5] = b3; cube.D[8] = b0;
  cube.F[2] = d2; cube.F[5] = d5; cube.F[8] = d8;
  cube.U[2] = f2; cube.U[5] = f5; cube.U[8] = f8;
}

function L() {
  rotateFaceCW(cube.L);

  const u0 = cube.U[0], u3 = cube.U[3], u6 = cube.U[6];
  const f0 = cube.F[0], f3 = cube.F[3], f6 = cube.F[6];
  const d0 = cube.D[0], d3 = cube.D[3], d6 = cube.D[6];
  const b8 = cube.B[8], b5 = cube.B[5], b2 = cube.B[2];

  cube.F[0] = u0; cube.F[3] = u3; cube.F[6] = u6;
  cube.D[0] = f0; cube.D[3] = f3; cube.D[6] = f6;
  cube.B[8] = d0; cube.B[5] = d3; cube.B[2] = d6;
  cube.U[0] = b8; cube.U[3] = b5; cube.U[6] = b2;
}

function F() {
  rotateFaceCW(cube.F);

  const u6 = cube.U[6], u7 = cube.U[7], u8 = cube.U[8];
  const r0 = cube.R[0], r3 = cube.R[3], r6 = cube.R[6];
  const d2 = cube.D[2], d1 = cube.D[1], d0 = cube.D[0];
  const l8 = cube.L[8], l5 = cube.L[5], l2 = cube.L[2];

  cube.R[0] = u6; cube.R[3] = u7; cube.R[6] = u8;
  cube.D[2] = r0; cube.D[1] = r3; cube.D[0] = r6;
  cube.L[8] = d2; cube.L[5] = d1; cube.L[2] = d0;
  cube.U[6] = l8; cube.U[7] = l5; cube.U[8] = l2;
}

function B() {
  rotateFaceCW(cube.B);

  const u0 = cube.U[0], u1 = cube.U[1], u2 = cube.U[2];
  const r2 = cube.R[2], r5 = cube.R[5], r8 = cube.R[8];
  const d8 = cube.D[8], d7 = cube.D[7], d6 = cube.D[6];
  const l0 = cube.L[0], l3 = cube.L[3], l6 = cube.L[6];

  cube.U[0] = r2; cube.U[1] = r5; cube.U[2] = r8;
  cube.R[2] = d8; cube.R[5] = d7; cube.R[8] = d6;
  cube.D[6] = l0; cube.D[7] = l3; cube.D[8] = l6;
  cube.L[0] = u2; cube.L[3] = u1; cube.L[6] = u0;
}

export {
  cube,
  resetCube,
  cloneCubeState,
  restoreCubeState,
  U, D, R, L, F, B, x, y, z
};