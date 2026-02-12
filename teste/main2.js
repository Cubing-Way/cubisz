import {
  chooseCubeContainer,
  setCubeView,
  scrambleCube,
  solveCube
} from "../export.js"

function init() {
  chooseCubeContainer("#cube");
  setCubeView({ stickerSize: 30, displayMode: "3d" });

  bindTimerButtons();
}

document.addEventListener("DOMContentLoaded", init);
