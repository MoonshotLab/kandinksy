require('hammerjs');

const config = require('./../../config');
const sound = require('./sound');
const color = require('./color');
const shape = require('./shape');
const util = require('./util');
const tutorial = require('./tutorial');
const timing = require('./timing');
const overlays = require('./overlays');
const ui = require('./ui');

const $body = $('body');

const hitOptions = {
  segments: false,
  stroke: true,
  fill: true,
  tolerance: 5
};

const minShapeSize = 100;
const maxScaleFactor = 0.8;

let outerPath;
let sizes = [];
let size;
let cumSize;
let prevPoint;

export let hammerTips;
export let hammerCanvas;

export function init() {
  hammerTips = new Hammer.Manager(ui.tipsOverlay);
  hammerTips.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_ALL }));
  hammerTips.on('swipe', overlays.cardNavNext);

  hammerCanvas = new Hammer.Manager(ui.canvas);
  hammerCanvas.add(new Hammer.Tap({ event: 'doubletap', taps: 2, interval: 400, time: 150, posThreshold: 50 }));
  hammerCanvas.add(new Hammer.Tap({ event: 'singletap' }));
  hammerCanvas.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL }));
  hammerCanvas.add(new Hammer.Pinch());

  hammerCanvas.get('doubletap').recognizeWith('singletap');
  // hammerCanvas.get('singletap').requireFailure('doubletap');
  hammerCanvas.get('pan').requireFailure('pinch');
  hammerCanvas.get('pinch').requireFailure('pan');

  // hammerCanvas.on('singletap', singleTap);
  hammerCanvas.on('doubletap', doubleTap);

  hammerCanvas.on('panstart', panStart);
  hammerCanvas.on('panmove', panMove);
  hammerCanvas.on('panend', panEnd);
  // hammerCanvas.on('pancancel', panCancel);

  hammerCanvas.on('pinchstart', pinchStart);
  hammerCanvas.on('pinchmove', pinchMove);
  hammerCanvas.on('pinchend', pinchEnd);
  // hammerCanvas.on('pinchcancel', pinchCancel);
}

function enablePanAndPinchEvents() {
  enablePanEvents();
  enablePinchEvents();
}

function enableTapEvents(enable = true) {
  enable = enable === true;
  hammerCanvas.get('singletap').set({enable: enable});
  hammerCanvas.get('doubletap').set({enable: enable});
}

function disableTapEvents() {
  enableTapEvents(false);
}

function enablePanEvents(enable = true) {
  enable = enable === true;

  hammerCanvas.get('pan').set({enable: enable});
  // hammerCanvas.get('panstart').set({enable: enable});
  // hammerCanvas.get('panmove').set({enable: enable});
  // hammerCanvas.get('panend').set({enable: enable});
}

function disablePanEvents() {
  enablePanEvents(false);
}

function enablePinchEvents(enable = true) {
  enable = enable === true;

  hammerCanvas.get('pinch').set({enable: enable});
  // hammerCanvas.get('pinchstart').set({enable: enable});
  // hammerCanvas.get('pinchmove').set({enable: enable});
  // hammerCanvas.get('pinchend').set({enable: enable});
}

function disablePinchEvents() {
  enablePinchEvents(false);
}

function singleTap(event) {
  // console.log(event.target);
  // event.preventDefault();
  // if (!eventTargetIsOnCanvas(event)) return;
  tutorial.hideContextualTuts();
  // $(event.target).click();

  // sound.stopPlaying();
  // if (!eventTargetIsOnCanvas(event)) return;
  // console.log(event);
  // tutorial.hideContextualTuts();
  //
  // sound.stopPlaying();
  //
  const pointer = event.center,
      point = new Point(pointer.x, pointer.y),
      hitResult = paper.project.hitTest(point, hitOptions);

  if (hitResult) {
    let item = hitResult.item;
    item.selected = !item.selected;
    console.log(item);
  }
}

function doubleTap(event) {
  event.preventDefault();
  console.log('doubletap');

  const pointer = event.center,
      point = new Point(pointer.x, pointer.y),
      hitResult = paper.project.hitTest(point, hitOptions);

  if (!eventTargetIsOnCanvas(event)) return;

  const transparent = color.transparent;

  if (hitResult) {
    console.log('hit');
    let item = hitResult.item;
    let parent = item.parent;

    console.log('hit item', item);
    console.log('hit parent', parent);

    tutorial.hideContextualTutByName('fill');

    if (item.data.interior) {
      console.log('interior');
      item.data.transparent = !item.data.transparent;

      if (item.data.transparent) {
        console.log('transparent');
        item.fillColor = transparent;
        item.strokeColor = transparent;
      } else {
        console.log('not transparent');
        item.fillColor = parent.data.color;
        item.strokeColor = parent.data.color;
      }

      window.kan.moves.push({
        type: 'fillChange',
        id: item.id,
        fill: parent.data.color,
        transparent: item.data.transparent
      });
    } else {
      console.log('not interior')
    }

  } else {
    window.kan.pinchedGroup = null;
    console.log('hit no item');
  }
}

function panStart(event) {
  // console.log(event);
  // console.log('panstart');
  // paper.project.activeLayer.removeChildren(); // REMOVE
  // event.preventDefault();

  if (!eventTargetIsOnCanvas(event)) {
    window.kan.panning = false;
    timing.preventInactivityTimeout();
    // check if tips modal is up
    if ($body.hasClass('overlay-active tips-active')) {
      // if so, go to next tip card
      overlays.cardNavNext();
    }
    event.srcEvent.stopPropagation();
    return;
  }

  window.kan.panning = true;
  tutorial.hideContextualTuts();

  hammerCanvas.off('panstart');
  // hammerCanvas.get('pan').set({enable: false});
  disablePinchEvents();
  disableTapEvents();

  // ignore other touch inputs
  // if (window.kan.pinching) return;
  // if (!(event.changedPointers && event.changedPointers.length > 0)) return;
  // if (event.changedPointers.length > 1) {
  //   console.log('event.changedPointers > 1');
  // }

  sound.stopPlaying();

  window.kan.prevAngle = Math.atan2(event.velocityY, event.velocityX);

  const pointer = event.center;
  const point = new Point(pointer.x, pointer.y);

  outerPath = new Path();
  outerPath.fillColor = window.kan.currentColor;
  // outerPath.fillColor = new Color(0, 0.5);

  sizes = [];

  let shapePath = new Path({
    strokeColor: window.kan.currentColor,
    name: 'shapePath',
    strokeWidth: 5,
    visible: false,
    strokeCap: 'round'
  });

  shapePath.add(point);

  // window.kan.corners = [point];

  // window.kan.sides = [];
  // window.kan.side = [point];

  window.kan.pathData[shape.stringifyPoint(point)] = {
    point: point,
    first: true
  };

  window.kan.shapePath = shapePath;
}

function panMove(event) {
  console.log('panmove');
  // event.preventDefault();
  if (!eventTargetIsOnCanvas(event)) {
    event.srcEvent.stopPropagation();
    return;
  }
  if (window.kan.panning !== true) return;

  const thresholdAngleRad = util.rad(shape.cornerThresholdDeg);

  const pointer = event.center;
  let point = new Point(pointer.x, pointer.y);

  let angle = Math.atan2(event.velocityY, event.velocityX);
  let prevAngle = window.kan.prevAngle;
  let angleDelta = util.angleDelta(angle, prevAngle);
  window.kan.prevAngle = angle;

  // let side = window.kan.side;
  // let sides = window.kan.sides;

  // if (angleDelta > thresholdAngleRad) {
  //   if (side.length > 0) {
  //     // console.log('corner');
  //     let cornerPoint = point;
  //     // new Path.Circle({
  //     //   center: cornerPoint,
  //     //   radius: 15,
  //     //   strokeColor: 'black'
  //     // });
  //     // window.kan.corners.push(cornerPoint);
  //     sides.push(side);
  //     side = [];
  //   }
  // }

  // side.push(point);

  while (sizes.length > 10) {
    sizes.shift();
  }
  if (sizes.length > 0) {
    const dist = prevPoint.getDistance(point);

    // These are based on acceleration
    // size = 30 - Math.min(dist * 0.3, 30);
    // size = dist * 3 + 5;
    size = Math.random() * 10; // This is just random variance

    cumSize = 0;
    for (let j = 0; j < sizes.length; j++) {
      cumSize += sizes[j];
    }
    // const avgSize = ((cumSize / sizes.length) + size) / 2;
    const avgSize = Math.max(5, ((cumSize / sizes.length) + size) / 2);

    const halfPointX = (point.x + prevPoint.x) / 2;
    const halfPointY = (point.y + prevPoint.y) / 2;
    const halfPoint = new Point(halfPointX, halfPointY);

    const topX = halfPoint.x + Math.cos(angle - Math.PI/2) * avgSize;
    const topY = halfPoint.y + Math.sin(angle - Math.PI/2) * avgSize;
    const top = new Point(topX, topY);

    const bottomX = halfPoint.x + Math.cos(angle + Math.PI/2) * avgSize;
    const bottomY = halfPoint.y + Math.sin(angle + Math.PI/2) * avgSize;
    const bottom = new Point(bottomX, bottomY);

    outerPath.add(top);
    outerPath.insert(0, bottom);
    outerPath.smooth();
  } else {
    size = 5;
  }

  sizes.push(size);
  prevPoint = point;

  window.kan.pathData[shape.stringifyPoint(point)] = {
    point: point,
    speed: Math.abs(event.overallVelocity),
    angle: angle
  };

  window.kan.shapePath.add(point);
  // window.kan.sides = sides;
  // window.kan.side = side;

  paper.view.draw();
}

function panEnd(event) {
  console.log('panend');
  // event.preventDefault();
  if (!eventTargetIsOnCanvas(event)) {
    event.srcEvent.stopPropagation();
    return;
  }
  if (window.kan.panning !== true) return;

  const pointer = event.center;
  const point = new Point(pointer.x, pointer.y);

  const transparent = color.transparent;
  const colorName = color.getColorName(window.kan.currentColor);

  let shapePath = window.kan.shapePath;
  // let side = window.kan.side;
  // let sides = window.kan.sides;
  // let corners = window.kan.corners;

  shapePath.add(point);
  outerPath.visible = false;

  if (shapePath.length < minShapeSize) {
    console.log('path is too short');
    shapePath.remove();
    hammerCanvas.on('panstart', panStart);
    enablePanAndPinchEvents();
    enableTapEvents();
    window.kan.panning = false;
    return;
  }

  window.kan.pathData[shape.stringifyPoint(point)] = {
    point: point,
    last: true
  };

  // side.push(point);
  // sides.push(side);
  // corners.push(point);

  let group = new Group();

  let truedShape = shape.getTruedShape(shapePath);

  // group.data.color = truedShape.strokeColor;
  // console.log('currentGradient:', config.palette.gradients[window.kan.currentColor]);

  const shapeSize = truedShape.strokeBounds;
  const centerPoint = new Point(shapeSize.width / 2, shapeSize.height / 2);
  const angle = util.rad(Math.random() * 360);
  const gradientSize = (shapeSize.width + shapeSize.height) / 4;
  const originX = centerPoint.x + Math.cos(angle - Math.PI/2) * gradientSize;
  const originY = centerPoint.y + Math.sin(angle - Math.PI/2) * gradientSize;
  const destinationX = centerPoint.x + Math.cos(angle + Math.PI/2) * gradientSize;
  const destinationY = centerPoint.y + Math.sin(angle + Math.PI/2) * gradientSize;

  const origin = new Point(originX + shapeSize.x, originY + shapeSize.y);
  const destination = new Point(destinationX + shapeSize.x, destinationY + shapeSize.y);
  // group.addChild(new Path.Circle({
  //   center: origin,
  //   radius: 5,
  //   fillColor: 'red',
  // }));
  // group.addChild(new Path.Circle({
  //   center: destination,
  //   radius: 5,
  //   fillColor: 'green',
  // }));
  group.data.originalColor = window.kan.currentColor;
  group.data.color = {
    gradient: {
      stops: config.palette.gradients[window.kan.currentColor],
    },
    origin: origin,
    destination: destination,
  };
  group.data.scale = 1; // init variable to track scale changes
  group.data.rotation = 0; // init variable to track rotation changes
  group.data.fresh = true;

  shapePath.remove();
  truedShape.visible = false;
  // truedShape.strokeColor = window.kan.currentColor;
  truedShape.strokeColor = new Color(0, 0);
  window.kan.shapePath = truedShape;
  truedShape.name = 'shapePath';

  if (!(truedShape.length > 0)) {
    truedShape.remove();
    group.remove();
    window.kan.panning = false;
    return;
  }

  group.addChild(truedShape);

  let shapeSoundObj = sound.getShapeSoundObj(truedShape);
  window.kan.composition.push(shapeSoundObj);

  truedShape.visible = false;
  const outlineGroup = shape.getOutlineGroup(truedShape);
  // console.log('outlineGroup', outlineGroup);
  const outline = outlineGroup._namedChildren.outer[0].clone();
  outline.name = 'outer';
  outline.fillColor = window.kan.currentColor;
  outline.fillColor = group.data.color;

  const outlineCenter = outlineGroup._namedChildren.middle[0].clone();
  outlineCenter.strokeColor = group.data.color;
  outlineCenter.visible = false;
  // outline.fillColor = new Color(1, 1, 0, 0.5);
  group.addChild(outline);
  // outline.shadowColor = new Color(0, 0, 0, 0.2);
  // outline.shadowBlur = 0.25;
  // outline.shadowOffset = -1;
  outline.sendToBack();

  outlineGroup.remove();

  let shapeMask = outline.clone();
  shapeMask.fillColor = outline.fillColor;
  shapeMask.strokeColor = outline.strokeColor;
  // shapeMask.visible = true;
  // shapeMask.fillColor = color.transparent;
  shapeMask.closed = true;

  // truedShape = truedShape.intersect(outline); // make sure that the trued shape is within the outline
  // console.log('truedShape after', truedShape);
  // truedShape.selected = true;

  let enclosedLoops = shape.findInteriorCurves(outlineCenter);
  // console.log('truedShape', truedShape);
  if (enclosedLoops.length > 0 || truedShape.closed === true) {
    group.data.line = false;
  } else {
    group.data.line = true;
  }
  console.log('enclosedLoops', enclosedLoops);
  enclosedLoops.forEach((loop) => {
    console.log('loop before', loop);
    console.log('shapeMask before', shapeMask);
    console.log('loop after', loop);
    console.log('shapeMask after', shapeMask);
    loop.sendToBack();
    shapeMask.unite(loop);
    shapeMask.sendToBack();
    loop.name = 'loop';
    group.addChild(loop);
    // loop.remove();
  });


  // shapeMask.selected = true;
  shapeMask.unite();
  let crossings = shapeMask.resolveCrossings();
  // console.log(shapeMask.getIntersections());
  console.log('crossings', crossings);
  if (!!crossings && !!crossings.children && crossings.children.length > 0) {
    let maxArea = 0, maxChild = null;
    crossings.children.forEach((child) => {
      if (child.area > maxArea) {
        maxChild = child;
        maxArea = child.area;
      }
    });

    shapeMask = maxChild;
    // maxChild.fillColor = 'blue';
    // maxChild.selected = true;
  }
  // shapeMask.simplify();
  // shapeMask.selected = true;

  console.log('shapemask final', shapeMask);
  // let shapeMaskData = shapeMask.exportJSON();
  // shapeMask.remove();
  // shapeMask = new Path();
  // shapeMask.importJSON(shapeMaskData);
  // // let cloneMask = shapeMask.clone();
  // // shapeMask.replaceWith(cloneMask);
  // if (shapeMask.className === 'CompoundPath') {
  //   let longestChild = null, longestLength = 0;
  //   if (shapeMask.children.length > 0) {
  //     shapeMask.children.forEach((child, i) => {
  //       if (child.length > longestLength) {
  //         longestChild = child;
  //         longestLength = child.length;
  //       }
  //     });
  //
  //     if (longestChild !== null) {
  //       shapeMask.replaceWith(longestChild);
  //     } else {
  //       shapeMask.replaceWith(shapeMask.children[0]);
  //     }
  //   }
  // }
  // // shapeMask.fullySelected = true;
  // console.log('shapeMask final', shapeMask);
  // console.log('group before', group);
  // if (group._namedChildren.mask.length > 0) {
  //   group._namedChildren.mask.forEach((child) => {
  //     child.remove();
  //   });
  //
  //   group._namedChildren.mask = null;
  // }
  //
  // shapeMask.segments.forEach((segment, i) => {
  //   let point = segment.point;
  //   new Path.Circle({
  //     center: point,
  //     radius: 2,
  //     fillColor: new Color(0, i / shapeMask.segments.length)
  //   })
  // })
  // shapeMask.fillColor = 'pink';
  outlineCenter.remove();
  shapeMask.visible = false;
  // shapeMask.name = 'newMask';
  shapeMask.name = 'mask';
  shapeMask.data.mask = true;
  // shapeMask.selected = true;
  group.addChild(shapeMask);
  shapeMask.sendToBack();
  // shapeMask.bringToFront();
  console.log('group final', group);
  console.log('group mask final', group._namedChildren.mask);

  // group = shape.cleanUpGroup(group)
  shape.cleanUpGroup(group);
  // console.log('group newmask final', group._namedChildren.newMask);

  // make sure there is only one shape mask
  // shapeMask.sendToBack();
  // shapeMask.fillColor = 'pink';
  // shapeMask.selected = true;

  window.kan.moves.push({
    type: 'newGroup',
    id: group.id
  });


  ui.unditherButtonsByName(['new', 'undo']);

  if (window.kan.userHasDrawnFirstShape !== true) {
    // first shape!
    // set play prompt timeout
    window.kan.playPromptTimeout = setTimeout(() => {
      overlays.openOverlay('play-prompt');
    }, timing.playPromptDelay);

    window.kan.userHasDrawnFirstShape = true;
  } else {
    const groups = util.getAllGroups();
    if (groups.length >= 3) {
      $body.addClass(sound.playEnabledClass);
      ui.unditherButtonsByName(['play-stop', 'share']);
    }
    console.log(groups.length, $body.hasClass(sound.playEnabledClass));
  }

  if (config.runAnimations) {
    const scaleFactor = 0.9;
    group.animate(
      [{
        properties: {
          scale: scaleFactor
        },
        settings: {
          duration: 100,
          easing: "easeOut",
        }
      },
      {
        properties: {
          scale: 1 / scaleFactor
        },
        settings: {
          duration: 100,
          easing: "easeIn",
        }
      }]
    );
  }

  if (!tutorial.allTutsCompleted()) {
    const tutorialCompletion = window.kan.tutorialCompletion;
    let tutName = null;

    if (!tutorialCompletion['fill'] && truedShape.closed) {
      tutName = 'fill';
    } else {
      let groups = paper.project.getItems({
        match: function(el) {
          return el.className === 'Group'
        }
      });
      if (!tutorialCompletion['pinch'] && groups.length >= 3) {
        tutName = 'pinch';
      } else if (!tutorialCompletion['swipe'] && groups.length >= 5) {
        tutName = 'swipe';
      }
    }

    if (tutName !== null) {
      console.log(`${tutName} tutorial`);
      tutorial.addContextualTut(tutName);
      window.kan.tutorialCompletion[tutName] = true;
      group.data.tut = tutName;
    }
  }

  // window.kan.side = side;
  // window.kan.sides = sides;
  // window.kan.corners = corners;
  if (window.kan.scheduledOverlay !== null) {
    window.kan.scheduledOverlay = null;

    setTimeout(() => {
      overlays.openOverlay(window.kan.scheduledOverlay);
    }, timing.overlayDelay);
  }

  console.log('pan done');
  hammerCanvas.set({ enable: false });
  setTimeout(() => {
    hammerCanvas.set({ enable: true });
    console.log('touch enabled');
    hammerCanvas.on('panstart', panStart);
    enablePanAndPinchEvents();
    enableTapEvents();

    window.kan.panning = false;
  }, timing.inputDelay);

  shape.updatePops();
}

function panCancel(event) {
  console.log('pancancel');
  event.srcEvent.stopPropagation();
  // event.preventDefault();

  hammerCanvas.set({ enable: true });
  hammerCanvas.on('panstart', panStart);
  enablePanAndPinchEvents();
  enableTapEvents();
  window.kan.panning = false;
}

function pinchStart(event) {
  console.log('pinchstart');
  tutorial.hideContextualTuts();
  window.kan.interacting = true;
  window.kan.pinching = true;
  // event.preventDefault();

  // hammerCanvas.get('pinchstart').set({enable: false});
  hammerCanvas.off('pinchstart');
  disablePanEvents();
  disableTapEvents();

  if (!eventTargetIsOnCanvas(event)) return;

  console.log('pinchStart', event.center);
  sound.stopPlaying();

  const pointer = event.center,
      point = new Point(pointer.x, pointer.y),
      hitResult = shape.hitTestGroupBounds(point);

  if (hitResult) {
    window.kan.pinching = true;
    window.kan.pinchedGroup = hitResult;
    window.kan.lastScale = 1;
    window.kan.lastRotation = event.rotation;

    window.kan.originalPosition = hitResult.position;
    window.kan.originalRotation = hitResult.data.rotation;
    window.kan.originalScale = hitResult.data.scale;

    hitResult.bringToFront();

    if (hitResult.data.tut && hitResult.data.tut.length > 0) {
      let $tut = $(`.tut[data-tut-type='${hitResult.data.tut}']`);
      if ($tut) {
        window.kan.pinchedTut = $tut;
      } else {
        window.kan.pinchedTut = null;
      }
    } else {
      window.kan.pinchedTut = null;
    }

    // if (config.runAnimations) {
    //   hitResult.animate({
    //     properties: {
    //       scale: 1.25
    //     },
    //     settings: {
    //       duration: 100,
    //       easing: "easeOut",
    //     }
    //   });
    // }
  } else {
    window.kan.pinchedGroup = null;
    window.kan.pinchedTut = null;
    console.log('hit no item');
  }
}

function pinchMove(event) {
  console.log('pinchMove');
  // event.preventDefault();

  const viewWidth = paper.view.viewSize.width;
  const viewHeight = paper.view.viewSize.height;
  let pinchedGroup = window.kan.pinchedGroup;
  let $pinchedTut = window.kan.pinchedTut;

  if (!!pinchedGroup) {
    let currentScale = event.scale;
    let scaleDelta;

    tutorial.hideContextualTutByName('pinch');

    if (pinchedGroup.bounds.width < minShapeSize || pinchedGroup.bounds.height < minShapeSize) {
      // only allow a shape to scale down if it is larger than the minimum size
      scaleDelta = 1.1;
    } else if (pinchedGroup.bounds.width >= paper.view.viewSize.width ||
        pinchedGroup.bounds.height >= paper.view.viewSize.height) {
      // only allow shape to scale up if it fits in the viewport
      scaleDelta = 0.9;
    } else {
      scaleDelta = currentScale / window.kan.lastScale;
    }

    window.kan.lastScale = currentScale;

    let currentRotation = event.rotation;
    let rotationDelta = currentRotation - window.kan.lastRotation;
    window.kan.lastRotation = currentRotation;

    // console.log(`scaling by ${scaleDelta}`);
    // console.log(`rotating by ${rotationDelta}`);

    const centerPoint = event.center;
    pinchedGroup.position = centerPoint;
    if (!!$pinchedTut) {
      tutorial.moveContextualTut($pinchedTut, centerPoint);
    }

    if (scaleDelta !== 1) {
      pinchedGroup.scale(scaleDelta);

      // check if scaling went awry, cannot be too big or too small
      if (pinchedGroup.bounds.width >= paper.view.viewSize.width * maxScaleFactor ||
        pinchedGroup.bounds.height >= paper.view.viewSize.height * maxScaleFactor) {
        // shape is too big, bring it back down to size
        const bounds = pinchedGroup.bounds;
        if (bounds.width > bounds.height) {
          scaleDelta = paper.view.viewSize.width * maxScaleFactor / bounds.width;
        } else {
          scaleDelta = paper.view.viewSize.height * maxScaleFactor / bounds.height;
        }
        pinchedGroup.scale(scaleDelta);
      } else if (pinchedGroup.bounds.width <= minShapeSize || pinchedGroup.bounds.height <= minShapeSize) {
        if (bounds.width < bounds.height) {
          scaleDelta = minShapeSize / bounds.width;
        } else {
          scaleDelta = minShapeSize / bounds.width;
        }
        pinchedGroup.scale(scaleDelta);
      }
    }
    pinchedGroup.rotate(rotationDelta);

    pinchedGroup.data.scale *= scaleDelta;
    pinchedGroup.data.rotation += rotationDelta;
  }
}

function pinchEnd(event) {
  console.log('pinchend');
  // event.preventDefault();

  window.kan.lastEvent = event;
  let pinchedGroup = window.kan.pinchedGroup;
  let $pinchedTut = window.kan.pinchedTut;
  let originalPosition = window.kan.originalPosition;
  let originalRotation = window.kan.originalRotation;
  let originalScale = window.kan.originalScale;

  if (!!pinchedGroup) {
    pinchedGroup.data.fresh = true;
    let move = {
      id: pinchedGroup.id,
      type: 'transform'
    };
    if (pinchedGroup.position != originalPosition) {
      move.position = originalPosition;
    }

    if (pinchedGroup.data.rotation != originalRotation) {
      move.rotation = originalRotation - pinchedGroup.data.rotation;
    }

    if (pinchedGroup.data.scale != originalScale) {
      move.scale = originalScale / pinchedGroup.data.scale;
    }

    if (pinchedGroup.children.length > 0 && pinchedGroup._namedChildren.shapePath && pinchedGroup._namedChildren.shapePath.length > 0) {
      // update shapePath sound object if possible
      sound.removeShapeFromComposition(pinchedGroup); // sound is now wrong

      let shapePath = pinchedGroup._namedChildren.shapePath[0];
      let shapeSoundObj = sound.getShapeSoundObj(shapePath);
      window.kan.composition.push(shapeSoundObj);
    }

    window.kan.moves.push(move);

    if (Math.abs(event.velocity) > 1) {
      tutorial.hideContextualTutByName('swipe');

      // hide any connected tuts
      if (!!$pinchedTut) {
        tutorial.hideContextualTut($pinchedTut);
      }
      // dispose of group offscreen
      throwPinchedGroup();
    }

    // if (config.runAnimations) {
    //   pinchedGroup.animate({
    //     properties: {
    //       scale: 0.8
    //     },
    //     settings: {
    //       duration: 100,
    //       easing: "easeOut",
    //     }
    //   });
    // }
  } else {
    window.kan.pinchedGroup = null;
  }

  // if an overlay was interrupted, open it up now
  if (window.kan.scheduledOverlay !== null) {
    window.kan.scheduledOverlay = null;

    setTimeout(() => {
      overlays.openOverlay(window.kan.scheduledOverlay);
    }, timing.overlayDelay);
  }

  window.kan.pinching = false;

  console.log('pinch done');
  // hammerCanvas.set({ enable: false });
  setTimeout(() => {
    console.log('touch enabled');
    hammerCanvas.on('pinchstart', pinchStart);
    enablePanAndPinchEvents();
    enableTapEvents();
    // hammerCanvas.set({ enable: true });
    // hammerCanvas.on('pinchstart', pinchStart);
    // enablePanAndPinchEvents();
    // enableTapEvents();
    // window.kan.pinching = false;
    // window.kan.pinchedGroup = null;
  }, timing.inputDelay);
}

function pinchCancel(event) {
  console.log(event);
  event.srcEvent.stopPropagation();
  console.log('pinchcancel');
  // event.preventDefault();

  hammerCanvas.set({ enable: true });
  hammerCanvas.on('pinchstart', pinchStart);
  enablePanAndPinchEvents();
  enableTapEvents();

  window.kan.pinching = false;
}

function throwPinchedGroup() {
  const velocityMultiplier = 25;
  const lastEvent = window.kan.lastEvent;
  const viewWidth = paper.view.viewSize.width;
  const viewHeight = paper.view.viewSize.height;
  let pinchedGroup = window.kan.pinchedGroup;

  if (pinchedGroup === null) return;

  if (pinchedGroup.position.x <= 0 - pinchedGroup.bounds.width ||
      pinchedGroup.position.x >= viewWidth + pinchedGroup.bounds.width ||
      pinchedGroup.position.y <= 0 - pinchedGroup.bounds.height ||
      pinchedGroup.position.y >= viewHeight + pinchedGroup.bounds.height) {
        pinchedGroup.data.offScreen = true;
        pinchedGroup.visible = false;
        sound.removeShapeFromComposition(pinchedGroup);
        window.kan.pinchedGroup = null;
    return;
  }
  requestAnimationFrame(throwPinchedGroup);
  const newX = pinchedGroup.position.x + lastEvent.velocityX * velocityMultiplier;
  const newY = pinchedGroup.position.y + lastEvent.velocityY * velocityMultiplier;
  const newPos = new Point(newX, newY);
  pinchedGroup.position = newPos;
}

function eventTargetIsOnCanvas(event) {
  if (!event) return false;
  if (event.target != ui.canvas) return false;
  return true;

}
