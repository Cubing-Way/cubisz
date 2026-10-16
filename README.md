# cubisz

A 2x2 and 3x3 cube viewer for the browser: an SVG net (with a 3D toggle), random or typed scrambles, a typed solution played on the scrambled cube, and an FMC mode that ignores slice moves. Solving, scrambles and move tools come from the [puzzly](https://github.com/Cubing-Way/puzzly) engine.

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

The site lands in `dist/` as static files; `npm run preview` serves them to check the build.

## Folder layout

| Path | What's in it |
| --- | --- |
| `index.html` | The page, and Vite's entry |
| `main.js` | Wires the page's buttons, inputs and puzzle selector |
| `api.js` | cubisz's cube API used by `main.js`: mount, size, view, scramble, solution |
| `renderer.js` | Draws the cube net as SVG stickers, and the 3D view |
| `scramble.js` | Random scrambles and move parsing (FMC mode included) |
| `puzzles/` | Cube models: `2x2.js`, `3x3.js`, and `cube.js`, which switches between them |
| `puzzly.js` | Loads the puzzly engine with its search worker and re-exports its API |
| `puzzly-worker.js`, `puzzly-helper.js` | puzzly's search worker and its helpers for long searches, with the Rust search code |
| `vite.config.js` | Vite setup: module workers, and cubing.js kept in its own chunk |
| `style.css` | Styles |
| `cubieMapping.js`, `debug_eo.js`, `kociemba test.js` | Standalone experiments, not loaded by the page |
| `old/` | The old renderer |
