// Hidden engine page: apps load it in an iframe and talk to it with postMessage; engine-worker.js makes the reviews, this page lists the methods and passes messages along

// The methods apps can pick, and the one used when they don't pick any
import { APP_METHODS, METHOD } from "./method.js";

// Sites that may ask: the live sites and local development
const ALLOWED_SITES = [/^https:\/\/cubing-way\.github\.io$/, /^http:\/\/localhost(:\d+)?$/];

// The worker making the reviews, started by the first one, so asking for the methods loads no engine (null = not started, or it failed)
let worker = null;
// Where answers go: the window and site of the last message
let asker = null;

// Sends a message to the app that asked
function answer(message) {
  asker?.source.postMessage(message, asker.origin);
}

// Starts the worker: its progress and answers go back to the app
function startWorker() {
  worker = new Worker(new URL("./engine-worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", ({ data }) => answer(data));
  // It couldn't start: the app hears it, and the next review tries again
  worker.addEventListener("error", (event) => {
    worker = null;
    answer({ type: "cubisz-error", message: `The engine couldn't start (${event.message || "its files didn't load"})` });
  });
}

// Messages from allowed sites: the method list is answered here, and a review goes to the worker
window.addEventListener("message", ({ data, origin, source }) => {
  if (!ALLOWED_SITES.some((site) => site.test(origin))) return;
  asker = { source, origin };
  if (data?.type === "cubisz-methods") answer({ type: "cubisz-methods", methods: APP_METHODS.map((method) => method.name), start: METHOD.name });
  if (data?.type === "cubisz-review") {
    if (!worker) startWorker();
    worker.postMessage(data);
  }
});

// Tells the app it can send messages, and that this page honours deviceOnly, since an older page would ignore it and use the server (this holds no data, so any site may see it)
window.parent.postMessage({ type: "cubisz-ready", deviceOnly: true }, "*");
