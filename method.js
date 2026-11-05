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

// A method's FMC version has this at the start of its name
const FMC_PREFIX = "FMC: ";

// FMC versions made so far, by method, so a method always gets the same one
const fmcVersions = new Map();

// A method's FMC version: the same steps, each picking its answer by fewest moves instead of speed (a step's lookahead then counts moves too)
export function fmcMethod(method) {
  if (!fmcVersions.has(method)) {
    // Avoided faces only make a step faster to turn, so they go; alg sets stay, as a human solves those steps
    const steps = method.steps.map((step) => ({ ...step, rank: "moves", avoid: "" }));
    fmcVersions.set(method, { ...method, name: `${FMC_PREFIX}${method.name}`, steps });
  }
  return fmcVersions.get(method);
}

// Whether a method is an FMC version
export function isFmc(method) {
  return method.name.startsWith(FMC_PREFIX);
}

// Whether a method's runs go to the solve server: every one but Search fastest, which takes minutes a run, past the server's 120 s a request
export function onServer(method) {
  return !keepingFor(method);
}

// Whether a method's steps each map onto one stretch of a typed solution (BLD and repeated steps don't), so it can review solves and solve single steps
export function reviewable(data) {
  return !data.steps.some((step) => step.buffer || step.untouched || step.repeat);
}

// The methods other apps can pick: reviewable, and not the ones that search for the fastest solve, since a review with those takes minutes
export const APP_METHODS = METHODS.filter((method) => reviewable(method) && !keepingFor(method));