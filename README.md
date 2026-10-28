# cubisz

A solve review app for the 3x3 (and a 2x2 viewer) in the browser. Paste a scramble and how you solved it, and cubisz:

- plays your solution on a 3D cube (or a flat net), with a timeline that splits it into the method's steps as you type;
- reviews it: each step is compared with the engine's pick for that step from the same cube, with a verdict that also counts what the step left for the next ones, and your solve time turned into seconds at your own pace;
- shows a suggested fingertrick under every move (which hand and finger, and the regrips);
- solves a single step (or the rest of the solve) from any point of your solution, to show on the cube or add to your solution.

Solving, scrambles, fingerings and move tools come from the [puzzly](https://github.com/Cubing-Way/puzzly) engine.

Engine runs go to puzzly's solve server on AWS (see *Solve server* in puzzly's README), so the page builds no tables for them, except the "Computer fastest" methods: Search fastest takes minutes a run, past the server's 120 s a request, so those solve in the page. When the server can't answer a run (it's busy or too slow, its month's budget is spent, or it can't be reached), the page solves it instead, and keeps solving that method in the page for the rest of the visit (every method, once the budget is spent or the server can't be reached).

## Using it

1. **Scramble**: paste yours, or press New for a random one. FMC makes the cube ignore slice moves.
2. **Your solution**: type or paste it; `//` comments and line breaks are fine. The note beside the box says whether it solves the cube.
3. **Review my solve** (with the method picked, and your time if you want seconds): the Review tab shows a summary and stats, then the steps, following one of two solves (the Follow switch right above them). **Your solve**: each of your steps against the engine's pick from the same cube. **Engine's solve**: the cube plays the engine's own solve from the scramble (or, after "Branch here" on a step, your moves up to that step, then the engine solving your cube, marked where it branches), with a race of the two solves (split into the same steps, by moves or time) and each engine step shown over your step for the same goal, with the race totals after each. Click a step to see the cube there, Play to watch your step, Show on cube to watch the engine's; each card's Numbers fold out the step's detailed figures.
4. **Step solver** tab: move the timeline to any point, pick a step (the next one is picked for you) and press Find moves; then show it on the cube, or add the moves to your solution.

Moves use standard notation, the same as puzzly and other cube sites: S turns like F. If a solution only solves the cube with S and S' swapped (as cubisz's cube used to turn them), a button under the solution box swaps them. "Cube left / Cube right" in the top bar puts the cube on either side on wide screens.

Player keys (outside the text boxes): ← → a move, Shift+← → a step, Home / End, Space to play, Esc to leave a preview of the engine's moves.

## Run

cubisz uses puzzly from a folder next to it (`../puzzly`), so set that up first, once:

```bash
cd ../puzzly
npm install
npm run build-search
```

Then, in cubisz:

```bash
npm install
npm run dev
```

and open the address Vite prints (http://localhost:5173 by default). The page has to go through Vite: opening `index.html` directly, or with another static server, can't load puzzly.

Changes in `../puzzly/src` show up in cubisz right away; after changing puzzly's Rust search, run `npm run build-search` there again.

## Build

```bash
npm run build
npm run preview
```

The site lands in `dist/` as static files, with relative paths so it works from a subfolder like GitHub Pages' `/cubisz/`; `npm run preview` serves them to check the build.

## Folder layout

| Path | What's in it |
| --- | --- |
| `index.html` | The page, and Vite's entry |
| `main.js` | Wires the page: your solve's inputs, the method picker, the tabs, the review and the step solver |
| `player.js` | The cube player: step timeline, play and move buttons, keys, the move readout, and previews of the engine's moves |
| `evaluate.js` | The review engine: splits a solution into the method's steps, compares each with the engine's pick, solves single steps; caches engine runs |
| `review.js` | Draws the review, the step solver's answer, and moves as chips with their fingertricks |
| `method.js` | The methods the picker offers (`methods/*.json` first, then puzzly's examples), which ones search for the fastest solve, and which go to the solve server |
| `methods/` | Your own method files (puzzly's Export format) |
| `api.js` | cubisz's cube API used by `main.js`: mount, size, view, scramble, solution |
| `renderer.js` | Draws the cube net as SVG stickers, and the 3D view |
| `scramble.js` | Random scrambles and move parsing (FMC mode included) |
| `puzzles/` | Cube models: `2x2.js`, `3x3.js`, and `cube.js`, which switches between them |
| `puzzly.js` | Loads the puzzly engine with its search worker, connects to the solve server, and re-exports its API |
| `puzzly-worker.js`, `puzzly-helper.js` | puzzly's search worker and its helpers for long searches, with the Rust search code |
| `vite.config.js` | Vite setup: module workers, and cubing.js kept in its own chunk |
| `style.css` | Styles |
| `cubieMapping.js`, `debug_eo.js`, `kociemba test.js` | Standalone experiments, not loaded by the page |
| `old/` | The old renderer |
