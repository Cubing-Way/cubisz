// Cube player: steps the cube through your solution (or a preview of the engine's moves) with a step timeline, play/pause and move buttons,
// keyboard keys, and a readout of the move just made with its fingertrick
import { applySolution, checkSolved } from "./api.js";
import { fingerLabel, fingerTitle } from "./review.js";

// Time between moves while playing, in ms
const MOVE_MS = 380;
// Play and pause icons for the play button
const PLAY_PATH = "M7 4.5v15l12-7.5z";
const PAUSE_PATH = "M8 5v14M16 5v14";

// A typed move as cubisz's cube model reads it: lowercase wide turns as Rw, and 2' as 2 (the model knows neither)
export function simMove(move) {
  const wide = move.match(/^([rludfb])(2'?|'?)$/);
  const written = wide ? `${wide[1].toUpperCase()}w${wide[2]}` : move;
  return written.replace(/2'$/, "2");
}

// Makes the player on the page's elements (els: timeline, cursor, labels row, buttons, readout parts, solved badge, preview banner and its label/button);
// onChange() hears every change of position or of what's shown
export function createPlayer(els, { onChange = () => {} } = {}) {
  // What's on show: moves (as typed), the timeline's segments ({ name, start, end, color, also }), and each move's fingering step (or null)
  let moves = [];
  let segments = [];
  let fingers = [];
  // How many moves are made on the cube on show
  let position = 0;
  // Playing: the timer, and where it stops
  let timer = null;
  let stopAt = null;
  // Your solution, kept while a preview of the engine's moves shows (preview = its label, null = your solution on show)
  let yours = { moves: [], segments: [], fingers: [] };
  let preview = null;

  // ============ TIMELINE ============
  // Builds the timeline's segments: one per step, as wide as its moves; a single grey one when the steps aren't known
  function drawTimeline() {
    els.track.replaceChildren();
    els.labels.replaceChildren();
    const total = moves.length;
    // No moves: an empty bar with a hint
    els.timeline.classList.toggle("is-empty", total === 0);
    if (!total) return drawPosition();
    const parts = segments.length ? segments : [{ name: preview ? "Moves" : "Your solution", start: 0, end: total }];
    for (const part of parts) {
      const size = part.end - part.start;
      if (size <= 0) continue;
      // The bar piece, its fill showing how far through it the cube is
      const piece = document.createElement("div");
      piece.className = `seg${part.unfinished ? " is-unfinished" : ""}${part.base ? " is-base" : ""}`;
      piece.style.flexGrow = String(size);
      if (part.color) piece.style.setProperty("--seg-color", part.color);
      piece.dataset.start = String(part.start);
      piece.dataset.end = String(part.end);
      piece.title = `${part.name}${part.also?.length ? ` + ${part.also.join(", ")}` : ""} · ${size} move${size === 1 ? "" : "s"}`;
      piece.append(document.createElement("i"));
      els.track.append(piece);
      // Its label under the bar, as wide as the piece (cut with … when it doesn't fit)
      const label = document.createElement("span");
      label.style.flexGrow = String(size);
      label.textContent = part.name;
      label.title = piece.title;
      els.labels.append(label);
    }
    drawPosition();
  }

  // Moves the cursor and the pieces' fills to the position on show
  function drawPosition() {
    const total = moves.length;
    els.cursor.style.left = `${total ? (position / total) * 100 : 0}%`;
    for (const piece of els.track.children) {
      const start = Number(piece.dataset.start);
      const end = Number(piece.dataset.end);
      const fill = Math.min(1, Math.max(0, (position - start) / (end - start)));
      piece.style.setProperty("--fill", String(fill));
      piece.classList.toggle("is-current", position > start && position <= end);
    }
    els.timeline.setAttribute("aria-valuemax", String(total));
    els.timeline.setAttribute("aria-valuenow", String(position));
    els.timeline.setAttribute("aria-valuetext", `${position} of ${total} moves`);
  }

  // The timeline position under a pointer, in moves
  function positionAt(event) {
    const box = els.track.getBoundingClientRect();
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    return Math.round(share * moves.length);
  }

  // Dragging on the timeline scrubs through the moves
  els.timeline.addEventListener("pointerdown", (event) => {
    if (!moves.length) return;
    pause();
    els.timeline.setPointerCapture(event.pointerId);
    seek(positionAt(event));
    // Follows the pointer until it's let go
    const move = (next) => seek(positionAt(next));
    const up = () => {
      els.timeline.removeEventListener("pointermove", move);
      els.timeline.removeEventListener("pointerup", up);
      els.timeline.removeEventListener("pointercancel", up);
    };
    els.timeline.addEventListener("pointermove", move);
    els.timeline.addEventListener("pointerup", up);
    els.timeline.addEventListener("pointercancel", up);
  });

  // ============ CUBE AND READOUT ============
  // The segment the last move made belongs to (the first one at the start)
  function segmentAt(pos) {
    return segments.find((part) => pos > part.start && pos <= part.end) ?? null;
  }

  // Shows the cube after the first `count` moves, with the timeline, readout, buttons and solved badge to match
  function seek(count) {
    position = Math.min(moves.length, Math.max(0, count));
    applySolution(moves.slice(0, position).map(simMove).join(" "));
    drawPosition();
    // Readout: the step it's in and how far, then the move just made with its fingertrick
    const part = segmentAt(position);
    els.step.textContent = position === 0 ? (moves.length ? "Start" : "") : part ? part.name.replace(/ \(unfinished\)$/, "") : "";
    els.stepPos.textContent = part ? `move ${position - part.start} of ${part.end - part.start}` : "";
    const finger = fingers[position - 1];
    els.move.textContent = moves[position - 1] ?? "";
    els.finger.textContent = finger ? fingerLabel(finger) : "";
    els.finger.title = finger ? fingerTitle(finger) : "";
    els.count.textContent = `${position} / ${moves.length}`;
    // Buttons: nothing to go back to at the start, nothing ahead at the end
    els.start.disabled = els.prev.disabled = position === 0;
    els.next.disabled = els.end.disabled = position >= moves.length;
    els.play.disabled = moves.length === 0;
    // Solved badge for the cube on show, once a move is played
    els.solved.hidden = !(position > 0 && checkSolved());
    onChange();
  }

  // ============ PLAYING ============
  // Plays from a position (default: where it is, from the start when at the end) up to a stop (default: the end)
  function play(from = null, to = null) {
    pause();
    if (from !== null) seek(from);
    else if (position >= moves.length) seek(0);
    stopAt = to ?? moves.length;
    els.playIcon.setAttribute("d", PAUSE_PATH);
    els.play.title = "Pause (Space)";
    els.play.setAttribute("aria-label", "Pause");
    timer = setInterval(() => {
      seek(position + 1);
      // Stops at its stop, or the last move
      if (position >= stopAt) pause();
    }, MOVE_MS);
  }

  // Stops playing and puts the play icon back
  function pause() {
    clearInterval(timer);
    timer = null;
    els.playIcon.setAttribute("d", PLAY_PATH);
    els.play.title = "Play (Space)";
    els.play.setAttribute("aria-label", "Play");
  }

  // Jumps to the start of the step before or after the one on show (delta = -1 or +1)
  function jumpStep(delta) {
    pause();
    const bounds = [0, ...segments.map((part) => part.end)];
    if (delta > 0) seek(bounds.find((at) => at > position) ?? moves.length);
    else seek([...bounds].reverse().find((at) => at < position) ?? 0);
  }

  // Buttons: start, a move back, play/pause, a move on, end
  els.start.addEventListener("click", () => (pause(), seek(0)));
  els.prev.addEventListener("click", () => (pause(), seek(position - 1)));
  els.play.addEventListener("click", () => (timer ? pause() : play()));
  els.next.addEventListener("click", () => (pause(), seek(position + 1)));
  els.end.addEventListener("click", () => (pause(), seek(moves.length)));
  els.back.addEventListener("click", () => exitPreview());

  // Keys anywhere outside a text box: arrows step a move (Shift: a step), Home/End jump, Space plays, Escape leaves a preview
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, select, [contenteditable]") || event.ctrlKey || event.metaKey || event.altKey) return;
    const keys = {
      ArrowLeft: () => (event.shiftKey ? jumpStep(-1) : (pause(), seek(position - 1))),
      ArrowRight: () => (event.shiftKey ? jumpStep(1) : (pause(), seek(position + 1))),
      Home: () => (pause(), seek(0)),
      End: () => (pause(), seek(moves.length)),
      " ": () => (timer ? pause() : play()),
      Escape: () => preview && exitPreview(),
    };
    const action = keys[event.key];
    if (!action) return;
    // A focused button would also take Space as a click
    event.preventDefault();
    action();
  });

  // ============ WHAT'S ON SHOW ============
  // Puts moves on show, with their segments and fingering, at a position
  function show(next, at) {
    pause();
    ({ moves, segments, fingers } = next);
    drawTimeline();
    seek(at);
  }

  // Your solution: its moves, keeping the position when asked (clamped), else at its end; a preview showing is closed
  function setSolution(list, { keepPosition = false } = {}) {
    const at = keepPosition && !preview ? position : list.length;
    yours = { moves: list, segments: [], fingers: [] };
    preview = null;
    els.banner.hidden = true;
    show(yours, Math.min(at, list.length));
  }

  // Your solution's steps (from the live split or a review) and each move's fingering; drawn now unless a preview is on show
  function setDetails({ segments: parts = yours.segments, fingers: steps = yours.fingers }) {
    yours = { ...yours, segments: parts, fingers: steps };
    if (preview) return;
    segments = parts;
    fingers = steps;
    drawTimeline();
    seek(position);
  }

  // A preview of other moves (the engine's): base moves first (greyed on the timeline), then the moves shown, played from the base's end
  function showPreview({ base, added, label, color, fingering = [] }) {
    preview = label;
    els.banner.hidden = false;
    els.bannerText.textContent = label;
    const all = [...base, ...added];
    const parts = [
      ...(base.length ? [{ name: "Your moves", start: 0, end: base.length, base: true }] : []),
      { name: label, start: base.length, end: all.length, color },
    ];
    // Fingertricks: yours for the base where they line up, then the shown moves'
    const steps = [...yours.fingers.slice(0, base.length), ...fingering];
    show({ moves: all, segments: parts, fingers: steps }, base.length);
    play(base.length, all.length);
  }

  // Back to your solution from a preview, at the end of your moves the preview started from
  function exitPreview() {
    if (!preview) return;
    const at = segments[0]?.base ? segments[0].end : 0;
    preview = null;
    els.banner.hidden = true;
    show(yours, Math.min(at, yours.moves.length));
  }

  return {
    setSolution,
    setDetails,
    showPreview,
    exitPreview,
    seek,
    play,
    pause,
    // Where the cube is: its position, the moves made so far, and whether a preview is on show
    get position() {
      return position;
    },
    get shownMoves() {
      return moves.slice(0, position);
    },
    get inPreview() {
      return preview !== null;
    },
  };
}
