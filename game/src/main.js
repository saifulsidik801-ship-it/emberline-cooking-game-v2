// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between four screens: title, play, paused and shift complete.
//
// ?seed=N fixes the ticket pattern. ?shot=rush|plating|rushhour|burnt (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. A normal visit sets window.__gameReady once the first frame is painted.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURN, EVENT_CHOP, EVENT_OVER, EVENT_PERFECT, EVENT_PICKUP, EVENT_PLATE, EVENT_SERVE, EVENT_TRASH, EVENT_WALKOUT, EVENT_WASH } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_USE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, world.state.elapsed);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let gameReady = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Serve every ticket before it walks out.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(`Shift complete. Coins ${world.state.coins}. Served ${world.state.served}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_SERVE) {
      if (events & EVENT_PERFECT) audio.perfect();
      else audio.ding();
    }
    if (events & EVENT_WALKOUT) audio.walkout();
    if (events & EVENT_BURN) audio.buzz();
    if (events & EVENT_CHOP) audio.chop();
    if (events & (EVENT_PICKUP | EVENT_PLATE)) audio.pickup();
    if (events & EVENT_TRASH) audio.buzz();
    if (events & EVENT_WASH) audio.ding();
    if (events & EVENT_OVER) endGame();
    audio.setSizzle(world.state.sizzleSlots);
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, use: false, useHold: false, target: null }, true);
      return;
    }
    const keys = input.keys();
    const target = input.takeTarget();
    const use = (actions & ACTION_USE) !== 0;
    const inputState = { mx: keys.x, my: keys.y, use, useHold: input.useHeld(), target };
    const events = world.step(STEP, inputState, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // The use press counts once per frame, even when the loop catches up several steps.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, 0, now / 1000);
    if (!gameReady) {
      gameReady = true;
      window.__gameReady = true;
    }
  }

  // Leaving the tab pauses a running game rather than letting tickets walk out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberline. Press Enter or click to start cooking.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
