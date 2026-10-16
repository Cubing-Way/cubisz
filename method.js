// The method cubisz's Solve button and evaluation use, picked by name from every method cubisz knows

// puzzly's example methods (the same list as its test bench)
import EXAMPLES from "puzzly/src/demo/example-methods.json";

// Every .json file in methods/: one method each (puzzly's Export file) or a list of them (like puzzly's examples)
const FILES = import.meta.glob("./methods/*.json", { eager: true, import: "default" });

// Your files' methods first (in file name order), then puzzly's examples, so yours win on a name clash
export const METHODS = [
  ...Object.keys(FILES).sort().flatMap((path) => (Array.isArray(FILES[path]) ? FILES[path] : [FILES[path]])),
  ...EXAMPLES,
];

// Which method to use: the start of its name (the first match wins)
const PICK = "CFOP level 2";

// The picked method, or a clear error listing every name when nothing matches
export const METHOD = METHODS.find((method) => method.name.startsWith(PICK));
if (!METHOD) throw new Error(`No method starts with "${PICK}". Names: ${METHODS.map((method) => method.name).join(" / ")}`);