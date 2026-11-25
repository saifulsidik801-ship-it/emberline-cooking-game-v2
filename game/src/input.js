// Keyboard and pointer input. Held keys steer the chef; one-shot presses (use a station,
// pause) are queued as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. A click sets a walk target: the chef walks there, and a
// click on a station walks there and uses it on arrival.

export const ACTION_USE = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const USE = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let useHeld = false;
  let target = null;
  let targetStation = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (USE.has(event.code)) {
      useHeld = true;
      if (!event.repeat) actions |= ACTION_USE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (USE.has(event.code)) useHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    useHeld = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    target = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
    targetStation = null;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised steering from held keys: -1, 0 or 1 on each axis. */
    keys() {
      return { x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Whether the use key (E) is held down right now (for washing at the sink). */
    useHeld() {
      return useHeld;
    },
    /** The click-to-move target, if the player clicked since the last take. */
    takeTarget() {
      const taken = target;
      target = null;
      return taken;
    },
    /** Clear a stale click target (the chef arrived, or the player took over with keys). */
    clearTarget() {
      target = null;
      targetStation = null;
    },
    hasTarget() {
      return target !== null;
    },
    /** The station a click asked the chef to walk to and use. */
    setTargetStation(station) {
      targetStation = station;
    },
    takeTargetStation() {
      const taken = targetStation;
      targetStation = null;
      return taken;
    },
  };
}
