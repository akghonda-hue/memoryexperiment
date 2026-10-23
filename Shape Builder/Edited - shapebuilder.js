"use strict";

(() => {
  const canvas = document.getElementById("shape-builder");
  const ctx = canvas.getContext("2d");
  const stimulusControls = document.getElementById("stimulus-controls");
  const stimulusModeInputs = [...document.querySelectorAll("input[name='stimulus-mode']")];
  const customImageUpload = document.getElementById("custom-image-upload");
  const customImageOrderUpload = document.getElementById("custom-image-order-upload");
  const polygonRefreshSelect = document.getElementById("polygon-refresh");
  const generatePolygonsButton = document.getElementById("generate-polygons");
  const stimulusStatus = document.getElementById("stimulus-status");

  const TAU = Math.PI * 2;
  const COLORS = [
    { name: "yellow", value: [255, 255, 0] },
    { name: "blue", value: [0, 0, 255] },
    { name: "red", value: [255, 0, 0] },
    { name: "green", value: [0, 255, 0] },
  ];
  const SHAPES = [
    {
      name: "California",
      points: [
        [0.147814, 0.149488],
        [0.364372, 0.158419],
        [0.402326, 0.350419],
        [0.661302, 0.549116],
        [0.668000, 0.723256],
        [0.250512, 0.488837],
        [0.105395, 0.247721],
      ],
    },

    {
      name: "Texas",
      points: [
        [0.029488, 0.323628],
        [0.248279, 0.323628],
        [0.239349, 0.102605],
        [0.451442, 0.098140],
        [0.467070, 0.321395],
        [0.688093, 0.334791],
        [0.721581, 0.506698],
        [0.540744, 0.555814],
        [0.473767, 0.714326],
        [0.319721, 0.582605],
        [0.304093, 0.500000],
        [0.196930, 0.508930],
        [0.136651, 0.419628],
      ],
    },

    {
      name: "Illinois",
      points: [
        [0.266140, 0.160651],
        [0.549674, 0.153954],
        [0.567535, 0.247721],
        [0.513953, 0.303535],
        [0.520651, 0.604930],
        [0.491628, 0.857209],
        [0.420186, 0.879535],
        [0.364372, 0.832651],
        [0.272837, 0.767907],
        [0.304093, 0.680837],
        [0.217023, 0.477674],
        [0.292930, 0.357116],
        [0.228186, 0.305767],
        [0.288465, 0.254419],
      ],
    },

    {
      name: "Maine",
      points: [
        [0.176837, 0.399535],
        [0.254977, 0.555814],
        [0.364372, 0.524558],
        [0.446977, 0.457581],
        [0.513953, 0.450884],
        [0.455907, 0.343721],
        [0.406791, 0.129395],
        [0.299628, 0.140558],
        [0.230419, 0.276744],
      ],
    },
  ];
  //Replacing the original shape definitions with a placeholder for brevity. The actual shape definitions would be included here.
  const SAME_COLOR = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ];
  const SAME_SHAPE = transpose(SAME_COLOR);

  const config = {
    numPracticeTrials: 2,
    writeData: true,
    startShapeDuration: 800,
    timeBetweenShapes: 1000,
  };

  const state = {
    phase: "instructions",
    timesThrough: 0,
    numTimesThrough: config.numPracticeTrials === 0 ? 1 : 2,
    trialNums: config.numPracticeTrials === 0 ? [26, 26] : [config.numPracticeTrials, 26],
    trialTypes: config.numPracticeTrials === 0 ? ["ExperimentalTrials", "ExperimentalTrials"] : ["Practice", "ExperimentalTrials"],
    trialType: "Practice",
    trialIndex: 0,
    curMemSize: 2,
    curMemTrial: 0,
    trialNum: 0,
    startShapeDuration: config.startShapeDuration,
    timeBetweenShapes: config.timeBetweenShapes,
    score: 0,
    displayedScore: 0,
    totalHighScore: 0,
    trial: null,
    selectedPositions: [],
    placedShapes: [],
    allScores: [],
    perfect: 0,
    dragging: null,
    hoverSquare: null,
    feedback: [],
    rows: [],
    mouseRows: [],
    finalScore: 0,
    participant: "",
    session: "",
    workstation: "",
    animationShift: 0,
    trialStartedAt: 0,
    dragAttemptsByShape: [],
    currentDragAttempt: 0,
    stimulusMode: "shapes",
    customImages: Array(16).fill(null),
    customImageUrls: Array(16).fill(null),
    customImageFiles: [],
    customImageOrder: [],
    polygons: [],
    polygonRefresh: "task",
  };

  const geometry = {
    width: 0,
    height: 0,
    scale: 1,
    centerX: 0,
    centerY: 0,
    grid: [],
    palette: [],
    buttons: {},
    scoreRect: null,
    scoreLabelY: 0,
    gridBounds: null,
    cellWidth: 0,
    cellHeight: 0,
    shapeSize: 0,
    paletteGap: 0,
  };

  class ShapeBuilder {
    constructor() {
      this.mouse = { x: 0, y: 0, down: false };
      this.lastFrame = performance.now();
      state.polygons = generatePolygonSet();
      this.resize();
      this.bindEvents();
      this.promptSessionInfo();
      this.syncStimulusControls();
      requestAnimationFrame((time) => this.frame(time));
    }

    promptSessionInfo() {
      state.workstation = safePrompt("Workstation:");
      state.session = safePrompt("Session:");
      state.participant = safePrompt("Participant:");
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.finish("Experiment ended.");
        }
        if (state.phase === "done" && event.code === "Space") {
          this.downloadData();
        }
      });
      canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
      canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
      canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
      canvas.addEventListener("pointercancel", (event) => this.pointerUp(event));
      stimulusModeInputs.forEach((input) => {
        input.addEventListener("change", () => {
          if (!input.checked) return;
          state.stimulusMode = input.value;
          this.syncStimulusControls();
        });
      });
      customImageUpload.addEventListener("change", () => this.loadCustomImages(customImageUpload.files));
      customImageOrderUpload.addEventListener("change", () => this.loadCustomImageOrder(customImageOrderUpload.files[0]));
      polygonRefreshSelect.addEventListener("change", () => {
        state.polygonRefresh = polygonRefreshSelect.value;
        this.syncStimulusControls();
      });
      generatePolygonsButton.addEventListener("click", () => {
        state.polygons = generatePolygonSet();
      });
    }

    loadCustomImages(files) {
      state.customImageFiles = [...files];
      this.applyCustomImageFiles();
      if (files.length) {
        state.stimulusMode = "images";
        stimulusModeInputs.forEach((input) => {
          input.checked = input.value === "images";
        });
      }
      this.syncStimulusControls();
    }

    async loadCustomImageOrder(file) {
      if (!file) return;
      state.customImageOrder = parseImageOrder(await file.text());
      this.applyCustomImageFiles();
      this.syncStimulusControls();
    }

    applyCustomImageFiles() {
      state.customImages.forEach((image) => {
        if (image?.src) URL.revokeObjectURL(image.src);
      });
      state.customImages = Array(16).fill(null);
      state.customImageUrls = Array(16).fill(null);

      const orderedFiles = orderedCustomImageFiles();
      const targetIds = state.customImageOrder.length ? paletteClockwiseShapeIds() : range(16);
      orderedFiles.slice(0, 16).forEach((file, index) => {
        const shapeId = targetIds[index];
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          state.customImages[shapeId] = image;
          this.syncStimulusControls();
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          state.customImageUrls[shapeId] = null;
          this.syncStimulusControls();
        };
        state.customImageUrls[shapeId] = url;
        image.src = url;
      });
    }

    syncStimulusControls() {
      const locked = !["instructions", "done"].includes(state.phase);
      canvas.classList.toggle("mouse-disabled", state.phase === "presentation");
      stimulusControls.classList.toggle("locked", locked);
      stimulusModeInputs.forEach((input) => {
        input.disabled = locked;
        input.checked = input.value === state.stimulusMode;
      });
      customImageUpload.disabled = locked;
      customImageOrderUpload.disabled = locked;
      polygonRefreshSelect.disabled = locked;
      generatePolygonsButton.disabled = locked || state.stimulusMode !== "polygons";
      const imageCount = loadedCustomImageCount();
      stimulusStatus.textContent = state.stimulusMode === "polygons"
        ? `${polygonRefreshSelect.value === "trial" ? "New each trial" : "Same for task"} polygons`
        : `${imageCount} of 16 images loaded${state.customImageOrder.length ? " with order" : ""}`;
    }

    resize() {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      geometry.width = window.innerWidth;
      geometry.height = window.innerHeight;
      geometry.centerX = geometry.width / 2;
      geometry.centerY = geometry.height / 2;
      const sideClearance = Math.min(geometry.width, geometry.height) * 0.08;
      const availableWidth = geometry.width - sideClearance * 2;
      const availableHeight = geometry.height - sideClearance * 2;
      const gridSize = Math.min(availableWidth * 0.48, availableHeight * 0.48, 520);
      geometry.scale = gridSize;
      geometry.cellWidth = gridSize / 4;
      geometry.cellHeight = geometry.cellWidth;
      geometry.shapeSize = geometry.cellWidth * 0.26;
      geometry.paletteGap = geometry.cellWidth * 0.72;

      const gridLeft = geometry.centerX - gridSize / 2;
      const gridTop = geometry.centerY - gridSize / 2;
      const xs = range(4).map((col) => gridLeft + geometry.cellWidth * (col + 0.5));
      const ys = range(4).map((row) => gridTop + geometry.cellHeight * (row + 0.5));
      geometry.grid = [];
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          geometry.grid.push({ x: xs[col], y: ys[row], index: row * 4 + col });
        }
      }
      geometry.gridBounds = {
        x: gridLeft,
        y: gridTop,
        width: gridSize,
        height: gridSize,
      };

      const palette = [];
      const topY = gridTop - geometry.paletteGap;
      const rightX = gridLeft + gridSize + geometry.paletteGap;
      const bottomY = gridTop + gridSize + geometry.paletteGap;
      const leftX = gridLeft - geometry.paletteGap;
      xs.forEach((x, i) => palette.push({ x, y: topY, colorIndex: 0, shapeIndex: i, id: i }));
      ys.forEach((y, i) => palette.push({ x: rightX, y, colorIndex: 1, shapeIndex: i, id: 4 + i }));
      xs.forEach((x, i) => palette.push({ x: x, y: bottomY, colorIndex: 2, shapeIndex: i, id: 8 + i }));
      ys.forEach((y, i) => palette.push({ x: leftX, y, colorIndex: 3, shapeIndex: i, id: 12 + i }));
      geometry.palette = palette;

      const buttonW = geometry.cellWidth * 2;
      const buttonH = geometry.cellHeight * 0.8;
      geometry.buttons.practice = {
        x: geometry.centerX - geometry.cellWidth * 1.6,
        y: bottomY + geometry.cellHeight * 0.9,
        width: buttonW,
        height: buttonH,
      };
      geometry.buttons.begin = {
        x: geometry.centerX + geometry.cellWidth * 1.6,
        y: bottomY + geometry.cellHeight * 0.9,
        width: buttonW,
        height: buttonH,
      };
      geometry.buttons.download = {
        x: geometry.centerX,
        y: geometry.centerY + geometry.cellHeight,
        width: buttonW * 1.45,
        height: buttonH,
      };
      geometry.scoreRect = {
        x: geometry.centerX,
        y: topY - geometry.cellHeight * 0.9,
        width: geometry.cellWidth * 2.5,
        height: geometry.cellHeight * 0.8,
      };
      geometry.scoreLabelY = geometry.scoreRect.y - geometry.cellHeight * 0.8;
    }

    pointerDown(event) {
      if (state.phase === "presentation") return;
      this.updatePointer(event);
      if (state.phase === "instructions") {
        if (state.timesThrough === 0 && config.numPracticeTrials > 0 && pointInRect(this.mouse, geometry.buttons.practice)) {
          state.numTimesThrough = 2;
          state.trialNums = [config.numPracticeTrials, 26];
          state.trialTypes = ["Practice", "ExperimentalTrials"];
          this.startBlock();
          return;
        }
        if (pointInRect(this.mouse, geometry.buttons.begin)) {
          if (state.timesThrough === 0) {
            state.numTimesThrough = 1;
            state.trialNums = [26, 26];
            state.trialTypes = ["ExperimentalTrials", "ExperimentalTrials"];
          }
          this.startBlock();
          return;
        }
      }

      if (state.phase === "response") {
        const picked = [...geometry.palette].reverse().find((shape) => distance(this.mouse, shape) <= geometry.shapeSize * 0.95);
        if (picked) {
          const shapeNumber = state.selectedPositions.length + 1;
          state.dragAttemptsByShape[shapeNumber - 1] = (state.dragAttemptsByShape[shapeNumber - 1] || 0) + 1;
          state.currentDragAttempt = state.dragAttemptsByShape[shapeNumber - 1];
          state.dragging = {
            id: picked.id,
            colorIndex: picked.colorIndex,
            shapeIndex: picked.shapeIndex,
            shapeNumber,
            dragAttempt: state.currentDragAttempt,
            x: this.mouse.x,
            y: this.mouse.y,
          };
          canvas.setPointerCapture(event.pointerId);
        }
      }

      if (state.phase === "done" && pointInRect(this.mouse, geometry.buttons.download)) {
        this.downloadData();
      }
    }

    pointerMove(event) {
      if (state.phase === "presentation") return;
      this.updatePointer(event);
      if (state.dragging) {
        state.dragging.x = this.mouse.x;
        state.dragging.y = this.mouse.y;
        state.hoverSquare = this.nearestAllowedSquare(this.mouse);
      }
    }

    pointerUp(event) {
      if (state.phase === "presentation") return;
      this.updatePointer(event);
      if (!state.dragging) return;
      const square = this.nearestAllowedSquare(this.mouse);
      if (square) {
        this.placeShape(state.dragging.id, square.index);
      }
      state.dragging = null;
      state.hoverSquare = null;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Some browsers release automatically on pointer cancel.
      }
    }

    updatePointer(event) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
      this.mouse.down = event.buttons > 0;
    }

    recordMouseFrame(timestamp) {
      if (!state.trial || !["presentation", "response", "scoring"].includes(state.phase)) return;
      const elapsedMs = Math.round(timestamp - state.trialStartedAt);
      const responseShapeNumber = Math.min(state.selectedPositions.length + 1, state.curMemSize);
      const shapeNumber = state.phase === "presentation"
        ? (state.trial.presentingIndex === null ? "" : state.trial.presentingIndex + 1)
        : responseShapeNumber;
      const dragAttempt = state.dragging
        ? state.dragging.dragAttempt
        : (shapeNumber ? state.dragAttemptsByShape[shapeNumber - 1] || 0 : "");
      state.mouseRows.push({
        trialNumber: state.trialNum,
        shapeNumber,
        dragAttempt,
        timestampMs: elapsedMs,
        x: Math.round(this.mouse.x),
        y: Math.round(this.mouse.y),
        phase: state.phase,
        mouseDown: this.mouse.down ? 1 : 0,
        draggingShape: state.dragging ? state.dragging.id : "",
        hoverSquare: state.hoverSquare ? state.hoverSquare.index : "",
      });
    }

    startBlock() {
      state.score = 0;
      state.displayedScore = 0;
      state.trialIndex = 0;
      state.trialNum = 0;
      state.curMemSize = 2;
      state.curMemTrial = 0;
      state.totalHighScore = 0;
      state.startShapeDuration = config.startShapeDuration;
      state.timeBetweenShapes = config.timeBetweenShapes;
      state.trialType = state.trialTypes[state.timesThrough];
      state.phase = "animation";
      this.runOpeningAnimation().then(() => this.startTrial());
    }

    async runOpeningAnimation() {
      const shifts = [0, 4, 8, 12];
      const durations = [250, 250, 250, 500];
      for (const duration of durations) {
        for (const shift of shifts) {
          state.animationShift = shift;
          await sleep(duration);
        }
      }
      state.animationShift = 0;
    }

    async startTrial() {
      if (state.trialIndex >= state.trialNums[state.timesThrough]) {
        state.timesThrough += 1;
        if (state.timesThrough < state.numTimesThrough) {
          state.phase = "instructions";
        } else {
          this.finish();
        }
        return;
      }

      state.phase = "presentation";
      state.polygonRefresh = polygonRefreshSelect.value;
      if (state.stimulusMode === "polygons" && polygonRefreshSelect.value === "trial") {
        state.polygons = generatePolygonSet();
      }
      state.trial = makeTrial(state.curMemSize, state.trialNum);
      state.trialStartedAt = performance.now();
      state.dragAttemptsByShape = Array(state.curMemSize).fill(0);
      state.currentDragAttempt = 0;
      state.selectedPositions = [];
      state.placedShapes = [];
      state.allScores = [];
      state.feedback = [];
      state.perfect = 0;
      await sleep(1000);

      for (let index = 0; index < state.trial.items.length; index += 1) {
        const item = state.trial.items[index];
        await sleep(state.timeBetweenShapes);
        state.trial.presenting = item;
        state.trial.presentingIndex = index;
        await sleep(state.startShapeDuration);
        state.trial.presenting = null;
        state.trial.presentingIndex = null;
      }

      state.phase = "response";
    }

    placeShape(shapeId, squareIndex) {
      const responseIndex = state.selectedPositions.length;
      const correct = state.trial.items[responseIndex];
      let curShapeVal = 0;

      if (squareIndex === correct.positionIndex) {
        if (shapeId === correct.shapeId) {
          curShapeVal = responseIndex === 0 || state.perfect === 0 ? 15 : state.allScores[responseIndex - 1] * 2;
          state.perfect = 1;
        } else if (correct.sameShape.includes(shapeId)) {
          curShapeVal = 10;
          state.perfect = 0;
        } else if (correct.sameColor.includes(shapeId)) {
          curShapeVal = 10;
          state.perfect = 0;
        } else {
          curShapeVal = 5;
          state.perfect = 0;
        }
      } else {
        state.perfect = 0;
      }

      state.score += curShapeVal;
      state.selectedPositions.push(squareIndex);
      state.placedShapes.push(shapeId);
      state.allScores.push(curShapeVal);
      state.feedback.push({
        shapeId,
        squareIndex,
        score: curShapeVal,
        expiresAt: performance.now() + 1500,
      });

      if (state.selectedPositions.length >= state.curMemSize) {
        this.completeTrial();
      }
    }

    async completeTrial() {
      state.phase = "scoring";
      const highScores = [15, 30, 60, 120];
      state.totalHighScore += highScores.slice(0, state.curMemSize).reduce((sum, value) => sum + value, 0);
      this.recordTrial();
      await sleep(500);
      await this.animateScore();

      state.curMemTrial += 1;
      state.trialNum += 1;
      state.trialIndex += 1;
      state.startShapeDuration -= 100;
      state.timeBetweenShapes -= 400;

      if ([3, 6, 9].includes(state.curMemTrial)) {
        state.timeBetweenShapes = 1000;
        state.startShapeDuration = 800;
      }
      if ([6, 15].includes(state.trialNum)) {
        state.curMemSize += 1;
        state.startShapeDuration = 1000;
        state.curMemTrial = 0;
      }
      this.startTrial();
    }

    async animateScore() {
      const delta = state.score - state.displayedScore;
      const increment = delta < 45 ? 1 : delta < 100 ? 5 : 10;
      const end = performance.now() + 1500;
      while (performance.now() < end && state.displayedScore < state.score) {
        state.displayedScore = Math.min(state.score, state.displayedScore + increment);
        await sleep(delta <= 0 ? 100 : Math.max(12, (750 / Math.max(delta, 1)) * 0.25));
      }
      state.displayedScore = state.score;
    }

    recordTrial() {
      if (!config.writeData) return;
      const row = {
        Trial: state.trialNum,
        CurrentMemorySetSize: state.curMemSize,
        TimeBetweenShapes: state.timeBetweenShapes / 1000,
        ShapeDuration: state.startShapeDuration / 1000,
        TrialType: state.trialType,
        CurrentScore: state.score,
        MaxScore_Trial: [15, 30, 60, 120].slice(0, state.curMemSize).reduce((sum, value) => sum + value, 0),
        MaxScore_Total: state.totalHighScore,
        StimulusMode: state.stimulusMode,
        CustomImageCount: loadedCustomImageCount(),
        CustomImageOrder: state.customImageOrder.join("|"),
        PolygonRefresh: state.polygonRefresh,
      };
      state.trial.items.forEach((item, index) => {
        row[`Shape_${index + 1}_DraggedTo`] = state.selectedPositions[index];
        row[`Shape_${index + 1}_Score`] = state.allScores[index];
        row[`Shape_${index + 1}_Placed`] = state.placedShapes[index];
        row[`Shape_${index + 1}_CorrectShape`] = item.shapeId;
        row[`Shape_${index + 1}_CorrectPosition`] = item.randomPositionIndex;
        item.sameColor.forEach((id, attrIndex) => {
          row[`Shape_${index + 1}_CorrectColors_${attrIndex + 1}`] = id;
        });
        item.sameShape.forEach((id, attrIndex) => {
          row[`Shape_${index + 1}_CorrectShapes_${attrIndex + 1}`] = id;
        });
      });
      state.rows.push(row);
    }

    nearestAllowedSquare(point) {
      let winner = null;
      let best = Infinity;
      for (const item of state.trial.positionOrder) {
        const square = geometry.grid[item.positionIndex];
        const d = distance(point, square);
        if (d < best) {
          best = d;
          winner = square;
        }
      }
      return best <= geometry.shapeSize * 1.35 ? winner : null;
    }

    finish(message = "You are done with the experiment. Press SPACEBAR or click Download Data to save the task data.") {
      state.finalScore = state.score;
      if (config.writeData) {
        state.rows.push({ FinalScore: state.finalScore });
      }
      state.phase = "done";
      state.dragging = null;
      state.trial = null;
      state.doneMessage = message;
    }

    downloadData() {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const participant = state.participant || "participant";
      downloadCsv(`${participant}_ShapeBuilder_${timestamp}.csv`, toCsv(state.rows));
      window.setTimeout(() => {
        downloadCsv(
          `${participant}_ShapeBuilder_mouse_${timestamp}.csv`,
          toCsv(state.mouseRows, ["trialNumber", "shapeNumber", "dragAttempt", "timestampMs", "x", "y", "phase", "mouseDown", "draggingShape", "hoverSquare"])
        );
      }, 100);
    }

    frame(time) {
      const dt = time - this.lastFrame;
      this.lastFrame = time;
      this.update(dt, time);
      this.draw(time);
      this.recordMouseFrame(time);
      requestAnimationFrame((nextTime) => this.frame(nextTime));
    }

    update(_dt, time) {
      state.feedback = state.feedback.filter((item) => item.expiresAt > time);
      this.syncStimulusControls();
    }

    draw() {
      drawBackground();
      drawBoard();
      drawScore();
      drawPalette();

      if (state.phase === "instructions") {
        drawInstructions();
      }
      if (state.phase === "presentation" && state.trial?.presenting) {
        drawMemoryShape(state.trial.presenting);
      }
      if (state.phase === "response" || state.phase === "scoring") {
        drawPlacedFeedback();
        if (state.hoverSquare && state.dragging) {
          drawHighlight(state.hoverSquare, COLORS[state.dragging.colorIndex].value);
        }
      }
      if (state.dragging) {
        drawShape(state.dragging.id, state.dragging.x, state.dragging.y, geometry.shapeSize, 1);
      }
      if (state.phase === "done") {
        drawDone();
      }
    }
  }

  function makeTrial(memorySize, trialNum) {
    const ranNumStim = shuffle(range(16));
    const allShapeTestRandom = shuffle(range(16));
    const colorShuffle = shuffle(range(4));
    const shapeShuffle = shuffle(range(4));
    const whatType = randInt(0, 2);
    const oneStep = [9, 10, 11, 18, 19, 20, 21, 22, 23];
    const allDiff = [3, 4, 5, 12, 13, 14, 24, 25];
    let changeIt;
    if (memorySize === 4 && [18, 19, 20].includes(trialNum)) {
      changeIt = shuffle([0, 2])[0];
    } else {
      changeIt = randInt(0, memorySize - 2);
    }

    let colorCursor = 0;
    let shapeCursor = 0;
    const items = [];
    for (let i = 0; i < memorySize; i += 1) {
      const colorIndex = colorShuffle[colorCursor];
      const shapeIndex = shapeShuffle[shapeCursor];
      if (whatType === 0) {
        if (allDiff.includes(trialNum) || (oneStep.includes(trialNum) && i === changeIt)) {
          colorCursor += 1;
          shapeCursor += 1;
        } else {
          shapeCursor += 1;
        }
      } else if (allDiff.includes(trialNum) || (oneStep.includes(trialNum) && i === changeIt)) {
        colorCursor += 1;
        shapeCursor += 1;
      } else {
        colorCursor += 1;
      }

      const shapeId = SAME_COLOR[colorIndex][shapeIndex];
      const randomPositionIndex = allShapeTestRandom[i];
      const positionIndex = randomPositionIndex;
      items.push({
        shapeId,
        colorIndex,
        shapeIndex,
        randomPositionIndex,
        positionIndex,
        sameColor: [...SAME_COLOR[colorIndex]],
        sameShape: [...SAME_SHAPE[shapeIndex]],
      });
    }

    return {
      items,
      ranNumStim,
      positionOrder: allShapeTestRandom.map((positionIndex) => ({ positionIndex })),
      presenting: null,
      presentingIndex: null,
    };
  }

  function drawBackground() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, geometry.width, geometry.height);
  }

  function drawBoard() {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#333";
    roundRect(geometry.gridBounds.x - 4, geometry.gridBounds.y - 4, geometry.gridBounds.width + 8, geometry.gridBounds.height + 8, 4, true, false);
    ctx.restore();

    ctx.fillStyle = "#000";
    ctx.fillRect(geometry.gridBounds.x, geometry.gridBounds.y, geometry.gridBounds.width, geometry.gridBounds.height);

    for (const square of geometry.grid) {
      ctx.fillStyle = "#707070";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.fillRect(square.x - geometry.cellWidth / 2, square.y - geometry.cellHeight / 2, geometry.cellWidth, geometry.cellHeight);
      ctx.strokeRect(square.x - geometry.cellWidth / 2, square.y - geometry.cellHeight / 2, geometry.cellWidth, geometry.cellHeight);
    }

    drawBorderPanels();
  }

  function drawBorderPanels() {
    const b = geometry.gridBounds;
    ctx.save();
    ctx.fillStyle = "#707070";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1;
    ctx.fillRect(b.x - geometry.cellWidth, b.y, geometry.cellWidth, b.height);
    ctx.strokeRect(b.x - geometry.cellWidth, b.y, geometry.cellWidth, b.height);
    ctx.fillRect(b.x + b.width, b.y, geometry.cellWidth, b.height);
    ctx.strokeRect(b.x + b.width, b.y, geometry.cellWidth, b.height);
    ctx.fillRect(b.x, b.y - geometry.cellHeight, b.width, geometry.cellHeight);
    ctx.strokeRect(b.x, b.y - geometry.cellHeight, b.width, geometry.cellHeight);
    ctx.fillRect(b.x, b.y + b.height, b.width, geometry.cellHeight);
    ctx.strokeRect(b.x, b.y + b.height, b.width, geometry.cellHeight);
    ctx.restore();
  }

  function drawScore() {
    const rect = geometry.scoreRect;
    ctx.fillStyle = "#747474";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.fillRect(rect.x - rect.width / 2, rect.y - rect.height / 2, rect.width, rect.height);
    ctx.strokeRect(rect.x - rect.width / 2, rect.y - rect.height / 2, rect.width, rect.height);
    drawText("Score", rect.x, geometry.scoreLabelY, geometry.cellHeight * 0.34, "#000", "center");
    drawText(String(Math.round(state.displayedScore)), rect.x, rect.y + geometry.cellHeight * 0.2, geometry.cellHeight * 0.47, "#cc3333", "center");
  }

  function drawPalette() {
    let palette = geometry.palette;
    if (state.phase === "animation" && state.animationShift) {
      const positions = geometry.palette.map((item) => ({ x: item.x, y: item.y }));
      palette = geometry.palette.map((item, index) => ({
        ...item,
        x: positions[(index + state.animationShift) % positions.length].x,
        y: positions[(index + state.animationShift) % positions.length].y,
      }));
    }
    const alpha = state.phase === "presentation" ? 0.25 : 1;
    for (const item of palette) {
      drawShape(item.id, item.x, item.y, geometry.shapeSize, alpha);
    }
  }

  function drawInstructions() {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.fillRect(
      geometry.centerX - geometry.cellWidth * 2,
      geometry.centerY - geometry.cellHeight * 2,
      geometry.cellWidth * 4,
      geometry.cellHeight * 4
    );
    ctx.restore();
    const instructions = "This task tests your ability to remember the order and spatial position in which a series of colored geometric shapes are presented. You will see between 2 and 4 shapes. Your job is to remember the order, spatial position, color, and shape of each item presented. After the final shape is presented, recreate the sequence by clicking on the correct colored shape and dragging it to the appropriate spatial position. The better you do the more points you will earn. The number of points you earn will increase the more you get correct without making a mistake. Click begin to start.";
    drawWrappedText(instructions, geometry.centerX, geometry.centerY - geometry.cellHeight * 0.35, geometry.cellWidth * 3.75, Math.max(14, geometry.cellWidth * 0.17), "#fff");

    if (state.timesThrough === 0 && config.numPracticeTrials > 0) {
      drawButton(geometry.buttons.practice, "Practice");
    }
    drawButton(geometry.buttons.begin, "Begin");
  }

  function drawMemoryShape(item) {
    const square = geometry.grid[item.positionIndex];
    drawShape(item.shapeId, square.x, square.y, geometry.shapeSize, 1);
  }

  function drawPlacedFeedback() {
    for (const feedback of state.feedback) {
      const square = geometry.grid[feedback.squareIndex];
      drawShape(feedback.shapeId, square.x, square.y, geometry.shapeSize, 1);
      drawText(String(feedback.score), square.x, square.y + geometry.shapeSize * 0.25, geometry.shapeSize * 0.8, "#000", "center");
    }
  }

  function drawHighlight(square, color) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = 6;
    ctx.strokeRect(square.x - geometry.cellWidth / 2, square.y - geometry.cellHeight / 2, geometry.cellWidth, geometry.cellHeight);
    ctx.restore();
  }

  function drawDone() {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#000";
    ctx.fillRect(geometry.centerX - geometry.cellWidth * 2.4, geometry.centerY - geometry.cellHeight * 1.7, geometry.cellWidth * 4.8, geometry.cellHeight * 3.4);
    ctx.restore();
    drawWrappedText(state.doneMessage, geometry.centerX, geometry.centerY - geometry.cellHeight * 0.45, geometry.cellWidth * 4.2, Math.max(16, geometry.cellWidth * 0.2), "#ff3333");
    drawButton(geometry.buttons.download, "Download Data");
  }

  function drawButton(rect, label) {
    ctx.fillStyle = "#005ce6";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4;
    ctx.fillRect(rect.x - rect.width / 2, rect.y - rect.height / 2, rect.width, rect.height);
    ctx.strokeRect(rect.x - rect.width / 2, rect.y - rect.height / 2, rect.width, rect.height);
    drawText(label, rect.x, rect.y + rect.height * 0.16, Math.max(14, rect.height * 0.48), "#fff", "center");
  }
    //Telling the program how to draw the shapes, images, and polygons. The shapes are drawn based on their shapeId, position (x, y), size, and alpha (transparency). If the stimulus mode is set to "images" and a custom image is available for the given shapeId, it will draw that image. If the stimulus mode is set to "polygons" and a polygon is available for the given shapeId, it will draw that polygon. Otherwise, it will draw one of four basic shapes (square, circle, triangle, diamond) based on the shapeId.
  function drawShape(shapeId, x, y, size, alpha) {
    if (state.stimulusMode === "images" && state.customImages[shapeId]) {
      drawCustomImage(state.customImages[shapeId], x, y, size, alpha);
      return;
    }
    if (state.stimulusMode === "polygons" && state.polygons[shapeId]) {
      drawPolygonStimulus(state.polygons[shapeId], x, y, size, alpha);
      return;
    }
    // Check if we should use my manually drawn shapes.
    const manualShape = SHAPES[shapeId % 4];

    // If the selected shape has at least 3 points,
    // draw my custom outline instead of a normal shape.
    if (state.stimulusMode === "shapes" && manualShape?.points?.length >= 3) {
    drawManualShape(
    manualShape.points,
    x, y, size, alpha,
    COLORS[Math.floor(shapeId / 4)].value
  );
  return;
}
//tells JavaScript to look for your custom outline before drawing one of the original shapes. It keeps the existing color system.
    const colorIndex = Math.floor(shapeId / 4);
    const shapeIndex = shapeId % 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgb(COLORS[colorIndex].value);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = Math.max(2, size * 0.12);
    if (shapeIndex === 0) {
      ctx.beginPath();
      ctx.rect(x - size * 0.7, y - size * 0.7, size * 1.4, size * 1.4);
      ctx.fill();
      ctx.stroke();
    } else if (shapeIndex === 1) {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.72, 0, TAU);
      ctx.fill();
      ctx.stroke();
    } else if (shapeIndex === 2) {
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.82);
      ctx.lineTo(x + size * 0.78, y + size * 0.72);
      ctx.lineTo(x - size * 0.78, y + size * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.82, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.82, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

// Draw my custom shape using the corner points I created.
function drawManualShape(points, x, y, size, alpha, color) {

  ctx.save();

  // Set the shape's appearance.
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgb(color);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(2, size * 0.12);

  // Start drawing the outline.
  ctx.beginPath();

  // Connect the points I created in the editor. 
  //Change the scaling factor (2.1) to adjust the size of the shape relative to the original size.
  points.forEach(([u, v], index) => {
    const px = x + (u - 0.5) * size * 2.1;
    const py = y + (v - 0.5) * size * 2.1;

    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });

  // Close the outline and color it in.
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}



  function drawCustomImage(image, x, y, size, alpha) {
    const maxSize = size * 1.85;
    const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
    ctx.restore();
  }

  function drawPolygonStimulus(polygon, x, y, size, alpha) {
    const points = polygon.points;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(size, size);

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.closePath();
    ctx.fillStyle = polygon.baseColor;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.1;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    points.forEach((point) => {
      ctx.moveTo(polygon.center[0], polygon.center[1]);
      ctx.lineTo(point[0], point[1]);
    });
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 0.035;
    ctx.stroke();
    ctx.restore();
  }

  function drawText(text, x, y, size, color, align) {
    ctx.fillStyle = color;
    ctx.font = `${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawWrappedText(text, x, y, maxWidth, lineHeight, color) {
    ctx.fillStyle = color;
    ctx.font = `${lineHeight}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight * 1.25) / 2;
    lines.forEach((textLine, index) => {
      ctx.fillText(textLine, x, startY + index * lineHeight * 1.25);
    });
  }

  function roundRect(x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function generatePolygonSet() {
    const shapePolygons = range(4).map((shapeIndex) => generatePolygonShape(shapeIndex));
    return range(16).map((index) => ({
      ...shapePolygons[index % 4],
      ...polygonColorSet(Math.floor(index / 4)),
    }));
  }

  function generatePolygonShape(shapeIndex) {
    const points = normalizePolygonArea(generateVariablePolygon(shapeIndex), 1.55);
    return {
      points,
      center: polygonCentroid(points),
    };
  }

  function generateVariablePolygon(shapeIndex) {
    const pointCounts = [5, 6, 7, 8];
    const points = [];
    const count = pointCounts[shapeIndex];
    const rotation = randFloat(0, TAU);
    const deepConcavityCount = shapeIndex === 0 ? 1 : shapeIndex === 1 ? 2 : shapeIndex === 2 ? 3 : 2;
    const concaveIndices = shuffle(range(count)).slice(0, deepConcavityCount);
    const stretchX = shapeIndex === 1 ? randFloat(1.05, 1.35) : shapeIndex === 3 ? randFloat(0.75, 0.95) : randFloat(0.9, 1.15);
    const stretchY = shapeIndex === 3 ? randFloat(1.12, 1.4) : shapeIndex === 1 ? randFloat(0.76, 0.98) : randFloat(0.9, 1.16);

    for (let index = 0; index < count; index += 1) {
      const angle = rotation + (index / count) * TAU + randFloat(-0.22, 0.22);
      const concave = concaveIndices.includes(index);
      const radius = concave ? randFloat(0.24, 0.5) : randFloat(0.78, 1.15);
      points.push([
        Math.cos(angle) * radius * stretchX,
        Math.sin(angle) * radius * stretchY,
      ]);
    }
    return points;
  }

  function normalizePolygonArea(points, targetArea) {
    const centroid = polygonCentroid(points);
    const centered = points.map(([x, y]) => [x - centroid[0], y - centroid[1]]);
    const area = Math.max(Math.abs(polygonArea(centered)), 0.001);
    const scale = Math.sqrt(targetArea / area);
    return centered.map(([x, y]) => [x * scale, y * scale]);
  }

  function polygonArea(points) {
    let sum = 0;
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      sum += point[0] * next[1] - next[0] * point[1];
    });
    return sum / 2;
  }

  function polygonCentroid(points) {
    return points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
      .map((value) => value / points.length);
  }

  function polygonColorSet(colorIndex) {
    const base = COLORS[colorIndex].value;
    return {
      highlightColor: rgb(mixColor(base, [255, 255, 255], 0.35)),
      baseColor: rgb(base),
      shadeColor: rgb(mixColor(base, [0, 0, 0], 0.28)),
      sideColor: rgb(mixColor(base, [0, 0, 0], 0.45)),
    };
  }

  function mixColor(color, target, amount) {
    return color.map((channel, index) => Math.round(channel + (target[index] - channel) * amount));
  }

  function orderedCustomImageFiles() {
    if (!state.customImageOrder.length) return [...state.customImageFiles];
    const byName = new Map(state.customImageFiles.map((file) => [normalizeFileName(file.name), file]));
    const used = new Set();
    const ordered = [];
    state.customImageOrder.forEach((name) => {
      const normalized = normalizeFileName(name);
      const file = byName.get(normalized);
      if (file && !used.has(file)) {
        ordered.push(file);
        used.add(file);
      }
    });
    state.customImageFiles.forEach((file) => {
      if (!used.has(file)) ordered.push(file);
    });
    return ordered;
  }

  function parseImageOrder(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((value) => String(value).trim()).filter(Boolean);
    } catch (_) {
      // Fall back to plain text parsing.
    }
    return trimmed
      .split(/[\n,]/)
      .map((name) => name.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  function paletteClockwiseShapeIds() {
    return [0, 1, 2, 3, 4, 5, 6, 7, 11, 10, 9, 8, 15, 14, 13, 12];
  }

  function normalizeFileName(name) {
    return name.split(/[\\/]/).pop().trim().toLowerCase();
  }

  function loadedCustomImageCount() {
    return state.customImages.filter(Boolean).length;
  }

  function safePrompt(label) {
    try {
      return window.prompt(label, "") || "";
    } catch (_) {
      return "";
    }
  }

  function range(n) {
    return Array.from({ length: n }, (_, index) => index);
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function randInt(min, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }

  function randFloat(min, max) {
    return min + Math.random() * (max - min);
  }

  function transpose(matrix) {
    return matrix[0].map((_, columnIndex) => matrix.map((row) => row[columnIndex]));
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointInRect(point, rect) {
    return point.x >= rect.x - rect.width / 2 &&
      point.x <= rect.x + rect.width / 2 &&
      point.y >= rect.y - rect.height / 2 &&
      point.y <= rect.y + rect.height / 2;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  function rgb(color) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }

  function downloadCsv(file, csv) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function toCsv(rows, preferredHeaders = null) {
    if (!rows.length && !preferredHeaders) return "";
    const headers = preferredHeaders || [...rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())];
    const escape = (value) => {
      if (value === undefined || value === null) return "";
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
    ].join("\n");
  }

  new ShapeBuilder();
})();