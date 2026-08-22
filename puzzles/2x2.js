const cube = { //2x2 faces (already done)
  U: Array(4).fill('W'),
  R: Array(4).fill('R'),
  F: Array(4).fill('G'),
  D: Array(4).fill('Y'),
  L: Array(4).fill('O'),
  B: Array(4).fill('B')
};

function rotateFaceCW(face) {
  [face[0], face[1], face[2], face[3]] =
  [face[2], face[0], face[3], face[1]];
}

function x2x2() {
  R2x2();
  L2x2(); L2x2(); L2x2(); // L'
}

function y2x2() {
  U2x2();
  D2x2(); D2x2(); D2x2(); // D'
}

function z2x2() {
  F2x2();
  B2x2(); B2x2(); B2x2(); // B'
}

function reset2x2() {
  cube.U.fill('W');
  cube.R.fill('R');
  cube.F.fill('G');
  cube.D.fill('Y');
  cube.L.fill('O');
  cube.B.fill('B');
}


function clone2x2State() {
  return {
    U: [...cube.U],
    R: [...cube.R],
    F: [...cube.F],
    D: [...cube.D],
    L: [...cube.L],
    B: [...cube.B],
  };
}

function restore2x2State(state) {
  cube.U = [...state.U];
  cube.R = [...state.R];
  cube.F = [...state.F];
  cube.D = [...state.D];
  cube.L = [...state.L];
  cube.B = [...state.B];
}


function U2x2() {
  rotateFaceCW(cube.U);

  const f0 = cube.F[0], f1 = cube.F[1];
  const r0 = cube.R[0], r1 = cube.R[1];
  const b0 = cube.B[0], b1 = cube.B[1];
  const l0 = cube.L[0], l1 = cube.L[1];

  // F → R → B → L → F
  cube.R[0] = b0;
  cube.R[1] = b1;

  cube.B[0] = l0;
  cube.B[1] = l1;

  cube.L[0] = f0;
  cube.L[1] = f1;

  cube.F[0] = r0;
  cube.F[1] = r1;
}

function D2x2() {
  rotateFaceCW(cube.D);

  const f2 = cube.F[2], f3 = cube.F[3];
  const r2 = cube.R[2], r3 = cube.R[3];
  const b2 = cube.B[2], b3 = cube.B[3];
  const l2 = cube.L[2], l3 = cube.L[3];

  // F → R → B → L → F
  cube.R[2] = f2;
  cube.R[3] = f3;

  cube.B[2] = r2;
  cube.B[3] = r3;

  cube.L[2] = b2;
  cube.L[3] = b3;

  cube.F[2] = l2;
  cube.F[3] = l3;
}

function R2x2() {
  rotateFaceCW(cube.R);

  const u1 = cube.U[1], u3 = cube.U[3];
  const f1 = cube.F[1], f3 = cube.F[3];
  const d1 = cube.D[1], d3 = cube.D[3];

  // B's left side is reversed relative to U/D
  const b2 = cube.B[2], b0 = cube.B[0];

  // U → B → D → F → U
  cube.B[2] = u1;
  cube.B[0] = u3;

  cube.D[1] = b2;
  cube.D[3] = b0;

  cube.F[1] = d1;
  cube.F[3] = d3;

  cube.U[1] = f1;
  cube.U[3] = f3;
}

function L2x2() {
  rotateFaceCW(cube.L);

  const u0 = cube.U[0], u2 = cube.U[2];
  const f0 = cube.F[0], f2 = cube.F[2];
  const d0 = cube.D[0], d2 = cube.D[2];

  // B's right side is reversed
  const b3 = cube.B[3], b1 = cube.B[1];

  cube.F[0] = u0;
  cube.F[2] = u2;

  cube.D[0] = f0;
  cube.D[2] = f2;

  cube.B[3] = d0;
  cube.B[1] = d2;

  cube.U[0] = b3;
  cube.U[2] = b1;
}

function F2x2() {
  rotateFaceCW(cube.F);

  const u2 = cube.U[2], u3 = cube.U[3];
  const r0 = cube.R[0], r2 = cube.R[2];
  const d1 = cube.D[1], d0 = cube.D[0];
  const l3 = cube.L[3], l1 = cube.L[1];

  cube.R[0] = u2;
  cube.R[2] = u3;

  cube.D[1] = r0;
  cube.D[0] = r2;

  cube.L[3] = d1;
  cube.L[1] = d0;

  cube.U[2] = l3;
  cube.U[3] = l1;
}

function B2x2() {
  rotateFaceCW(cube.B);

  const u0 = cube.U[0], u1 = cube.U[1];
  const r1 = cube.R[1], r3 = cube.R[3];
  const d3 = cube.D[3], d2 = cube.D[2];
  const l0 = cube.L[0], l2 = cube.L[2];

  cube.U[0] = r1;
  cube.U[1] = r3;

  cube.R[1] = d3;
  cube.R[3] = d2;

  cube.D[2] = l0;
  cube.D[3] = l2;

  cube.L[0] = u1;
  cube.L[2] = u0;
}

function is2x2Solved() {
  for (const face in cube) {
    const first = cube[face][0];
    for (let i = 1; i < 4; i++) {
      if (cube[face][i] !== first) {
        return false;
      }
    }
  }
  return true;
}

const cube2x2 = cube;

export {
  cube2x2,
  reset2x2,
  clone2x2State,
  restore2x2State,
  is2x2Solved,
  U2x2, D2x2, R2x2, L2x2, F2x2, B2x2, x2x2, y2x2, z2x2
};