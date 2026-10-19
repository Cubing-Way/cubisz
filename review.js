// Solve review, the page side: draws a review (summary, one card per step, the engine's own solve), the step solver's answer, and moves as chips
// with their fingertricks; what's shown comes from evaluate.js
import { rated, setupSign, scoreEvaluation, plural } from "./evaluate.js";

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

// Icon paths shared by the review's buttons: play, eye (show on cube) and plus (add)
const ICON = {
  play: "M7 4.5v15l12-7.5z",
  show: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  add: "M12 5v14M5 12h14",
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
// first move (each chip is marked with the position after it, so the one just played can light up), onMove(i) = the chip of move i was clicked
export function movesView(fingering, { at = null, onMove = null } = {}) {
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
    // Position after this move in the player, for highlighting and clicking
    if (at !== null) chip.dataset.at = String(at + index + 1);
    if (onMove) {
      chip.classList.add("is-clickable");
      chip.addEventListener("click", () => onMove(index));
    }
    view.append(chip);
  });
  return view;
}

// Lights up the chip of the move just played (position pos in your solution) in a review or solver panel
export function highlightMoves(root, pos) {
  for (const chip of root.querySelectorAll(".mv[data-at]")) chip.classList.toggle("is-current", Number(chip.dataset.at) === pos);
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

// ============ REVIEW ============
// A summary tile: a small label, a big value (tinted by tone) and a note under it
function tile(label, value, note, tone = "") {
  const box = el("div", "tile");
  box.append(el("div", "tile-label", label), el("div", `tile-value ${tone}`.trim(), value), el("div", "tile-note", note));
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

// One step's card: its name and verdict (click = jump the cube there), your moves and the engine's pick, what it left, and buttons to play either
function stepCard(step, pace, actions) {
  const card = el("li", "step-card");
  card.style.setProperty("--step-color", stepColor(step.index));
  const verdictInfo = verdict(step, pace);
  if (verdictInfo) card.classList.add(`tone-${verdictInfo.tone}`);
  // Head: name, the steps it solved along the way, move count, verdict
  const head = el("button", "step-head");
  head.type = "button";
  head.title = "Show this step on the cube";
  head.addEventListener("click", () => actions.jump(step.start));
  head.append(el("span", "step-name", step.name));
  if (step.alsoSolved?.length) head.append(el("span", "step-also", `+ ${step.alsoSolved.join(", ")}`));
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
      const play = button("Play", () => actions.playStep(step.start, step.end), { icon: ICON.play });
      body.append(moveLine("You", step.partial, { at: step.start, onMove: (index) => actions.jump(step.start + index + 1) }, [play]));
      body.append(el("p", "step-note", `These moves don't finish ${step.name}: play them to see where the cube goes wrong.`));
    }
    const show = button("Show on cube", () => actions.showEngine(step.start, step.engine.text, `Engine's ${step.name}`), { icon: ICON.show });
    body.append(moveLine("Engine", step.engine, {}, [show]));
    card.append(body);
    return card;
  }
  head.append(el("span", "step-count", plural(step.yours.moves, "move")));
  if (verdictInfo) head.append(el("span", `verdict ${verdictInfo.tone}`, verdictInfo.text));
  // Body: your moves, then the engine's pick (or a note that it's the same), then what the verdict counts
  const body = el("div", "step-body");
  const play = button("Play", () => actions.playStep(step.start, step.end), { icon: ICON.play });
  body.append(moveLine("You", step.yours, { at: step.start, onMove: (index) => actions.jump(step.start + index + 1) }, [play]));
  if (step.yours.text === step.engine.text) {
    body.append(el("p", "same-line", "The engine picks the same moves."));
  } else {
    const show = button("Show on cube", () => actions.showEngine(step.start, step.engine.text, `Engine's ${step.name}`), { icon: ICON.show });
    body.append(moveLine("Engine", step.engine, {}, [show]));
  }
  const note = stepNote(step, pace);
  if (note) body.append(el("p", "step-note", note));
  card.append(body);
  return card;
}

// The steps a run of engine moves is made of, each a labelled line of chips
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

// How to read a review, folded away under the summary
function explainer() {
  const details = el("details", "explain");
  details.append(el("summary", "", "How to read this review"));
  const items = el("ul");
  for (const text of [
    "Each step of your solve is compared with the engine's pick for the same step, from the exact same cube (your moves before it), solving with the method you picked.",
    "Effort is how hard moves are to turn, counted in easy turns: an R or a U flick is 1; regrips, awkward grips and slow layers (D, B) cost more. Lower is faster.",
    "A step's verdict also counts what it leaves for the steps after it, so a slower pair that skips OLL can still come out ahead.",
    "With your solve time, effort turns into seconds at your own pace (your effort per second).",
    "Under each move: the suggested fingertrick (R / L = right or left hand). The colored line shows the hand, ↻ marks a regrip. Click a move to see the cube after it.",
  ]) items.append(el("li", "", text));
  details.append(items);
  return details;
}

// The raw numbers behind the summary, folded away at the bottom
function numbers(score, evaluation) {
  const { rating, pace } = score;
  const details = el("details", "explain");
  details.append(el("summary", "", "More numbers"));
  const rows = [
    ["Your effort, whole solve", evaluation.yours.speed.toFixed(1)],
    ["Engine's effort, whole solve", evaluation.engine.speed.toFixed(1)],
    ["Move score per step (engine = 100%)", percent(rating.moves)],
    ["Effort score per step (engine = 100%)", percent(rating.speed)],
    ["Your steps alone vs the engine's picks", `${signed(rating.stepSpeed, 1)} effort`],
    ["With what each step left for the next ones", `${signed(rating.netSpeed, 1)} effort`],
    ...(pace
      ? [
          ["TPS (moves per second)", pace.tps.toFixed(2)],
          ["Execution (effort per second)", pace.execution.toFixed(2)],
          ["Engine's solve at your execution", clock(pace.engineTime)],
        ]
      : []),
  ];
  const table = el("table", "numbers");
  for (const [label, value] of rows) {
    const row = table.insertRow();
    row.append(el("th", "", label), el("td", "", value));
  }
  details.append(table);
  return details;
}

// Draws a review in a panel: header, summary tiles, the unfinished banner, one card per step, then the engine's own solve; time = your solve time
// in seconds (or null); actions = what the buttons do: jump(pos), playStep(start, end), showEngine(start, moves, label), showFromStart(moves, label),
// addFromEnd(moves)
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
  review.append(tiles);
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
  // One card per step
  const steps = el("ol", "step-list");
  steps.append(...evaluation.steps.map((step) => stepCard(step, pace, actions)));
  review.append(el("h3", "section-title", "Step by step"), steps);
  // The engine's own solve from the scramble, step by step
  const engine = el("section", "engine-solve");
  const engineHead = el("div", "section-head");
  engineHead.append(
    el("h3", "section-title", `The engine's own solve · ${plural(evaluation.engine.moves, "move")}`),
    button("Show on cube", () => actions.showFromStart(evaluation.engine.text, "Engine's solve"), { icon: ICON.show }),
  );
  engine.append(engineHead, partsView(evaluation.engine.parts));
  review.append(engine, numbers(score, evaluation));
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
