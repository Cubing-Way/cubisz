import { cube, resetCube } from "./puzzles/cube.js";
import {printScrambleMoves} from "./scramble.js";

const CORNER_STICKERS = [
  ['U8', 'R0', 'F2'], // URF
  ['U6', 'F0', 'L2'], // UFL
  ['U0', 'L0', 'B2'], // ULB
  ['U2', 'B0', 'R2'], // UBR

  ['D2', 'F8', 'R6'], // DFR
  ['D0', 'L8', 'F6'], // DLF
  ['D6', 'B8', 'L6'], // DBL
  ['D8', 'R8', 'B6']  // DRB
];

const EDGE_STICKERS = [
  ['U5', 'R1'], // UR
  ['U7', 'F1'], // UF
  ['U3', 'L1'], // UL
  ['U1', 'B1'], // UB

  ['D5', 'R7'], // DR
  ['D1', 'F7'], // DF
  ['D3', 'L7'], // DL
  ['D7', 'B7'], // DB

  ['F5', 'R3'], // FR
  ['F3', 'L5'], // FL
  ['B5', 'L3'], // BL
  ['B3', 'R5']  // BR
];

function getSticker(pos) {
  const face = pos[0];
  const index = Number(pos[1]);

  return cube[face][index];
}

function readCorner(index) {
  return CORNER_STICKERS[index].map(getSticker);
}

function readEdge(index) {
  return EDGE_STICKERS[index].map(getSticker);
}

const CORNER_PIECES = [
  ['W', 'R', 'G'], // URF
  ['W', 'G', 'O'], // UFL
  ['W', 'O', 'B'], // ULB
  ['W', 'B', 'R'], // UBR

  ['Y', 'G', 'R'], // DFR
  ['Y', 'O', 'G'], // DLF
  ['Y', 'B', 'O'], // DBL
  ['Y', 'R', 'B']  // DRB
];

const EDGE_PIECES = [
  ['W', 'R'], // UR
  ['W', 'G'], // UF
  ['W', 'O'], // UL
  ['W', 'B'], // UB

  ['Y', 'R'], // DR
  ['Y', 'G'], // DF
  ['Y', 'O'], // DL
  ['Y', 'B'], // DB

  ['G', 'R'], // FR
  ['G', 'O'], // FL
  ['B', 'O'], // BL
  ['B', 'R']  // BR
];

const CORNER_NAMES = [
  'URF',
  'UFL',
  'ULB',
  'UBR',
  'DFR',
  'DLF',
  'DBL',
  'DRB'
];

function samePieces(a, b) {
  return [...a].sort().join('') ===
         [...b].sort().join('');
}

function identifyCorner(colors) {

  for (let i = 0; i < CORNER_PIECES.length; i++) {

    if (samePieces(colors, CORNER_PIECES[i])) {
      return CORNER_NAMES[i];
    }

  }

  return null;
}

function getCornerOrientation(colors) {

  for (let i = 0; i < 3; i++) {

    if (
      colors[i] === 'W' ||
      colors[i] === 'Y'
    ) {
      return i;
    }

  }

  return -1;
}

function getCornerState(index) {

  const colors = readCorner(index);

  return {
    piece: identifyCorner(colors),
    orientation: getCornerOrientation(colors)
  };
}

function getAllCorners() {

  return CORNER_STICKERS.map((_, i) =>
    getCornerState(i)
  );

}

const EDGE_NAMES = [
  'UR',
  'UF',
  'UL',
  'UB',

  'DR',
  'DF',
  'DL',
  'DB',

  'FR',
  'FL',
  'BL',
  'BR'
];

function identifyEdge(colors, positions) {

  for (let i = 0; i < EDGE_PIECES.length; i++) {

    if (samePieces(colors, EDGE_PIECES[i])) {
      return EDGE_NAMES[i];
    }

  }

  console.warn(
    'Failed to identify edge:',
    {
      colors,
      positions
    }
  );

  return null;
}

function getEdgeOrientation(colors, piece, index) {

  const slotFaces =
    EDGE_STICKERS[index]
      .map(pos => pos[0]);

  // ========================
  // UD edges
  // ========================

  if (
    ['UR','UF','UL','UB',
     'DR','DF','DL','DB']
    .includes(piece)
  ) {

    // find where the W/Y sticker is
    const referenceColor =
      colors.includes('W') ? 'W' : 'Y';

    // find which sticker of the CUBIE that is
    const cubieStickerIndex =
      EDGE_PIECES[
        EDGE_NAMES.indexOf(piece)
      ].indexOf(referenceColor);

    // where that sticker currently sits
    const currentFace =
      slotFaces[cubieStickerIndex];

    return (
      currentFace === 'U' ||
      currentFace === 'D'
    ) ? 0 : 1;
  }

  // ========================
  // Slice edges
  // ========================

  const referenceColor =
    colors.includes('G') ? 'G' : 'B';

  const cubieStickerIndex =
    EDGE_PIECES[
      EDGE_NAMES.indexOf(piece)
    ].indexOf(referenceColor);

  const currentFace =
    slotFaces[cubieStickerIndex];

  return (
    currentFace === 'U' ||
    currentFace === 'D'
  ) ? 1 : 0;
}
function getEdgeState(index) {

  const colors = readEdge(index);

  const piece = identifyEdge(
    colors,
    EDGE_STICKERS[index]
  );

  if (!piece) {
    return {
      piece: null,
      orientation: -1
    };
  }

  return {
    piece,
    orientation:
      getEdgeOrientation(
        colors,
        piece,
        index
      )
  };
}

function getAllEdges() {

  return EDGE_STICKERS.map((_, i) =>
    getEdgeState(i)
  );

}

function isPhase1Solved(state = cube) {

  const corners = getAllCorners(state);
  const edges = getAllEdges(state);

  for (const c of corners) {
    if (c.orientation !== 0) return false;
  }

  for (const e of edges) {
    if (e.orientation !== 0) return false;
  }

  const slice = [8, 9, 10, 11];

  for (const i of slice) {
    const piece = edges[i].piece;
    if (!['FR', 'FL', 'BL', 'BR'].includes(piece)) return false;
  }

  return true;
}

const PHASE1_SLICE = new Set(['FR', 'FL', 'BR', 'BL']);

function countWrongSliceEdges() {
  const edges = getAllEdges();

  let bad = 0;

  for (const e of edges) {
    if (!e.piece) continue;

    // middle layer edges must be in slice
    if (['FR','FL','BR','BL'].includes(e.piece)) continue;

    // if a non-slice edge is in slice positions OR vice versa
    if (PHASE1_SLICE.has(e.piece)) {
      bad++;
    }
  }

  return bad;
}

function countPhase1Misoriented() {
  const corners = getAllCorners();
  const edges = getAllEdges();

  let bad = 0;

  for (const c of corners) {
    if (c.orientation !== 0) bad++;
  }

  for (const e of edges) {
    if (e.orientation !== 0) bad++;
  }

  return bad;
}

export {
  isPhase1Solved,
  readCorner,
  readEdge,
  getAllCorners,
  getAllEdges,
  countPhase1Misoriented,
  countWrongSliceEdges
};