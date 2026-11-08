// Each palette has a paper color and 5 paint colors, written as [hue, saturation, brightness]
const PALETTES = [
  { name: 'Sunset',    paper: [35, 8, 95],   colors: [[8,70,90],[22,80,95],[42,70,95],[335,55,75],[270,40,55]] },
  { name: 'Sea glass', paper: [160, 6, 95],  colors: [[170,45,70],[185,50,80],[200,40,65],[150,30,80],[215,55,50]] },
  { name: 'Ink wash',  paper: [40, 5, 94],   colors: [[0,0,12],[220,10,30],[220,8,50],[30,10,65],[10,70,75]] },
  { name: 'Meadow',    paper: [60, 8, 94],   colors: [[95,45,65],[75,55,75],[130,40,50],[50,60,90],[345,45,80]] },
  { name: 'Midnight',  paper: [235, 40, 14], colors: [[200,60,90],[265,50,85],[320,55,90],[170,55,85],[45,60,95]] },
  { name: 'Earth',     paper: [38, 10, 92],  colors: [[18,65,65],[32,60,75],[45,50,80],[8,50,45],[100,25,55]] }
];

let strokes = [];      // all the strokes currently being drawn
let colors = [];       // the paint colors for this painting
let paper;             // the background color
let paletteNum = 0;
let time = 0;          // slowly goes up, so the flow keeps changing
let flowScale = 0.002; // small = long curves, big = tight swirls
let paused = false;

function setup() {
  const stage = document.getElementById('stage');
  createCanvas(stage.clientWidth, stage.clientHeight).parent('stage');
  colorMode(HSB, 360, 100, 100, 100);
  document.getElementById('fs').onclick = e => { toggleFull(); e.target.blur(); };
  document.addEventListener('fullscreenchange', () => setTimeout(fitStage, 80));
  newPainting();
}

function newPainting() {
  noiseSeed(random(1000000));        // new random flow
  flowScale = random(0.0008, 0.005); // random curviness

  // pick a random palette (not the same one twice in a row)
  let next = floor(random(PALETTES.length));
  if (next === paletteNum) next = (next + 1) % PALETTES.length;
  paletteNum = next;
  const p = PALETTES[paletteNum];

  // shift every hue a little so no two paintings match
  const shift = random(-10, 10);
  colors = p.colors.map(c => [(c[0] + shift + 360) % 360, c[1], c[2]]);
  paper = p.paper;
  background(paper);
  document.getElementById('mode').textContent = p.name;

  strokes = [];
  for (let i = 0; i < 70; i++) strokes.push(new Stroke(random(width), random(height), false));

  // fast-forward a bit so the painting already has paint on it when it appears
  for (let step = 0; step < 120; step++) {
    time += 0.0025;
    moveStrokes();
  }
}

class Stroke {
  constructor(x, y, small) {
    this.pos = createVector(x, y);
    this.prev = this.pos.copy();
    this.size = small ? random(6, 18) : random(10, 46);
    this.color = random(colors);
    this.age = 0;
    this.life = random(90, 320);   // how many frames it lasts
    // each stroke is a few thin "bristle" lines side by side
    this.bristles = [];
    for (let i = 0; i < 7; i++) this.bristles.push(random(-0.5, 0.5));
  }

  // moves the stroke one step, returns false when it is finished
  update() {
    // noise() gives a smooth direction from where the stroke is
    const angle = noise(this.pos.x * flowScale, this.pos.y * flowScale, time) * TWO_PI * 2;
    this.prev.set(this.pos);
    this.pos.add(cos(angle) * 3, sin(angle) * 3);
    this.age++;

    // starts thin, gets thick in the middle, thin again at the end
    const fade = sin(PI * this.age / this.life);
    const sideX = cos(angle + HALF_PI);
    const sideY = sin(angle + HALF_PI);
    for (const b of this.bristles) {
      const offset = b * this.size * fade;
      stroke(this.color[0], this.color[1], this.color[2], 45 * fade + 5);
      strokeWeight(max(0.6, this.size * fade / 5));
      line(this.prev.x + sideX * offset, this.prev.y + sideY * offset,
           this.pos.x + sideX * offset,  this.pos.y + sideY * offset);
    }

    const offScreen = this.pos.x < -50 || this.pos.x > width + 50 || this.pos.y < -50 || this.pos.y > height + 50;
    return this.age < this.life && !offScreen;
  }
}

function draw() {
  if (paused) return;
  time += 0.0025;
  moveStrokes();
}

function moveStrokes() {
  for (let i = 0; i < strokes.length; i++) {
    // when a stroke ends, replace it with a new one somewhere random
    if (!strokes[i].update()) strokes[i] = new Stroke(random(width), random(height), false);
  }
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function mouseDragged() {
  if (!mouseInCanvas()) return;
  for (let i = 0; i < 3; i++) strokes.push(new Stroke(mouseX + random(-10, 10), mouseY + random(-10, 10), true));
  if (strokes.length > 220) strokes.splice(70, strokes.length - 220); // don't let it get too many
}

// a double-click is two quick presses, so event.detail is 2 on the second one
function mousePressed(event) {
  if (mouseInCanvas() && event.detail === 2) newPainting();
}

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('shifting-strokes', 'png');
  if (key === 'f' || key === 'F') toggleFull();
  if (key === ' ') { paused = !paused; return false; }
  if (keyCode === ESCAPE && document.getElementById('stage').classList.contains('full')) toggleFull();
}

// resizing clears the canvas, so start a new painting at the new size
function fitStage() {
  const stage = document.getElementById('stage');
  if (stage.clientWidth === width && stage.clientHeight === height) return;
  resizeCanvas(stage.clientWidth, stage.clientHeight);
  newPainting();
}

function windowResized() { fitStage(); }

function toggleFull() {
  const stage = document.getElementById('stage');
  if (document.fullscreenElement || stage.classList.contains('full')) {
    if (document.fullscreenElement) document.exitFullscreen();
    stage.classList.remove('full');
    setTimeout(fitStage, 60);
    return;
  }
  // if the browser won't allow real fullscreen, just fill the window instead
  const fillWindow = () => { stage.classList.add('full'); setTimeout(fitStage, 60); };
  if (stage.requestFullscreen) stage.requestFullscreen().catch(fillWindow);
  else fillWindow();
}