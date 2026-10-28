// Puzzly scoring helper: works out a chunk of answers' looks and writings ahead of the scoring worker
import wasm from "puzzly/search/pkg/puzzly_search_bg.wasm?url";
import { runScoringHelper } from "puzzly/src/engine/worker/scoring-helper.ts";

runScoringHelper({ wasm });
