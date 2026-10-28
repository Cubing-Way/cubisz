// The methods cubisz's method picker offers (Solve and evaluation use the picked one), the one it starts on, and which ones use Search fastest

// puzzly's example methods (the same list as its test bench)
import EXAMPLES from "puzzly/src/demo/example-methods.json";

// Every .json file in methods/: one method each (puzzly's Export file) or a list of them (like puzzly's examples)
const FILES = import.meta.glob("./methods/*.json", { eager: true, import: "default" });

// Your files' methods first (in file name order), then puzzly's examples; a name already listed is skipped, so yours win on a name clash
export const METHODS = [
  ...Object.keys(FILES).sort().flatMap((path) => (Array.isArray(FILES[path]) ? FILES[path] : [FILES[path]])),
  ...EXAMPLES,
].filter((method, index, all) => all.findIndex((other) => other.name === method.name) === index);

// Which method the picker starts on: the start of its name (the first match wins)
const PICK = "CFOP level 3 (human: any easy XCross, lookahead 1, 4 extra moves)";

// The picked method, or a clear error listing every name when nothing matches
export const METHOD = METHODS.find((method) => method.name.startsWith(PICK));
if (!METHOD) throw new Error(`No method starts with "${PICK}". Names: ${METHODS.map((method) => method.name).join(" / ")}`);

// Methods whose name starts with this use puzzly's Search fastest (slow, so the picker warns about them); every other method gets a plain run
const FASTEST_PREFIX = "Computer fastest";

// How the engine solves those methods (Solve and evaluation): puzzly's Search fastest keeping this many partial solves per pieces done (slow)
export const FASTEST_KEEPING = 8;

// Partial solves Search fastest keeps for a method: FASTEST_KEEPING for the "Computer fastest" methods, 0 (a plain run) for every other one
export function keepingFor(method) {
  return method.name.startsWith(FASTEST_PREFIX) ? FASTEST_KEEPING : 0;
}

// Whether a method's runs go to the solve server: every method but the ones expected to run past its 120 s a request (Search fastest takes minutes a
// run), which solve in the page
export function onServer(method) {
  return !keepingFor(method);
}