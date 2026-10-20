// Solve review, the page side: draws a review (summary, stats, a race against the engine's own solve, one card per step), the step solver's answer, and moves as chips
// with their fingertricks; what's shown comes from evaluate.js
import { rated, setupSign, scoreEvaluation, plural, engineLine } from "./evaluate.js";

// ============ SMALL HELPERS ============
// A new element with a class and text (both optional)
function el(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

// A button with an icon path and a label, calling onClick
function button(label, onClick, { kind = "", icon = "" } = {}) {
  const element = el("button", `btn btn-sm ${kind}`.trim());
  element.type = "button";
  // Optional line icon before the label
  if (icon) element.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg>`;
  element.append(label);
  element.addEventListener("click", onClick);
  return element;
}

// Icon paths shared by the review's buttons: play, eye (show on cube), plus (add), a fork (branch) and a turn back (undo)
const ICON = {
  play: "M7 4.5v15l12-7.5z",
  show: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  add: "M12 5v14M5 12h14",
  branch: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-1",
};

// A number with its sign (+2, -1.5, 0)
function signed(value, digits = 0) {
  const text = value.toFixed(digits);
  return value > 0 ? `+${text}` : text;
}

// A share as a whole percentage ("—" when there's none)
function percent(value) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

// Seconds as "7.68 s", or "1:02.50" from a minute up
function clock(seconds) {
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, "0")}`;
}

// Names in a sentence: "A", "A and B", "A, B and C"
function list(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// A method's name without its note in brackets
export function methodName(name) {
  return name.replace(/\s*\(.*\)\s*$/, "");
}

// The note in brackets after a method's name ("" = none)
export function methodNote(name) {
  return name.match(/\((.*)\)\s*$/)?.[1] ?? "";
}

// A step's color on the timeline and its card: one of eight, by its place in the method
export function stepColor(index) {
  return `var(--step-${index % 8})`;
}

// ============ FINGERTRICKS ============
// Short words for the fingers puzzly names
const SHORT_FINGER = { index: "index", middle: "mid", ring: "ring", pinky: "pinky", thumb: "thumb" };

// Where a regrip puts the hand, in a cuber's words
const REGRIP_TO = { up: "thumb up", home: "home", down: "thumb down" };

// A move's fingertrick in a few characters: "R wrist", "L index", "R index+mid", "L index push", "rotate", "no trick"
export function fingerLabel(step) {
  if (step.finger === "rotation") return "rotate";
  if (step.finger === "tilt") return "tilt";
  if (!step.hand) return "no trick";
  const hand = step.hand === "right" ? "R" : "L";
  if (step.finger === "wrist") return `${hand} wrist`;
  // The fingers, shortened, and whether the finger pushes
  const push = step.finger.endsWith(" push");
  const fingers = step.finger.replace(/ push$/, "").split(" + ").map((finger) => SHORT_FINGER[finger] ?? finger).join("+");
  return `${hand} ${fingers}${push ? " push" : ""}`;
}

// A move's fingertrick in a sentence, with the other ways to make it, for its tooltip
export function fingerTitle(step) {
  const who = !step.hand
    ? step.finger === "rotation" ? "cube rotation (both hands)" : step.finger === "tilt" ? "both wrists tilt the cube" : "no finger trick makes this move"
    : step.finger === "wrist" ? `${step.hand} hand, wrist turn` : `${step.hand} ${step.finger}`;
  const regrips = step.regrips.map((regrip) => `${regrip.hand} hand regrips first (${REGRIP_TO[regrip.to]})`);
  const others = step.others.length ? `Also possible: ${step.others.slice(0, 3).map((way) => `${way.hand} ${way.finger}`).join(", ")}` : "";
  return [`${step.move}: ${who}`, ...regrips, others].filter(Boolean).join("\n");
}

// A regrip before a move, as a small marker
function regripChip(regrip) {
  const chip = el("span", `regrip ${regrip.hand}`);
  chip.title = `${regrip.hand === "right" ? "Right" : "Left"} hand regrips: ${REGRIP_TO[regrip.to]}`;
  chip.append(el("b", "", "↻"), el("small", "", `${regrip.hand === "right" ? "R" : "L"} ${REGRIP_TO[regrip.to]}`));
  return chip;
}

// Moves as chips, each with its fingertrick under it and a line in its hand's color, regrips between them; at = the position in the player of the
// first move (each chip is marked with the position after it, so the one just played can light up), track = which moves those positions count
// ("yours", or "engine" for the engine's own solve), onMove(i) = the chip of move i was clicked
export function movesView(fingering, { at = null, track = "yours", onMove = null } = {}) {
  const view = el("div", "moves-view");
  if (!fingering || !fingering.steps.length) {
    view.append(el("span", "moves-empty", "no moves"));
    return view;
  }
  fingering.steps.forEach((step, index) => {
    // Regrips before the move
    for (const regrip of step.regrips) view.append(regripChip(regrip));
    // The move: its notation, and its fingertrick under it
    const chip = el("span", `mv ${step.hand ?? "none"}${step.finger === "other" ? " no-trick" : ""}`);
    chip.append(el("b", "", step.move), el("small", "", fingerLabel(step)));
    chip.title = fingerTitle(step);
    // Position after this move in the player, for highlighting and clicking, and the moves it counts in
    if (at !== null) {
      chip.dataset.at = String(at + index + 1);
      chip.dataset.track = track;
    }
    if (onMove) {
      chip.classList.add("is-clickable");
      chip.addEventListener("click", () => onMove(index));
    }
    view.append(chip);
  });
  return view;
}

// Lights up the chip of the move just played in a review or solver panel: pos = the player's position, track = the moves on show ("yours", "engine"
// for the engine's own solve, or "" for neither)
export function highlightMoves(root, pos, track = "yours") {
  for (const chip of root.querySelectorAll(".mv[data-at]")) chip.classList.toggle("is-current", chip.dataset.track === track && Number(chip.dataset.at) === pos);
}

// Count and effort of some moves, e.g. "6 moves · 5.5 effort"
function figures(figs) {
  return `${plural(figs.moves, "move")} · ${figs.speed.toFixed(1)} effort`;
}

// ============ NOTICES ============
// A notice in a panel: a title, a line of text (always there, so a busy notice can update it), numbered items, and optional buttons
// (used for the empty, busy and error states)
export function renderNotice(container, { title, text = "", tone = "", items = [], buttons = [] }) {
  const box = el("div", `notice ${tone}`.trim());
  // Spinner while busy
  if (tone === "busy") box.append(el("span", "spinner"));
  box.append(el("h3", "", title), el("p", "", text));
  // Numbered items, e.g. how to start
  if (items.length) {
    const steps = el("ol", "notice-steps");
    steps.append(...items.map((item) => el("li", "", item)));
    box.append(steps);
  }
  if (buttons.length) {
    const row = el("div", "notice-actions");
    row.append(...buttons.map(({ label, onClick, kind }) => button(label, onClick, { kind })));
    box.append(row);
  }
  container.replaceChildren(box);
  return box;
}

// ============ VERDICTS ============
// Effort (or seconds) as words for a verdict: "0.42 s" with your pace, "1.3 effort" without
function amount(value, pace) {
  return pace ? `${Math.abs(value / pace.execution).toFixed(2)} s` : `${Math.abs(value).toFixed(1)} effort`;
}

// A step's verdict against the engine, counting what it left for the next steps: tone ("better", "even", "warn", "worse") and a short text
function verdict(step, pace) {
  if (!rated(step)) return null;
  const net = step.net.speed;
  if (step.yours.text === step.engine.text) return { tone: "even", text: "Same as engine" };
  if (net <= -0.5) return { tone: "better", text: `Better · ${amount(net, pace)}` };
  if (net < 0.5) return { tone: "even", text: "On par" };
  return { tone: net < 2.5 ? "warn" : "worse", text: `Slower · ${amount(net, pace)}` };
}

// What the verdict counts beyond the step's own moves, in a sentence or two (lookahead: set-ups, harder rests, later steps solved too)
function stepNote(step, pace) {
  const notes = [];
  if (step.alsoSolved.length) notes.push(`Your moves also finished ${list(step.alsoSolved)}.`);
  const own = step.yours.speed - step.engine.speed;
  const sign = setupSign(step);
  // Set the rest up: slower (or as fast) alone, better with what follows
  if (sign > 0) notes.push(`On its own it's ${own > 0 ? `${amount(own, pace)} slower than` : "as fast as"} the engine's pick, but it leaves ${amount(step.setup.speed, pace)} less to do in the steps after.`);
  // Left the rest harder
  if (sign < 0) notes.push(`${own < 0 ? `It's ${amount(own, pace)} faster on its own, but it` : "It"} leaves the steps after ${amount(step.setup.speed, pace)} harder than the engine's pick does.`);
  return notes.join(" ");
}

// The verdict on all your step choices together: the summed net, as a headline and a tone
function overall(rating, pace) {
  if (!rating.steps) return { tone: "", text: "—" };
  const net = rating.netSpeed;
  if (Math.abs(net) < 0.5) return { tone: "even", text: "On par" };
  if (net < 0) return { tone: "better", text: `${amount(net, pace)} faster` };
  return { tone: net < 2.5 ? "warn" : "worse", text: `${amount(net, pace)} slower` };
}

// ============ REVIEW PARTS ============
// A summary tile: a small label, a big value (tinted by tone) and a note under it
function tile(label, value, note, tone = "") {
  const box = el("div", "tile");
  box.append(el("div", "tile-label", label), el("div", `tile-value ${tone}`.trim(), value), el("div", "tile-note", note));
  return box;
}

// A small stat: label, value and note, with a tooltip saying what it counts
function stat(label, value, note, title) {
  const box = el("div", "stat");
  box.title = title;
  box.append(el("span", "stat-label", label), el("b", "stat-value", value), el("span", "stat-note", note));
  return box;
}

// A small segmented picker (radio buttons dressed as one control), calling onChange with the value picked
function segmented(name, options, value, onChange) {
  const box = el("div", "segmented segmented-sm");
  box.setAttribute("role", "radiogroup");
  for (const [optionValue, label] of options) {
    const option = el("label");
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.value = optionValue;
    input.checked = optionValue === value;
    input.addEventListener("change", () => onChange(optionValue));
    option.append(input, el("span", "", label));
    box.append(option);
  }
  return box;
}

// One line of a step card: a label (You, Engine), the moves as chips, and their figures
function moveLine(label, figs, options = {}, extra = []) {
  const line = el("div", "move-line");
  const head = el("div", "move-line-head");
  head.append(el("span", "move-line-label", label), el("span", "move-line-figs", figs ? figures(figs) : ""), ...extra);
  line.append(head, movesView(figs?.fingering ?? null, options));
  return line;
}

// The steps a run of engine moves is made of (the step solver's answer), each a labelled line of chips
function partsView(parts) {
  const box = el("div", "parts");
  for (const part of parts) {
    const line = el("div", "move-line");
    const head = el("div", "move-line-head");
    head.append(el("span", "move-line-label", part.name), el("span", "move-line-figs", plural(part.moves, "move")));
    if (part.also.length) head.append(el("span", "step-also", `+ ${part.also.join(", ")}`));
    line.append(head, movesView(part.fingering));
    box.append(line);
  }
  return box;
}

// A table of label and value rows, as in the step numbers
function numbersTable(rows) {
  const table = el("table", "numbers");
  for (const [label, value] of rows) {
    const row = table.insertRow();
    row.append(el("th", "", label), el("td", "", value));
  }
  return table;
}

// ============ STATS ============
// The review's statistics in a compact grid: per-step scores and differences, the net, whole-solve effort, and with your time TPS and execution
function statsGrid(score, evaluation) {
  const { rating, pace } = score;
  const none = !rating.steps;
  const grid = el("div", "stats");
  grid.append(
    stat("Move score", percent(rating.moves), "per step · engine = 100%", "The engine's pick over yours, in moves, averaged over the steps you turned: above 100% = fewer moves than the engine"),
    stat("Effort score", percent(rating.speed), "per step · engine = 100%", "The same for effort: above 100% = easier to turn than the engine's picks"),
    stat("Moves per step", none ? "—" : signed(rating.movesDiff, 1), "vs the engine's picks", "Your moves minus the engine's pick, averaged per step (below 0 = fewer)"),
    stat("Effort per step", none ? "—" : signed(rating.speedDiff, 1), "vs the engine's picks", "Your effort minus the engine's pick, averaged per step (below 0 = easier)"),
    stat(
      "Net effort",
      none ? "—" : signed(rating.netSpeed, 1),
      pace ? `≈ ${signed(pace.netTime, 2)} s · steps alone ${signed(pace.choicesTime, 2)} s` : `steps alone ${signed(rating.stepSpeed, 1)}`,
      "All your steps against the engine's picks, counting what each left for the steps after it (0 = even, below = better); 'steps alone' leaves that out",
    ),
    stat("Whole-solve effort", evaluation.yours.speed.toFixed(1), `engine's own ${evaluation.engine.speed.toFixed(1)}`, "Effort of your whole solution, and of the engine's own solve with the same method (luck included)"),
    stat("TPS", pace ? pace.tps.toFixed(2) : "—", pace ? `${plural(evaluation.yours.moves, "move")} in ${clock(pace.time)}` : "add your time", "Moves per second"),
    stat("Execution", pace ? pace.execution.toFixed(2) : "—", pace ? "effort per second" : "add your time", "Effort per second: TPS weighted by how hard the moves are to turn"),
  );
  return grid;
}

// ============ RACE ============
// Your figures for a step of the review: your moves for it, your moves in the step you stopped in, or none
function yourFigures(step) {
  return step.yours ?? step.partial ?? null;
}

// What a race bar counts of some figures: moves, or effort
function metricOf(figs, metric) {
  return figs ? (metric === "moves" ? figs.moves : figs.speed) : 0;
}

// A race value as text: moves, effort, or seconds at your pace
function metricText(value, metric, pace) {
  if (metric === "moves") return plural(Math.round(value), "move");
  return pace ? clock(value / pace.execution) : `${value.toFixed(1)} effort`;
}

// One race bar: a piece per step (as wide as its value, clickable) in a track as wide as the longer of the two solves, its total at the end
function raceBar(label, pieces, max, metric, pace, onPick) {
  const total = pieces.reduce((sum, piece) => sum + piece.value, 0);
  const row = el("div", "race-row");
  const track = el("div", "race-track");
  const bar = el("div", "race-bar");
  bar.style.width = `${max ? (total / max) * 100 : 0}%`;
  // Whether the piece before was your moves before a branch, so the fork mark goes where the engine takes over
  let afterShared = false;
  for (const piece of pieces) {
    if (piece.value <= 0) continue;
    if (afterShared && !piece.shared) {
      const fork = el("span", "race-fork");
      fork.title = "Branch: the engine takes over from your cube here";
      bar.append(fork);
    }
    afterShared = piece.shared;
    const seg = el("button", `race-seg${piece.partial ? " is-partial" : ""}${piece.shared ? " is-shared" : ""}`);
    seg.type = "button";
    seg.style.flexGrow = String(piece.value);
    // Its step's color, except your moves before a branch, which stay grey
    if (!piece.shared) seg.style.setProperty("--seg-color", stepColor(piece.index));
    seg.title = `${piece.name}: ${metricText(piece.value, metric, pace)}${piece.also.length ? ` (+ ${piece.also.join(", ")})` : ""}${piece.partial ? " · unfinished" : ""}${piece.shared ? " · your moves, before the branch" : ""}`;
    seg.append(el("span", "", piece.name));
    seg.addEventListener("click", () => onPick(piece.index));
    bar.append(seg);
  }
  track.append(bar);
  row.append(el("span", "race-label", label), track, el("span", "race-total", metricText(total, metric, pace)));
  return row;
}

// The later steps a line's moves for one step finished along with it, for its labels
function alsoSolved(parts, part) {
  return parts.filter((other) => other.solvedWith === part.name).map((other) => other.name);
}

// The race: your solve and the engine's line (its own solve, or a branch off yours) as two bars split into the same steps, by moves or effort (time
// with your pace), to see where each gains
function raceChart(evaluation, line, pace, actions) {
  const box = el("section", "race");
  let metric = "moves";
  const rows = el("div", "race-rows");
  // Draws both bars for the metric picked
  const draw = () => {
    const yours = evaluation.steps.map((step) => ({ index: step.index, name: step.name, value: metricOf(yourFigures(step), metric), also: step.alsoSolved ?? [], partial: !step.yours, shared: false }));
    const engine = line.parts.map((part) => ({
      index: part.index,
      name: part.name,
      value: metricOf(part.figures, metric),
      also: alsoSolved(line.parts, part),
      partial: false,
      shared: part.shared,
    }));
    const max = Math.max(...[yours, engine].map((pieces) => pieces.reduce((sum, piece) => sum + piece.value, 0)));
    rows.replaceChildren(
      raceBar("You", yours, max, metric, pace, (index) => actions.jump(evaluation.steps[index].start)),
      raceBar("Engine", engine, max, metric, pace, (index) => actions.engineStep(index)),
    );
  };
  // Head: title, the metric picker, and a button to play the engine's solve
  const head = el("div", "section-head");
  const tools = el("div", "race-tools");
  tools.append(
    segmented("race-metric", [["moves", "Moves"], ["speed", pace ? "Time" : "Effort"]], metric, (value) => {
      metric = value;
      draw();
    }),
    button(line.after ? "Play the branch" : "Play engine's solve", () => actions.playEngine(), { icon: ICON.play }),
  );
  head.append(el("h3", "section-title", line.after ? `You vs the engine after your ${line.after}` : "You vs the engine's own solve"), tools);
  const note = line.after
    ? `Both split into the same steps; the engine's bar is your moves up to your ${line.after} (grey), then the engine from your cube. Click a piece to see it on the cube.`
    : "Both solves split into the same steps. Click a piece to see that step on the cube.";
  box.append(head, rows, el("p", "race-note", note));
  draw();
  return box;
}

// ============ STEP CARDS: FROM YOUR CUBE ============
// A card's head: a button with the step's name (click = the cube jumps to the step's start) and the steps its moves finished too
function cardHead(step, actions) {
  const head = el("button", "step-head");
  head.type = "button";
  head.title = "Show this step on the cube";
  head.addEventListener("click", () => actions.jump(step.start));
  head.append(el("span", "step-name", step.name));
  if (step.alsoSolved?.length) head.append(el("span", "step-also", `+ ${step.alsoSolved.join(", ")}`));
  return head;
}

// Your moves for a step, as a line with a Play button (label = You, or You (unfinished))
function yourLine(step, figs, label, actions) {
  const play = button("Play", () => actions.playStep(step.start, step.end), { icon: ICON.play });
  return moveLine(label, figs, { at: step.start, onMove: (index) => actions.jump(step.start + index + 1) }, [play]);
}

// A step's numbers, folded away in its card: the step alone against the engine's pick, its score, what it leaves, the net, and the engine's way on from there
function stepNumbers(step, pace, actions) {
  const { yours, engine } = step;
  const details = el("details", "step-more");
  details.append(el("summary", "", "Numbers"));
  // Seconds at your pace after an effort difference, when there's a time
  const secs = (value) => (pace ? ` (≈ ${signed(value / pace.execution, 2)} s)` : "");
  details.append(
    numbersTable([
      ["This step alone vs the engine's pick", `${signed(yours.moves - engine.moves)} moves · ${signed(yours.speed - engine.speed, 1)} effort${secs(yours.speed - engine.speed)}`],
      ["Score (engine = 100%)", `${percent(engine.moves / yours.moves)} moves · ${percent(engine.speed / yours.speed)} effort`],
      ["What it leaves vs the pick", step.after.moves ? `${signed(-step.setup.moves)} moves · ${signed(-step.setup.speed, 1)} effort` : "the cube solved"],
      ["Net, with what it leaves", `${signed(step.net.moves)} moves · ${signed(step.net.speed, 1)} effort${secs(step.net.speed)}`],
      ["Engine from here to the end", figures(step.fromHere)],
    ]),
  );
  // The engine's whole way on from here, on the cube
  const row = el("div", "step-more-actions");
  row.append(button("Show the engine's way from here", () => actions.showEngine(step.start, step.fromHere.text, `Engine from ${step.name}`), { icon: ICON.show }));
  details.append(row);
  return details;
}

// One step's card against the engine's pick from your cube: name and verdict, your moves and the pick, what the verdict counts, and its numbers
function stepCard(step, pace, actions) {
  const card = el("li", "step-card");
  card.style.setProperty("--step-color", stepColor(step.index));
  const verdictInfo = verdict(step, pace);
  if (verdictInfo) card.classList.add(`tone-${verdictInfo.tone}`);
  const head = cardHead(step, actions);
  card.append(head);
  // Done by an earlier step's moves: nothing more to show
  if (step.solvedBy) {
    head.append(el("span", "step-tag", `solved with ${step.solvedBy}`));
    card.classList.add("is-compact");
    return card;
  }
  // Done before you turned anything for it
  if (step.yours && !rated(step)) {
    head.append(el("span", "step-tag", "already done"));
    card.classList.add("is-compact");
    return card;
  }
  // The step your solution stops in: your moves after your last finished step (they don't finish it), and the engine's way through it
  if (!step.yours) {
    head.append(el("span", "step-tag warn", "not finished"));
    const body = el("div", "step-body");
    if (step.partial) {
      body.append(yourLine(step, step.partial, "You", actions));
      body.append(el("p", "step-note", `These moves don't finish ${step.name}: play them to see where the cube goes wrong.`));
    }
    const show = button("Show on cube", () => actions.showEngine(step.start, step.engine.text, `Engine's ${step.name}`), { icon: ICON.show });
    body.append(moveLine("Engine", step.engine, {}, [show]));
    card.append(body);
    return card;
  }
  head.append(el("span", "step-count", plural(step.yours.moves, "move")));
  if (verdictInfo) head.append(el("span", `verdict ${verdictInfo.tone}`, verdictInfo.text));
  // Body: your moves, then the engine's pick (or a note that it's the same), what the verdict counts, and the numbers folded away
  const body = el("div", "step-body");
  body.append(yourLine(step, step.yours, "You", actions));
  if (step.yours.text === step.engine.text) {
    body.append(el("p", "same-line", "The engine picks the same moves."));
  } else {
    const show = button("Show on cube", () => actions.showEngine(step.start, step.engine.text, `Engine's ${step.name}`), { icon: ICON.show });
    body.append(moveLine("Engine", step.engine, {}, [show]));
  }
  const note = stepNote(step, pace);
  if (note) body.append(el("p", "step-note", note));
  body.append(stepNumbers(step, pace, actions));
  card.append(body);
  return card;
}

// ============ STEP CARDS: FOLLOWING THE ENGINE ============
// The engine's step against yours for the same goal (from different cubes): text as the engine did against you (by effort, in seconds with your
// pace), tone as it went for you (green = you did better)
function engineVerdict(theirs, mine, pace) {
  if (theirs.moves && !mine?.moves) return { tone: "better", text: "You skipped it" };
  if (!theirs.moves && mine?.moves) return { tone: "warn", text: "Engine skipped it" };
  if (!theirs.moves) return null;
  if (mine.text === theirs.text) return { tone: "even", text: "Same moves as you" };
  const diff = theirs.speed - mine.speed;
  if (diff <= -0.5) return { tone: diff > -2.5 ? "warn" : "worse", text: `Faster than you · ${amount(diff, pace)}` };
  if (diff < 0.5) return { tone: "even", text: "Even with you" };
  return { tone: "better", text: `Slower than you · ${amount(diff, pace)}` };
}

// Where the race stands after a step: both move totals so far, and who's ahead by effort (time with your pace)
function standing(name, totals, pace) {
  const gap = totals.yoursSpeed - totals.engineSpeed;
  const lead = Math.abs(gap) < 0.5 ? "level" : gap < 0 ? `you're ${amount(gap, pace)} ahead` : `the engine is ${amount(gap, pace)} ahead`;
  return `After ${name}: engine ${plural(totals.engineMoves, "move")}, you ${plural(totals.yoursMoves, "move")} · ${lead}`;
}

// A step's "Branch here" button: the engine's line then follows your moves up to this step, and solves your cube from there (after = the step your
// moves finished last before it)
function branchButton(index, after, actions) {
  const element = button("Branch here", () => actions.setBranch(index), { icon: ICON.branch });
  element.title = `Follow your moves up to your ${after}, then the engine from your cube`;
  return element;
}

// One step of the engine's line, with your step for the same goal under it (from your cube, which differs once the line leaves your moves), where the
// race stands after it, and a button to branch the line off your solution here (branchAfter = the step it would branch after, null = no branch here);
// the head and the engine's moves show the line on the cube, your moves show yours (also = the later steps its moves finished too). A step still made
// of your moves (before a branch) gets a slim card
function engineCard(step, part, also, totals, branchAfter, pace, actions) {
  const card = el("li", "step-card");
  card.style.setProperty("--step-color", stepColor(part.index));
  const theirs = part.figures;
  const mine = step ? yourFigures(step) : null;
  const branch = branchAfter ? branchButton(part.index, branchAfter, actions) : null;
  // Head: the line's step (click = the cube at its start in the line), the steps it finished too, both counts, and the verdict
  const head = el("button", "step-head");
  head.type = "button";
  head.title = "Show this step of the engine's line on the cube";
  head.addEventListener("click", () => actions.engineStep(part.index));
  head.append(el("span", "step-name", part.name));
  if (also.length) head.append(el("span", "step-also", `+ ${also.join(", ")}`));
  // Before the branch: your own moves, the same on both sides, in a slim row with its branch button
  if (part.shared) {
    head.append(el("span", "step-tag", theirs.moves ? `your ${plural(theirs.moves, "move")}` : "done with your moves"));
    card.classList.add("is-compact", "is-shared");
    const row = el("div", "card-row");
    row.append(head, ...(branch ? [branch] : []));
    card.append(row);
    return card;
  }
  card.append(head);
  head.append(el("span", "step-count", `${theirs.moves} vs ${mine?.moves ?? 0} moves`));
  const verdictInfo = !step ? { tone: "warn", text: "you didn't get here" } : step.yours ? engineVerdict(theirs, mine, pace) : { tone: "warn", text: "you didn't finish it" };
  if (verdictInfo) head.append(el("span", `verdict ${verdictInfo.tone}`, verdictInfo.text));
  const body = el("div", "step-body");
  // The engine's moves for this step (on its cube), or why there are none
  if (theirs.moves) {
    const play = button("Play", () => actions.playEngineStep(part.index), { icon: ICON.play });
    body.append(moveLine("Engine", theirs, { at: part.start, track: "engine", onMove: (index) => actions.engineJump(part.start + index + 1) }, [play]));
  } else {
    body.append(el("p", "quiet-line", part.solvedWith ? `Engine: solved with ${part.solvedWith}` : "Engine: already done"));
  }
  // Your moves for the same goal (on your cube), or why there are none
  if (mine?.moves) body.append(yourLine(step, mine, step.yours ? "You" : "You (unfinished)", actions));
  else if (step) body.append(el("p", "quiet-line", step.solvedBy ? `You: solved with ${step.solvedBy}` : step.yours ? "You: already done" : "You: no moves for it"));
  // The race after this step, with the branch button beside it
  const foot = el("div", "card-foot");
  foot.append(el("p", "race-standing", standing(part.name, totals, pace)), ...(branch ? [branch] : []));
  body.append(foot);
  card.append(body);
  return card;
}

// The divider where the engine's line leaves your moves: what it branched after, and a button back to the engine's own solve
function branchMarker(line, actions) {
  const marker = el("li", "branch-marker");
  const icon = el("span", "branch-icon");
  icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON.branch}"/></svg>`;
  const text = el("p");
  text.append(el("b", "", `Branched after your ${line.after}`), ": your moves above, the engine solving your cube from here.");
  marker.append(icon, text, button("Back to the engine's own solve", () => actions.setBranch(0), { icon: ICON.undo }));
  return marker;
}

// Every step of the engine's line with yours under it, adding up the race totals as it goes (steps you didn't reach count nothing for you), a branch
// button on each step it can branch at, and the branch's divider where the line leaves your moves
function engineCards(evaluation, line, pace, actions) {
  const totals = { yoursMoves: 0, yoursSpeed: 0, engineMoves: 0, engineSpeed: 0 };
  const points = branchPoints(evaluation);
  const items = [];
  let marked = false;
  line.parts.forEach((part) => {
    const step = evaluation.steps[part.index] ?? null;
    const mine = step ? yourFigures(step) : null;
    totals.yoursMoves += mine?.moves ?? 0;
    totals.yoursSpeed += mine?.speed ?? 0;
    totals.engineMoves += part.figures.moves;
    totals.engineSpeed += part.figures.speed;
    // The divider before the first step the engine solves on its own
    if (line.after && !part.shared && !marked) {
      items.push(branchMarker(line, actions));
      marked = true;
    }
    // A branch button where the line can branch, except where it already does
    const branchAfter = part.index !== line.index ? (points.get(part.index) ?? null) : null;
    items.push(engineCard(step, part, alsoSolved(line.parts, part), { ...totals }, branchAfter, pace, actions));
  });
  return items;
}

// ============ REVIEW ============
// How to read a review, folded away under the summary
function explainer() {
  const details = el("details", "explain");
  details.append(el("summary", "", "How to read this review"));
  const items = el("ul");
  for (const text of [
    "Effort is how hard moves are to turn, counted in easy turns: an R or a U flick is 1; regrips, awkward grips and slow layers (D, B) cost more. Lower is faster. With your solve time, effort turns into seconds at your own pace.",
    "Follow your solve: each of your steps against the engine's pick from the exact cube your moves left, with the same method. Its verdict also counts what the step left for the steps after it, so a slower pair that skips OLL can still come out ahead.",
    "Follow the engine's solve: the cube plays the engine's own solve from the scramble, and each of its steps is shown with your step for the same goal under it (from your cube, so the cases differ), like a race; the totals after each step say who's ahead.",
    "Branch here (following the engine): the engine's line follows your moves up to that step, then solves your cube from there, so you see what it would have done after your own start.",
    "Under each move: the suggested fingertrick (R / L = right or left hand). The colored line shows the hand, ↻ marks a regrip. Click a move to see the cube after it.",
  ]) items.append(el("li", "", text));
  details.append(items);
  return details;
}

// What each way of following does, under its switch
const FOLLOW_NOTES = {
  you: "Your steps, each against the engine's pick from the same cube.",
  engine: "The engine's own solve on the cube, each step against yours for the same goal. Branch here on a step to have the engine take over from your cube there.",
  branch: "Your moves up to the branch, then the engine solving your cube; each step against yours.",
};

// Where the engine's line can branch off your solution: the start of each of your steps after the first (once per spot your steps start from), each
// named after the step your moves finished last before it (step index → that name)
function branchPoints(evaluation) {
  const points = new Map();
  evaluation.steps.forEach((step, index) => {
    if (index === 0 || step.start === evaluation.steps[index - 1].start) return;
    const after = [...evaluation.steps.slice(0, index)].reverse().find((one) => one.end > one.start);
    if (after) points.set(index, after.name);
  });
  return points;
}

// Draws a review in a panel: header, summary tiles and stats, the unfinished banner, then the steps with the Follow switch over them: following your
// solve (the engine's pick from your cube) or the engine's line (a race, with yours under each step, and a branch button on each); time = your solve
// time in seconds (or null); actions = what the buttons do: jump(pos), playStep(start, end), showEngine(start, moves, label), engineJump(pos),
// engineStep(index), playEngineStep(index), playEngine(), showFromEnd(moves), addFromEnd(moves), follow / setFollow(mode) for what's followed
// ("you" or "engine"), and branch / setBranch(index) for where the engine's line starts (0 = the scramble, else the start of your step index)
export function renderReview(container, evaluation, time, actions) {
  const score = scoreEvaluation(evaluation, time);
  const { rating, pace } = score;
  const review = el("div", "review");
  // Header: the method, with its note under it
  const head = el("header", "review-head");
  const title = el("div");
  title.append(el("div", "eyebrow", "Review"), el("h2", "", methodName(evaluation.method)));
  const note = methodNote(evaluation.method);
  if (note) title.append(el("p", "muted", note));
  head.append(title);
  review.append(head);
  // Summary: your solve, the engine's with the same method, and your step choices together
  const total = overall(rating, pace);
  const tiles = el("div", "tiles");
  tiles.append(
    tile("Your solve", plural(evaluation.yours.moves, "move"), pace ? `${clock(pace.time)} · ${pace.tps.toFixed(2)} TPS` : "Add your time to see TPS and seconds"),
    tile(
      "Engine, same method",
      plural(evaluation.engine.moves, "move"),
      pace ? `≈ ${clock(pace.engineTime)} at your pace` : `${evaluation.engine.speed.toFixed(1)} effort, yours ${evaluation.yours.speed.toFixed(1)}`,
    ),
    tile(
      "Your step choices",
      total.text,
      rating.steps
        ? [`over ${plural(rating.steps, "step")}`, rating.setups ? plural(rating.setups, "set-up") : "", rating.alsoSolved ? `${plural(rating.alsoSolved, "step")} solved along the way` : ""].filter(Boolean).join(" · ")
        : "no step to rate yet",
      total.tone,
    ),
  );
  review.append(tiles, statsGrid(score, evaluation));
  // Your solution doesn't finish the cube: say where it stops, and the engine's way to finish from your last move
  if (!evaluation.complete) {
    const banner = el("div", "banner warn");
    banner.append(el("p", "", `Your moves don't finish ${evaluation.stopsIn}: the cube isn't solved after your last move, so steps after it aren't rated.`));
    if (evaluation.fromYourEnd) {
      const row = el("div", "banner-actions");
      row.append(
        button("Show the engine's finish", () => actions.showFromEnd(evaluation.fromYourEnd.text), { icon: ICON.show }),
        button("Add it to my solution", () => actions.addFromEnd(evaluation.fromYourEnd.text), { icon: ICON.add }),
      );
      banner.append(row);
    }
    review.append(banner);
  }
  review.append(explainer());
  // The engine's line followed: its own solve, or the branch off your solution picked (back to its own solve when the pick isn't in this review)
  const line = engineLine(evaluation, evaluation.steps[actions.branch] ? actions.branch : 0);
  // Steps head: the title, and the Follow switch right over the steps, with what it does under it
  const followHead = el("div", "follow-head");
  const followSwitch = el("div", "follow-switch");
  followSwitch.append(
    el("span", "follow-label", "Follow"),
    segmented("follow", [["you", "Your solve"], ["engine", "Engine's solve"]], actions.follow, (mode) => {
      actions.setFollow(mode);
      showMode(mode);
    }),
  );
  followHead.append(el("h3", "section-title", "Step by step"), followSwitch);
  const followNote = el("p", "follow-note");
  // Following your solve: your steps against the engine's pick from your cube
  const youPart = el("div", "follow-part");
  const youList = el("ol", "step-list");
  youList.append(...evaluation.steps.map((step) => stepCard(step, pace, actions)));
  youPart.append(youList);
  // Following the engine: the race, then the line's steps with yours under each
  const enginePart = el("div", "follow-part");
  const engineList = el("ol", "step-list");
  engineList.append(...engineCards(evaluation, line, pace, actions));
  enginePart.append(raceChart(evaluation, line, pace, actions), engineList);
  // Shows the part for what's followed, with its note
  function showMode(mode) {
    youPart.hidden = mode !== "you";
    enginePart.hidden = mode !== "engine";
    followNote.textContent = mode === "engine" && line.after ? FOLLOW_NOTES.branch : FOLLOW_NOTES[mode];
  }
  showMode(actions.follow);
  review.append(followHead, followNote, youPart, enginePart);
  container.replaceChildren(review);
}

// ============ STEP SOLVER ============
// Draws the step solver's answer: what was solved and from where, the steps it's made of as chips, and buttons to show it on the cube or add it
// to your solution (info = { title, from }; actions = { show(), add() }, add's label says whether it replaces moves after the spot)
export function renderSolverResult(container, result, info, actions) {
  const card = el("div", "result-card");
  const head = el("div", "result-head");
  const title = el("div");
  title.append(el("div", "eyebrow", `Engine's moves · ${info.from}`), el("h3", "", info.title));
  head.append(title);
  card.append(head);
  // Nothing to do: the step is done on the cube as shown
  if (!result.text) {
    card.append(el("p", "same-line", `${info.title} is already done on the cube as shown.`));
    container.replaceChildren(card);
    return;
  }
  head.append(el("span", "move-line-figs", figures(result)));
  card.append(partsView(result.parts));
  // Show it, or make it part of your solution
  const row = el("div", "result-actions");
  row.append(button("Show on cube", actions.show, { icon: ICON.show }), button(actions.addLabel, actions.add, { kind: "btn-primary", icon: ICON.add }));
  card.append(row);
  container.replaceChildren(card);
}
