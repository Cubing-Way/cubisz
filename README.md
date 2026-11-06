# cubisz

A solve review app for the 3x3 (and a 2x2 viewer) in the browser. Paste a scramble and how you solved it, and cubisz:

- plays your solution on a 3D cube (or a flat net), with a timeline that splits it into the method's steps as you type;
- reviews it: each step is compared with the engine's pick for that step from the same cube, with a verdict that also counts what the step left for the next ones, and your solve time turned into seconds at your own pace;
- scores how close the solve came to the engine's best, each step and the whole solve, like chess.com's accuracy;
- shows a suggested fingertrick under every move (which hand and finger, and the regrips);
- solves a single step (or the rest of the solve) from any point of your solution, to show on the cube or add to your solution.

Solving, scrambles, fingerings and move tools come from the [puzzly](https://github.com/Cubing-Way/puzzly) engine.

Engine runs go to puzzly's solve server on AWS (see *Solve server* in puzzly's README), so the page builds no tables for them, except the "Computer fastest" methods: Search fastest takes minutes a run, past the server's 120 s a request, so those solve in the page. When the server can't answer a run (it's busy or too slow, its month's budget is spent, or it can't be reached), the page solves it instead, and keeps solving that method in the page for the rest of the visit (every method, once the budget is spent or the server can't be reached).

## Using it

1. **Scramble**: paste yours, or press New for a random one. The FMC switch beside it makes each of the engine's steps take the answer with the fewest moves instead of the fastest to turn (see *FMC mode*).
2. **Your solution**: type or paste it; `//` comments and line breaks are fine. The note beside the box says whether it solves the cube.
3. **Review my solve** (with the method picked, and your time if you want seconds): the Review tab shows a summary and stats, then the steps, following one of two solves (the Follow switch right above them). **Your solve**: each of your steps against the engine's pick from the same cube. **Engine's solve**: the cube plays the engine's own solve from the scramble (or, after "Branch here" on a step, your moves up to that step, then the engine solving your cube, marked where it branches), with a race of the two solves (split into the same steps, by moves or time) and each engine step shown over your step for the same goal, with the race totals after each. Click a step to see the cube there, Play to watch your step, Show on cube to watch the engine's; each card's Numbers fold out the step's detailed figures.
4. **Step solver** tab: move the timeline to any point, pick a step (the next one is picked for you) and press Find moves; then show it on the cube, or add the moves to your solution.

Moves use standard notation, the same as puzzly and other cube sites: S turns like F. If a solution only solves the cube with S and S' swapped (as cubisz's cube used to turn them), a button under the solution box swaps them. "Cube left / Cube right" in the top bar puts the cube on either side on wide screens.

Player keys (outside the text boxes): ← → a move, Shift+← → a step, Home / End, Space to play, Esc to leave a preview of the engine's moves.

A solve can also arrive in the page's address, after the `#`: `#scramble=…&solution=…&time=…&method=…&runs=…` (Pro Timer's "Full analysis on Cubisz" link). `loadSolveFromLink` (`main.js`) fills the boxes and the method picker. `runs` holds the engine runs of a review already made, as `metrics.js` saves them: `seedRuns` (`evaluate.js`) puts them in the run cache, and the review that follows finds them there, so it calls no engine. Only the engine runs need the engine; the rest of a review (the steps, effort, fingertricks, comparisons) is worked out from them in about 100 ms. So opening, reloading or sharing that address costs nothing, and gives the same review, byte for byte. Anything further that needs a new run, like the step solver from another point, goes to the engine as usual.

## Accuracy

The Accuracy tile says how close your step choices came to the engine's best, like chess.com's accuracy, judged by the method you picked. It's worked out from the engine runs a review already has, so it adds no engine call.

1. **The ranking**: when a step looks ahead, the engine compares several answers (up to 16 with CFOP level 3), and its run keeps them in `lookahead.ranked`, its pick first (see *Lookahead* in puzzly's README). A step with no lookahead has no list.
2. **Your place**: `rankOf` (`evaluate.js`) looks for your moves in the list of the run that starts where your step starts, compared as plain turns so `r` and `Rw` match. It gives your place, the list's size and the effort behind the engine's best.
3. **Effort lost**: `addAccuracy` uses that gap when your answer is listed, since it's what the engine picked by. When it isn't, it estimates: your step plus the engine's way on from its end, against the engine's pick plus its way on (`costTo`), both up to as many steps ahead as the method's `lookahead`. If one of the two has finished more steps by then, both go on to that step (`stepsHeld` counts them), so they always cover the same steps: a cross left a turn off with a pair beside it (a pseudo XCross) only counts as a pair once a later move lines it up, by which time the engine may have solved two more, and a pair that solves the next one too would otherwise look like a loss. So a slower pair that sets up the next one isn't punished, and last-layer luck further on doesn't count, unlike the `net` behind a step's verdict, so the two can disagree. The engine's exact moves lose nothing, and a step that beats the engine counts as losing nothing too.
4. **The percentage**: effort lost over the engine's whole solve gives the share of the solve lost, and `accuracyFrom` turns that into a percentage with Lichess's accuracy curve (`CURVE`), since chess.com's formula isn't public: 0% lost = 100, 5% ≈ 80, 10% ≈ 64, 20% ≈ 39. `CLASSES` names the share with chess.com's move class limits: Best, Excellent, Good, Inaccuracy, Mistake or Blunder.
5. **The whole solve**: `solveAccuracy` averages the mean and the harmonic mean of the steps you made moves in, so one big mistake shows, and `scoreEvaluation` puts it in the rating.
6. **Showing and keeping it**: `review.js` draws the tile, each step card's "96% · 2nd best" pill (its class name when your answer isn't listed) and a row in its Numbers; `accuracyTone` tints the tile and the pills by the percent shown: green from 80%, amber from 50%, red below. `metrics.js` gives apps the figures, and saves your place with each run (`savedRank`) instead of the whole list, so a review rebuilt from saved runs (`seedRuns`) scores the same. If the moves change after that, the saved place no longer applies and the step uses the estimate.

## FMC mode

The FMC switch turns speed off: each of the engine's steps takes the answer with the fewest moves instead of the fastest to turn, and a review judges by moves. Your solution, the cube and how it's split into steps stay the same; only the engine's picks and what a review judges by change. It's still a plain run, as quick as with the switch off, not a search for the whole solve with the fewest moves (puzzly's *Method search*), which would be a method of its own, as the "Computer fastest" ones are for speed.

1. **The method**: `currentMethod` (`main.js`) gives `fmcMethod(picked)` while the switch is on. `fmcMethod` (`method.js`) makes the method's FMC version once per method: the same steps with `rank: "moves"` (puzzly's *Best answer* by fewest moves) and no avoided faces, since those only make a step faster to turn. A step's lookahead and extra moves stay, and count moves now: a step may take a longer answer when it saves more moves in the steps it looks ahead to. Steps answered from an alg set (OLL, PLL) keep their usual algs, as a human solves them. Its name starts with `FMC: `, which gives it its own cached runs, marks a review out of date when the switch changes, and shows in the review's title. `isFmc` reads that name. So the rest of the page treats the switch as picking another method, and both share `methodChanged`. A "Computer fastest" method's FMC version is a plain run too, since `keepingFor` doesn't match its name.
2. **Where it runs**: on the solve server like every plain run (`onServer` in `method.js`), and in the page when the server can't answer.
3. **What's judged**: `evaluateSolution` sets `judged` to `"moves"` for an FMC version and `"speed"` otherwise, and keeps it in the review. It's also the key that reads the figure, as in `step.net[judged]`. `setupSign` counts set-ups in it, and `addAccuracy` counts the loss and the engine's whole solve in it (see *Accuracy*). The gap from `lookahead.ranked` is in moves then, since the steps rank by moves, and the estimate counts moves. A slice turn counts as one move, as the engine counts it.
4. **What's shown**: `renderReview` (`review.js`) keeps `judged` for the verdicts. `amount` writes "3 moves", `moreWord` and `lessWord` say longer and shorter instead of slower and faster, `overall` and `standing` count moves, and the stats show *Net moves* instead of *Net effort*. An FMC review also adds a line to its explainer. Effort still shows as a figure, but no verdict uses it.

Other apps don't get FMC: `engine-worker.js` only finds methods by their plain names, so `engine.html` can't be asked for an FMC version.

## Engine for other apps

Other apps can send a solve and get its metrics back without showing this site: `engine.html` is a page with nothing to see, which an app loads in a hidden iframe. Pro Timer uses it.

1. The page tells the app it's ready: `{ type: "cubisz-ready", deviceOnly: true }`. `deviceOnly` says this page honours the option below, so an app can tell it from an older page, which would ignore the option and use the server.
2. The app sends a solve with `postMessage`: `{ type: "cubisz-review", id, scramble, solution, time, method, deviceOnly }`. `time` is in seconds (leave it out for no pace figures), `method` is a method's full name (leave it out for the one the site starts on), and `deviceOnly: true` solves on the device and never calls the server, for batches of reviews.
3. The page answers `{ type: "cubisz-progress", id, run, runs, step }` as each engine run starts, then `{ type: "cubisz-metrics", id, metrics }`, or `{ type: "cubisz-error", id, message }`. An error with no `id` means the engine itself couldn't start.
4. To list the methods it can pick, the app sends `{ type: "cubisz-methods" }` and gets `{ type: "cubisz-methods", methods, start }`: every method's full name (`APP_METHODS` in `method.js`: the reviewable ones, without the "Computer fastest" ones, since a review with those takes minutes), and the one used when none is picked. This loads no engine, because the worker only starts with the first review.

Only the sites in `ALLOWED_SITES` (`engine.js`) can ask. `engine.js` only passes messages along; the review runs in `engine-worker.js`, a worker, because an app on the same site shares its page's main thread with the iframe, and a timer can't afford a stall. 

These reviews go to the solve server first, like the site's. A 7-step solve is 7 calls: measured on 2026-11-02, about 11 s and 25 GB-seconds, or 18 s and 42 GB-seconds when a new container has to start and build its tables. So the server's budget covers roughly 80 to 130 reviews a month, shared with the site. When the server can't answer (its budget is spent, it's busy, or it can't be reached), they solve on the device instead, as the site does: about 40 seconds on a 4-thread PC, a bit more the first time, when the tables are built and stored. The metrics come out the same either way. A review with `deviceOnly` goes straight to the device: `engine-worker.js` passes it to `evaluateSolution`, which passes it through `cachedRun` to `newProgress`, where it leaves the run's `remote` false, so `solveMethod` never calls the server. An app reviewing many solves at once must use it, since about 100 reviews would spend the whole month's budget.

`metrics.js` turns a review (185 KB) into the metrics (about 4 KB with CFOP level 3, about 2.5 KB of it the engine runs), small enough to keep with every solve:

| Field | What it is |
| --- | --- |
| `version` | This format's version, raised when the fields change |
| `method`, `complete` | The method's full name, and whether the solution finishes every step |
| `accuracy` | How close the whole solve came to the engine's best, from 0 to 100 (null = no step to rate; see *Accuracy*) |
| `moves`, `effort`, `regrips` | Your whole solution: moves, effort and hand regrips |
| `moveScore`, `effortScore` | The engine's pick over yours, averaged over the steps you made moves in: 1 = as good as the engine, above = better |
| `netMoves`, `netEffort` | Your steps against the engine's picks, counting what each step left for the rest: below 0 = better |
| `stepEffort` | The same, each step alone |
| `setups`, `alsoSolved` | Steps that set up the rest, and later steps your moves solved along the way |
| `engineMoves`, `engineEffort` | The engine's own solve from the scramble |
| `time`, `tps`, `execution` | Your time, moves per second, effort per second (null with no time, like the two below) |
| `engineTime` | The engine's own solve at your execution |
| `netTime`, `choicesTime` | `netEffort` and `stepEffort` as seconds at your execution |
| `steps` | Each step: `name`, `moves`, `effort`, `engineMoves`, `engineEffort`, `netMoves`, `netEffort`, `solvedBy` (the step whose moves finished this one too), `accuracy`, `accuracyClass` ("Best" to "Blunder") and `place` (among the answers the engine compared: 0 = not among them, null = no list) |
| `runs` | The review's engine runs, one per place a step starts: `at` (your moves before it), `moves`, `starts`, `text` (the whole run), `rows` (each step's moves) and `rank` (your answer's place there, for accuracy). They rebuild the review with no engine call (see above) |

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
| `main.js` | Wires the page: your solve's inputs, the method picker and FMC switch (`currentMethod`, `methodChanged`), the tabs, the review and the step solver; `loadSolveFromLink` fills them from a solve sent in the address |
| `player.js` | The cube player: step timeline, play and move buttons, keys, the move readout, and previews of the engine's moves |
| `evaluate.js` | The review engine: splits a solution into the method's steps, compares each with the engine's pick, works out accuracy (in effort, or in moves with FMC), solves single steps; caches engine runs |
| `review.js` | Draws the review (its verdicts in effort, or in moves with FMC), the step solver's answer, and moves as chips with their fingertricks |
| `engine.html`, `engine.js` | The hidden engine page other apps load in an iframe, and what lists the methods and passes their messages to and from the worker |
| `engine-worker.js` | Takes a solve, reviews it (on the solve server, or the device when the server can't answer), and answers with its metrics |
| `metrics.js` | `solveMetrics`: a review as the compact metrics apps get back, with its engine runs (`savedRuns`) |
| `method.js` | The methods the picker offers (`methods/*.json` first, then puzzly's examples), which ones search for the fastest solve, each method's FMC version (`fmcMethod`, `isFmc`), which go to the solve server, which can be reviewed (`reviewable`), and which apps can pick (`APP_METHODS`) |
| `methods/` | Your own method files (puzzly's Export format) |
| `api.js` | cubisz's cube API used by `main.js`: mount, size, view, scramble, solution |
| `renderer.js` | Draws the cube net as SVG stickers, and the 3D view |
| `scramble.js` | Random scrambles and move parsing |
| `puzzles/` | Cube models: `2x2.js`, `3x3.js`, and `cube.js`, which switches between them |
| `puzzly.js` | Loads the puzzly engine with its search and scoring workers and the Rust speed model, connects to the solve server, and re-exports its API |
| `puzzly-worker.js`, `puzzly-helper.js` | puzzly's search worker and its helpers for long searches, with the Rust search code |
| `puzzly-scoring.js`, `puzzly-scoring-helper.js` | puzzly's scoring worker (scores answers ranked by speed with the Rust speed model while the search lists more) and its helpers (only on devices with more than 4 threads) |
| `vite.config.js` | Vite setup: the two pages (`index.html` and `engine.html`), module workers, and cubing.js kept in its own chunk |
| `style.css` | Styles |
| `cubieMapping.js`, `debug_eo.js`, `kociemba test.js` | Standalone experiments, not loaded by the page |
| `old/` | The old renderer |
