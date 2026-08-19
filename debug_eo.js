import { cube, resetCube, cloneCubeState, restoreCubeState, U, D, R, L, F, B } from './cube.js';
import { applyScramble } from './api.js';
import { getAllEdges } from './cubieMapping.js';

const EDGE_ORDER = ['UF','UR','UB','UL','FR','FL','BL','BR','DF','DR','DB','DL'];
const EDGE_STICKERS = {
  UR: ['U5','R1'],
  UF: ['U7','F1'],
  UL: ['U3','L1'],
  UB: ['U1','B1'],
  DR: ['D5','R7'],
  DF: ['D1','F7'],
  DL: ['D3','L7'],
  DB: ['D7','B7'],
  FR: ['F5','R3'],
  FL: ['F3','L5'],
  BL: ['B5','L3'],
  BR: ['B3','R5']
};
const EDGE_PIECES = [
  ['W','R'], ['W','G'], ['W','O'], ['W','B'],
  ['Y','R'], ['Y','G'], ['Y','O'], ['Y','B'],
  ['G','R'], ['G','O'], ['B','O'], ['B','R']
];
const EDGE_NAMES = ['UR','UF','UL','UB','DR','DF','DL','DB','FR','FL','BL','BR'];

function getSticker(pos) {
  return cube[pos[0]][Number(pos[1])];
}
function samePieces(a,b) {
  return [...a].sort().join('') === [...b].sort().join('');
}
function identifyEdge(colors) {
  for (let i = 0; i < EDGE_PIECES.length; i++) {
    if (samePieces(colors, EDGE_PIECES[i])) return EDGE_NAMES[i];
  }
  return null;
}
function getEdgeOrientation(colors, pieceName) {
  if (colors.includes('W') || colors.includes('Y')) {
    const udIndex = colors.indexOf('W') !== -1 ? colors.indexOf('W') : colors.indexOf('Y');
    const stickerPos = EDGE_STICKERS[pieceName][udIndex];
    const face = stickerPos[0];
    return (face === 'U' || face === 'D') ? 0 : 1;
  }
  const fbIndex = colors.includes('G') ? colors.indexOf('G') : colors.indexOf('B');
  const stickerPos = EDGE_STICKERS[pieceName][fbIndex];
  const face = stickerPos[0];
  return (face === 'F' || face === 'B') ? 0 : 1;
}
function getEdgeState(edgeName) {
  const [posA, posB] = EDGE_STICKERS[edgeName];
  const colors = [getSticker(posA), getSticker(posB)];
  const piece = identifyEdge(colors);
  return { piece, orientation: getEdgeOrientation(colors, piece) };
}
function getBits() {
  return EDGE_ORDER.map(name => getEdgeState(name).orientation);
}
function getCoord() {
  return getBits().slice(0, 11).reduce((c, b) => ((c << 1) | b), 0);
}
function getEdgeByName(edges, name) {
  return edges.find(edge => edge.piece === name);
}
function getEdgeOrientations() {
  const edges = getAllEdges();
  return EDGE_ORDER.map(name => getEdgeByName(edges, name).orientation);
}
function getEdgeOrientationCoord() {
  const orientations = getEdgeOrientations();
  let coord = 0;
  for (let i = 0; i < 11; i++) {
    coord = (coord << 1) | orientations[i];
  }
  return coord;
}
function coordToBits(coord) {
  const bits = [];
  for (let i = 10; i >= 0; i--) bits.push((coord >> i) & 1);
  return bits;
}
function complete(bits) {
  const sum = bits.reduce((a, x) => a + x, 0);
  return [...bits, sum % 2];
}
function applyEO(coord) {
  resetCube();
  const ori = complete(coordToBits(coord));
  for (let i = 0; i < EDGE_ORDER.length; i++) {
    if (ori[i] === 1) {
      const [pa, pb] = EDGE_STICKERS[EDGE_ORDER[i]];
      const t = cube[pa[0]][Number(pa[1])];
      cube[pa[0]][Number(pa[1])] = cube[pb[0]][Number(pb[1])];
      cube[pb[0]][Number(pb[1])] = t;
    }
  }
}

resetCube();
applyScramble('F R U', true);
const scrambledBits = getBits();
const scrambledCoord = getEdgeOrientationCoord();
const coord = scrambledCoord;
console.log('cubieMapping getAllEdges', getAllEdges());
console.log('custom edge states', EDGE_ORDER.map(name => ({name, state: getEdgeState(name)})));
resetCube();
applyEO(coord);
const canonicalBits = getBits();
const scrambledBits11 = scrambledBits.slice(0, 11);
console.log('scrambledBits', scrambledBits);
console.log('scrambledBits11', scrambledBits11);
console.log('scrambledCoord', scrambledCoord);
console.log('scrambledComputed', scrambledBits11.reduce((c,b)=>((c<<1)|b),0));
console.log('canonicalBits', canonicalBits);
console.log('canonicalCoord', coord);
console.log('same?', JSON.stringify(scrambledBits) === JSON.stringify(canonicalBits));

resetCube();
applyEO(coord);
const before = getEdgeOrientationCoord();
F();
const afterCoord = getEdgeOrientationCoord();
console.log('before coord', before);
console.log('after coord', afterCoord);
