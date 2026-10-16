// Puzzly search helper: runs parts of long searches on another core
import wasm from "puzzly/search/pkg/puzzly_search_bg.wasm?url";
import { runSearchHelper } from "puzzly/src/engine/worker/search-helper.ts";

runSearchHelper({ wasm });
