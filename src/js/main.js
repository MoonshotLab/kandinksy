const touch = require('./touch');
const ui = require('./ui');
const overlays = require('./overlays');

window.kan = {
  currentColor: '#20171C',
  composition: [],
  compositionInterval: null,
  lastEvent: null,
  moves: [],
  playing: false,
  pinching: false,
  pinchedGroup: null,
  pathData: {},
  shapePath: null,
  prevAngle: null,
  sides: [],
  side: [],
  corners: [],
  lastScale: 1,
  lastRotation: 0,
  originalPosition: null,
  canvasLayer: null
};

$(document).ready(function() {
  function run() {
    ui.init();
    touch.init();
    overlays.init();
  }

  run();
});
