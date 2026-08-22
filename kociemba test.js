import { cube, U, D, R, L, F, B, M, E, S, resetCube, cloneCubeState, restoreCubeState } from "./puzzles/cube.js";
import {isPhase1Solved, countPhase1Misoriented, countWrongSliceEdges, getAllEdges, getAllCorners} from "./cubieMapping.js";
import { applyScramble } from "./api.js";
import { scramble } from "./scramble.js";

const MOVES = [
  'U', "U'", 'U2',
  'D', "D'", 'D2',
  'R', "R'", 'R2',
  'L', "L'", 'L2',
  'F', "F'", 'F2',
  'B', "B'", 'B2'
];

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

function applyMove(move) {
  moveFunctions[move]();
}

function testMoves() {

  const solutions = [];

const orderedMoves = getOrderedMoves();

for (const move of orderedMoves) {

    const state = cloneCubeState();

    applyMove(move);

    if (isPhase1Solved()) {
      solutions.push(move);
    }

    restoreCubeState(state);

  }

  return solutions;
}

function testTwoMoves() {

  const solutions = [];

  for (const move1 of MOVES) {

    const state1 = cloneCubeState();

    applyMove(move1);

    for (const move2 of MOVES) {

      if (move1[0] === move2[0]) continue;

      const state2 = cloneCubeState();

      applyMove(move2);

      if (isPhase1Solved()) {
        solutions.push([move1, move2]);
      }

      restoreCubeState(state2);

    }

    restoreCubeState(state1);

  }

  console.log(solutions);
  return solutions;
}

function findTwoMoveSolution() {

  for (const move1 of MOVES) {

    const state1 = cloneCubeState();
    applyMove(move1);

    for (const move2 of MOVES) {

      if (move1[0] === move2[0]) continue;

      const state2 = cloneCubeState();
      applyMove(move2);

      if (isPhase1Solved()) {
        return [move1, move2];
      }

      restoreCubeState(state2);
    }

    restoreCubeState(state1);
  }

  return null;
}

const inverseMove = {
  "U": "U'",
  "U'": "U",
  "U2": "U2",

  "D": "D'",
  "D'": "D",
  "D2": "D2",

  "R": "R'",
  "R'": "R",
  "R2": "R2",

  "L": "L'",
  "L'": "L",
  "L2": "L2",

  "F": "F'",
  "F'": "F",
  "F2": "F2",

  "B": "B'",
  "B'": "B",
  "B2": "B2"
};

function undoMove(move) {
  moveFunctions[inverseMove[move]]();
}

const MOVE_GROUP = {
  U: 1, D: 1,
  L: 2, R: 2,
  F: 3, B: 3
};

function solvePhase1(maxDepth = 100) {

  if (isPhase1Solved()) return [];

  for (let d = 1; d <= maxDepth; d++) {

    const result = findAtDepth(d);

    if (result) {
      console.log("Solved at depth:", d);
      console.log("Solution:", result);
      return result;
    }
  }

  console.log("No solution found up to depth", maxDepth);
  return null;
}

function getFace(move) {
  return move[0]; // U, D, L, R, F, B
}

function heuristicPhase1() {
  return (
    countPhase1Misoriented() +
    countWrongSliceEdges()
  );
}

let nodesVisited = 0;

function findAtDepth(
  depth,
  sequence = [],
  lastFace = null,
  lastGroup = null,
  groupStreak = 0,
  indent = ""
) {
  const h = edgeOrientationHeuristic();
console.log(
  "depth:", depth,
  "heuristic:", h,
  "sequence:", sequence.join(" ")
);
  // ❌ silent prune (no logging)
if (h > depth) return null;

  if (depth === 0) {
    const solved = isPhase1Solved();
    if (solved) {
      console.log(`${indent}✔ SOLVED: ${sequence.join(" ")}`);
      return sequence;
    }
    return null;
  }

  for (const move of getOrderedMoves()) {
    const face = move[0];
    const group = MOVE_GROUP[move];

    if (face === lastFace) continue;
    if (group === lastGroup && groupStreak === 2) continue;

    // 🔥 ONLY log real explored branches
    console.log(`${indent}→ ${move} | seq=[${sequence.join(" ")}] | h=${h}`);

    applyMove(move);

    const result = findAtDepth(
      depth - 1,
      [...sequence, move],
      face,
      group,
      group === lastGroup ? groupStreak + 1 : 1,
      indent + "  "
    );

    if (result) return result;

    undoMove(move);
  }

  return null;
}

function scoreMove(move) {
  const state = cloneCubeState();

  const before = heuristicPhase1();

  applyMove(move);
  const after = heuristicPhase1();

  restoreCubeState(state);

  return after - before; // negative = good move
}

function getOrderedMoves() {
  const scored = MOVES.map(move => ({
    move,
    score: scoreMove(move)
  }));

  scored.sort((a, b) => a.score - b.score);

  return scored.map(x => x.move);
}

function getEdgeOrientationCoord() {
  const orientations = getEdgeOrientations();

  let coord = 0;

  for (let i = 0; i < 11; i++) {
    coord <<= 1;
    coord |= orientations[i];
  }

  return coord;
}

function coordToBits(coord) {
  const bits = [];

  for (let i = 10; i >= 0; i--) {
    bits.push((coord >> i) & 1);
  }

  return bits;
}

function completeEdgeOrientations(bits11) {
  const sum = bits11.reduce((a, b) => a + b, 0);

  const lastBit = sum % 2;

  return [...bits11, lastBit];
}

function coordToEdgeOrientations(coord) {
  const bits11 = coordToBits(coord);
  return completeEdgeOrientations(bits11);
}

const EDGE_ORDER = [
  "UF", "UR", "UB", "UL",
  "FR", "FL", "BL", "BR",
  "DF", "DR", "DB", "DL"
];

function getEdgeByName(edges, name) {
  return edges.find(edge => edge.piece === name);
}

function getEdgeOrientations() {
  const edges = getAllEdges();

  return EDGE_ORDER.map(name => {
    return getEdgeByName(edges, name).orientation;
  });
}

function testEO(coord) {
  const orientations = coordToEdgeOrientations(coord);

  let rebuilt = 0;

  for (let i = 0; i < 11; i++) {
    rebuilt <<= 1;
    rebuilt |= orientations[i];
  }

  return rebuilt === coord;
}

const edgeOrientMoveTable = {};

const EDGE_STICKERS = {
  UR: ['U5', 'R1'],
  UF: ['U7', 'F1'],
  UL: ['U3', 'L1'],
  UB: ['U1', 'B1'],
  DR: ['D5', 'R7'],
  DF: ['D1', 'F7'],
  DL: ['D3', 'L7'],
  DB: ['D7', 'B7'],
  FR: ['F5', 'R3'],
  FL: ['F3', 'L5'],
  BL: ['B5', 'L3'],
  BR: ['B3', 'R5']
};

function swapStickers(posA, posB) {
  const faceA = posA[0];
  const idxA = Number(posA[1]);
  const faceB = posB[0];
  const idxB = Number(posB[1]);
  const tmp = cube[faceA][idxA];
  cube[faceA][idxA] = cube[faceB][idxB];
  cube[faceB][idxB] = tmp;
}

function applyEOToCubeSafe(coord) {
  resetCube();
  const orientations = coordToEdgeOrientations(coord);

  for (let i = 0; i < EDGE_ORDER.length; i++) {
    if (orientations[i] === 1) {
      const edgeName = EDGE_ORDER[i];
      const [posA, posB] = EDGE_STICKERS[edgeName];
      swapStickers(posA, posB);
    }
  }
}

for (let coord = 0; coord < 2048; coord++) {
  edgeOrientMoveTable[coord] = {};
}

function recordEOMove(coord, move) {
  resetCube();

  applyEOToCubeSafe(coord);

  applyMove(move);

  const newCoord = getEdgeOrientationCoord();

  if (!edgeOrientMoveTable[coord]) {
    edgeOrientMoveTable[coord] = {};
  }

  edgeOrientMoveTable[coord][move] = newCoord;
}

resetCube();

const before = getEdgeOrientationCoord();

applyMove("R");

const after = getEdgeOrientationCoord();

console.log(before, after, before === after);

const eoStateCache = new Map();

function generateEOMoveTable() {

  // initialize table
  for (let coord = 0; coord < 2048; coord++) {
    edgeOrientMoveTable[coord] = {};
  }

  resetCube();

  const solvedState = cloneCubeState();
  const solvedEO = getEdgeOrientationCoord();

  const queue = [{
    state: solvedState,
    eo: solvedEO
  }];

  eoStateCache.set(solvedEO, solvedState);

  while (queue.length > 0) {

    const { state, eo } = queue.shift();

    restoreCubeState(state);

    for (const move of MOVES) {

      const beforeMove = cloneCubeState();

      applyMove(move);

      const nextEO = getEdgeOrientationCoord();

      // record transition
      edgeOrientMoveTable[eo][move] = nextEO;

      // first time discovering this EO
      if (!eoStateCache.has(nextEO)) {

        const discoveredState = cloneCubeState();

        eoStateCache.set(nextEO, discoveredState);

        queue.push({
          state: discoveredState,
          eo: nextEO
        });
      }

      restoreCubeState(beforeMove);
    }
  }

  console.log(
    "EO states discovered:",
    eoStateCache.size
  );
}
function applyMoveToBits(bits, move) {
  // temporary placeholder: we compute via cube once
  resetCube();

  injectBitsIntoCube(bits);

  applyMove(move);

  return getEdgeOrientations();
}

function bitsToCoord(bits) {
  let coord = 0;

  for (let i = 0; i < 11; i++) {
    coord = (coord << 1) | bits[i];
  }

  return coord;
}

function setEOFromBits(bits) {
  const edges = getAllEdges();

  for (let i = 0; i < edges.length; i++) {
    edges[i].orientation = bits[i];
  }
}


function setEdgeOrientationCoord(coord) {
  return coordToEdgeOrientations(coord);
}

function countFlippedEdges() {
  return getEdgeOrientations()
    .filter(x => x === 1)
    .length;
}

function edgeOrientationHeuristic() {
  return Math.ceil(
    countFlippedEdges() / 4
  );
}

function buildEOPruningTable() {
  const eoPrune = new Array(2048).fill(-1);
  const queue = [0];

  eoPrune[0] = 0;

  while (queue.length > 0) {
    const current = queue.shift();

    for (const move of MOVES) {
      const next = edgeOrientMoveTable[current][move];

      if (eoPrune[next] !== -1) continue;

      eoPrune[next] = eoPrune[current] + 1;
      queue.push(next);
    }
  }

  return eoPrune;
}



generateEOMoveTable();
const eoPrune = buildEOPruningTable();
resetCube();
applyScramble("F R U", true);

const start = getEdgeOrientationCoord();

const state = cloneCubeState();

applyMove("F");
const mid = getEdgeOrientationCoord();

restoreCubeState(state);

console.log("start:", start);
console.log("table:", edgeOrientMoveTable[start]["F"]);
console.log("actual mid:", mid);
console.log(
  "match:",
  edgeOrientMoveTable[start]["F"] === mid
)


resetCube();
applyScramble("L", true);

const solution = solvePhase1(100);
console.log("RESULT:", solution);