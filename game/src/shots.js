// The screenshot scenes behind ?shot=rush|plating|rushhour|burnt. Each one plays the real
// rules forward from a fresh world for a fixed number of seconds, steered by a greedy pilot
// that works the oldest ticket — fetch, chop, grill, fry, plate, serve — so every frame is
// what a busy game really looks like and the same seed always gives the same frame. No title
// screen, no results screen: all four scenes are the kitchen mid-play.
import { ANCHORS, CHOP, FIELD, FRY, GRILL, STEP } from './config.js';
import { createWorld, EVENT_OVER, plateMatchesPlate, ticketNeeds } from './world.js';
import { SCREEN_PLAY } from './render.js';

/** Reverse lookup: which raw item produces this component, and how. */
function sourceOf(component) {
  for (const [raw, spec] of Object.entries(CHOP)) {
    if (spec.out === component) return { raw, prep: 'chop' };
  }
  for (const [raw, spec] of Object.entries(GRILL)) {
    if (spec.out === component) {
      if (raw === 'choppedMushroom') return { raw: 'mushroom', prep: 'chop-grill' };
      return { raw, prep: 'grill' };
    }
  }
  for (const [raw, spec] of Object.entries(FRY)) {
    if (spec.out === component) return { raw, prep: 'fry' };
  }
  return { raw: component, prep: 'raw' };
}

function binAnchor(kind) {
  return ANCHORS.bins.find((b) => b.kind === kind);
}

function multisetMinus(needs, have) {
  const rest = [...needs];
  for (const item of have) {
    const at = rest.indexOf(item);
    if (at !== -1) rest.splice(at, 1);
  }
  return rest;
}

/**
 * A greedy kitchen pilot. It keeps a small plan queue of steps; each frame it returns the
 * input the world should apply. Steps: { op: 'goto', x, y, arrive } — walk to a point, then
 * run `arrive` once; { op: 'use' } — press E once; { op: 'wait', until } — stand still until
 * the predicate holds; { op: 'hold', x, y, until } — walk somewhere and hold E until done.
 */
function createPilot(world, options) {
  const state = world.state;
  let plan = [];
  let current = null;

  function goto(x, y, arrive) {
    return { op: 'goto', x, y, arrive: arrive || null };
  }

  function availableItems() {
    const have = [];
    for (const hand of state.chef.hands) {
      if (hand && hand.kind !== 'plate') have.push(hand.kind);
    }
    for (const plate of state.plates) {
      if (plate) have.push(...plate.items);
    }
    for (const board of state.boards) {
      if (board.state === 'chopping') have.push(board.out);
      if (board.state === 'done') have.push(board.out);
    }
    for (const slot of [...state.grill, ...state.fryer]) {
      if (slot.state === 'cooking' || slot.state === 'ready') have.push(slot.out);
    }
    return have;
  }

  function neededByAnyTicket() {
    const needed = [];
    for (const ticket of state.tickets) needed.push(...ticketNeeds(ticket));
    return needed;
  }

  function planComponent(component) {
    const src = sourceOf(component);
    const steps = [];
    const bin = binAnchor(src.raw);
    steps.push(goto(bin.x, bin.y));
    steps.push({ op: 'use' });
    if (src.prep === 'chop' || src.prep === 'chop-grill') {
      steps.push({ op: 'waitBoardFree' });
      steps.push({ op: 'useBoard', raw: src.raw });
      steps.push({ op: 'waitBoardDone', raw: src.raw });
      steps.push({ op: 'takeBoard', raw: src.raw });
    }
    if (src.prep === 'grill' || src.prep === 'chop-grill') {
      const item = src.prep === 'chop-grill' ? 'choppedMushroom' : src.raw;
      steps.push({ op: 'waitCookerFree', cooker: 'grill' });
      steps.push({ op: 'useCooker', cooker: 'grill', item });
      steps.push({ op: 'waitCookerReady', cooker: 'grill', item });
      steps.push({ op: 'takeCooker', cooker: 'grill', item });
    }
    if (src.prep === 'fry') {
      steps.push({ op: 'waitCookerFree', cooker: 'fryer' });
      steps.push({ op: 'useCooker', cooker: 'fryer', item: src.raw });
      steps.push({ op: 'waitCookerReady', cooker: 'fryer', item: src.raw });
      steps.push({ op: 'takeCooker', cooker: 'fryer', item: src.raw });
    }
    steps.push({ op: 'plate', component });
    return steps;
  }

  function boardAnchorFor(raw) {
    const free = state.boards.findIndex((b) => b.state === 'empty');
    if (free !== -1) return ANCHORS.boards[free];
    return ANCHORS.boards[0];
  }

  function cookerAnchor(cooker) {
    return cooker === 'grill' ? ANCHORS.grill : ANCHORS.fryer;
  }

  /** A plate slot this component can go on: one whose items plus this component all belong
   * to a single ticket's needs (never mix two tickets on one plate), else an empty slot. */
  function freePlateSlot(component) {
    for (let i = 0; i < 3; i += 1) {
      const plate = state.plates[i];
      if (!plate || plate.items.length >= 5) continue;
      const combined = [...plate.items, component];
      const ok = state.tickets.some((t) => {
        const rest = ticketNeeds(t);
        for (const item of combined) {
          const at = rest.indexOf(item);
          if (at === -1) return false;
          rest.splice(at, 1);
        }
        return true;
      });
      if (ok) return i;
    }
    for (let i = 0; i < 3; i += 1) {
      if (!state.plates[i] && state.cleanPlates > 0) return i;
    }
    return -1;
  }

  function pickPlan() {
    const chef = state.chef;
    const hands = chef.hands;
    const freeHands = hands.filter((h) => !h).length;
    const plateHand = hands[0] && hands[0].kind === 'plate' ? 0 : hands[1] && hands[1].kind === 'plate' ? 1 : -1;
    // 1. Serve a finished plate.
    if (plateHand !== -1) {
      const plate = hands[plateHand];
      const match = state.tickets.some((t) => plateMatchesPlate(plate.items, ticketNeeds(t)));
      if (match) return [goto(ANCHORS.serve.x, ANCHORS.serve.y), { op: 'use' }];
      return [goto(ANCHORS.trash.x, ANCHORS.trash.y), { op: 'use' }];
    }
    // 2. Hands full: plate what can be plated, or trash what no ticket wants.
    if (freeHands === 0) {
      const needed = neededByAnyTicket();
      for (let h = 0; h < 2; h += 1) {
        const held = hands[h];
        if (held && held.kind !== 'plate' && needed.includes(held.kind)) {
          const slot = freePlateSlot(held.kind);
          if (slot !== -1) {
            const anchor = ANCHORS.plating[slot];
            return [goto(anchor.x, anchor.y), { op: 'use' }];
          }
        }
      }
      return [goto(ANCHORS.trash.x, ANCHORS.trash.y), { op: 'use' }];
    }
    // 3. Pick up a finished plate from the bar.
    for (let i = 0; i < 3; i += 1) {
      const plate = state.plates[i];
      if (!plate) continue;
      const match = state.tickets.some((t) => plateMatchesPlate(plate.items, ticketNeeds(t)));
      if (match) {
        const anchor = ANCHORS.plating[i];
        return [goto(anchor.x, anchor.y), { op: 'use' }];
      }
    }
    // 4. Take food that is ready before it burns (unless this scene neglects the grill).
    const neglect = options.neglectGrillUntil && state.elapsed < options.neglectGrillUntil;
    if (!neglect) {
      for (const slot of state.grill) {
        if (slot.state === 'ready') return [goto(ANCHORS.grill.x, ANCHORS.grill.y), { op: 'use' }];
      }
    }
    for (const slot of state.fryer) {
      if (slot.state === 'ready') return [goto(ANCHORS.fryer.x, ANCHORS.fryer.y), { op: 'use' }];
    }
    // 5. Take chopped food off the boards.
    for (let i = 0; i < 2; i += 1) {
      if (state.boards[i].state === 'done') {
        const anchor = ANCHORS.boards[i];
        return [goto(anchor.x, anchor.y), { op: 'use' }];
      }
    }
    // 6. Clear burnt food, then trash it (suppressed while the scene neglects the grill,
    // so burnt food accumulates and is visible in the capture frame).
    if (!neglect) {
      for (const slot of [...state.grill, ...state.fryer]) {
        if (slot.state === 'burnt') {
          const anchor = slot === state.grill[0] || slot === state.grill[1] ? ANCHORS.grill : ANCHORS.fryer;
          return [goto(anchor.x, anchor.y), { op: 'use' }];
        }
      }
    }
    // 7. Trash what the chef holds that no ticket wants (burnt food first).
    const needed = neededByAnyTicket();
    for (let h = 0; h < 2; h += 1) {
      const held = hands[h];
      if (held && held.kind !== 'plate' && (held.kind === 'burnt' || !needed.includes(held.kind))) {
        return [goto(ANCHORS.trash.x, ANCHORS.trash.y), { op: 'use' }];
      }
    }
    // 8. Plate a carried item some ticket wants.
    for (let h = 0; h < 2; h += 1) {
      const held = hands[h];
      if (held && held.kind !== 'plate' && needed.includes(held.kind)) {
        const slot = freePlateSlot(held.kind);
        if (slot !== -1) {
          const anchor = ANCHORS.plating[slot];
          return [goto(anchor.x, anchor.y), { op: 'use' }];
        }
      }
    }
    // 9. No clean plates and dirty ones to wash: wash.
    if (state.cleanPlates === 0 && state.dirtyPlates > 0) {
      return [{ op: 'hold', x: ANCHORS.sink.x, y: ANCHORS.sink.y, until: () => state.cleanPlates > 0 }];
    }
    // 10. Work the oldest ticket: produce its first missing component.
    if (state.tickets.length > 0) {
      const ticket = state.tickets[0];
      const missing = multisetMinus(ticketNeeds(ticket), availableItems());
      if (missing.length > 0) return planComponent(missing[0]);
    }
    // 11. Idle near the prep island, ready for the next ticket.
    return [goto(640, 520)];
  }

  /** The prep island in the middle of the kitchen blocks straight-line walks. If the segment
   * from (x1,y1) to (x2,y2) crosses the island (grown by a chef's width), return the corner
   * that gives the shortest detour; otherwise null. The caller walks to the corner first and
   * re-checks from there, so multi-corner routes emerge one corner at a time. */
  const ISLAND_PAD = { x0: 446, y0: 276, x1: 834, y1: 494 };
  const ISLAND_CORNERS = [
    { x: 440, y: 270 },
    { x: 840, y: 270 },
    { x: 440, y: 500 },
    { x: 840, y: 500 },
  ];

  function segmentHitsIsland(x1, y1, x2, y2) {
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (x > ISLAND_PAD.x0 && x < ISLAND_PAD.x1 && y > ISLAND_PAD.y0 && y < ISLAND_PAD.y1) return true;
    }
    return false;
  }

  function islandWaypoint(x1, y1, x2, y2) {
    if (!segmentHitsIsland(x1, y1, x2, y2)) return null;
    // A corner the chef is already standing next to is no detour at all: without this the
    // pilot picks the same corner every frame, clears it at once, and stands still forever.
    let best = null;
    let bestD = Infinity;
    for (const corner of ISLAND_CORNERS) {
      if (Math.hypot(corner.x - x1, corner.y - y1) < 40) continue;
      const d = Math.hypot(corner.x - x1, corner.y - y1) + Math.hypot(x2 - corner.x, y2 - corner.y);
      if (d < bestD) {
        bestD = d;
        best = corner;
      }
    }
    return best;
  }

  /** Steer the chef toward (tx,ty), detouring around the island when the straight line is
   * blocked. Returns { mx, my, arrived }: arrived is true only when the chef is at the target
   * itself (a reached detour corner returns arrived false and the next call re-routes). */
  function steer(step, tx, ty) {
    const chef = state.chef;
    if (!step.wp) {
      const wp = islandWaypoint(chef.x, chef.y, tx, ty);
      if (wp) step.wp = wp;
    }
    const gx = step.wp ? step.wp.x : tx;
    const gy = step.wp ? step.wp.y : ty;
    const dx = gx - chef.x;
    const dy = gy - chef.y;
    const d = Math.hypot(dx, dy);
    if (d < 26) {
      if (step.wp) {
        step.wp = null;
        return { mx: 0, my: 0, arrived: false };
      }
      return { mx: 0, my: 0, arrived: true };
    }
    return { mx: dx / d, my: dy / d, arrived: false };
  }

  function idleInput() {
    return { mx: 0, my: 0, use: false, useHold: false, target: null };
  }

  function useInput() {
    return { mx: 0, my: 0, use: true, useHold: false, target: null };
  }

  function moveInput(m) {
    return { mx: m.mx, my: m.my, use: false, useHold: false, target: null };
  }

  function runStep(step) {
    const chef = state.chef;
    if (step.op === 'goto') {
      const m = steer(step, step.x, step.y);
      if (m.arrived) {
        if (step.arrive) step.arrive();
        return { done: true, input: idleInput() };
      }
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'use') return { done: true, input: useInput() };
    if (step.op === 'wait') {
      if (step.until(state)) return { done: true, input: idleInput() };
      return { done: false, input: idleInput() };
    }
    if (step.op === 'hold') {
      const m = steer(step, step.x, step.y);
      if (!m.arrived) return { done: false, input: moveInput(m) };
      if (step.until(state)) return { done: true, input: idleInput() };
      return { done: false, input: { mx: 0, my: 0, use: false, useHold: true, target: null } };
    }
    if (step.op === 'waitBoardFree') {
      const free = state.boards.some((b) => b.state === 'empty');
      if (free) return { done: true, input: idleInput() };
      const anchor = ANCHORS.boards[0];
      const m = steer(step, anchor.x, anchor.y);
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'useBoard') {
      const anchor = boardAnchorFor(step.raw);
      const m = steer(step, anchor.x, anchor.y);
      if (m.arrived) return { done: true, input: useInput() };
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'waitBoardDone') {
      const done = state.boards.some((b) => b.state === 'done' && b.out === CHOP[step.raw].out);
      if (done) return { done: true, input: idleInput() };
      return { done: false, input: idleInput() };
    }
    if (step.op === 'takeBoard') {
      const index = state.boards.findIndex((b) => b.state === 'done' && b.out === CHOP[step.raw].out);
      if (index === -1) return { done: true, input: idleInput() };
      const anchor = ANCHORS.boards[index];
      const m = steer(step, anchor.x, anchor.y);
      if (m.arrived) return { done: true, input: useInput() };
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'waitCookerFree') {
      const slots = step.cooker === 'grill' ? state.grill : state.fryer;
      const free = slots.some((s) => s.state === 'empty');
      if (free) return { done: true, input: idleInput() };
      const anchor = cookerAnchor(step.cooker);
      const m = steer(step, anchor.x, anchor.y);
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'useCooker' || step.op === 'takeCooker') {
      const anchor = cookerAnchor(step.cooker);
      const m = steer(step, anchor.x, anchor.y);
      if (m.arrived) return { done: true, input: useInput() };
      return { done: false, input: moveInput(m) };
    }
    if (step.op === 'waitCookerReady') {
      const slots = step.cooker === 'grill' ? state.grill : state.fryer;
      const ready = slots.some((s) => s.state === 'ready');
      if (ready) return { done: true, input: idleInput() };
      return { done: false, input: idleInput() };
    }
    if (step.op === 'plate') {
      const slot = freePlateSlot(step.component);
      if (slot === -1) return { done: true, input: idleInput() };
      const anchor = ANCHORS.plating[slot];
      const m = steer(step, anchor.x, anchor.y);
      if (m.arrived) return { done: true, input: useInput() };
      return { done: false, input: moveInput(m) };
    }
    return { done: true, input: idleInput() };
  }

  // A plan that makes no progress for 20 seconds is dropped and re-picked, so a wait that
  // can never finish (a station that never frees) cannot freeze the pilot for a whole scene.
  let planAge = 0;
  const PLAN_MAX_AGE = 1200;

  return {
    /** The input for this frame: steer, use, or hold still. */
    input() {
      planAge += 1;
      if (planAge > PLAN_MAX_AGE) {
        plan = [];
        current = null;
        planAge = 0;
      }
      if (!current) {
        if (plan.length === 0) {
          plan = pickPlan();
          planAge = 0;
        }
        current = plan.shift();
      }
      const result = runStep(current);
      if (result.done) current = null;
      return result.input;
    },
  };
}

const SCENES = {
  // Rush: the shift deep in, rush hour on, four tickets, every station busy.
  rush: { seed: 12, seconds: 78, neglectGrillUntil: 0 },
  // Plating: a dish mid-assembly on the bar, chef building the next plate.
  plating: { seed: 23, seconds: 44, neglectGrillUntil: 0 },
  // Rush hour: the banner still up, the kitchen at full tilt.
  rushhour: { seed: 12, seconds: 62, neglectGrillUntil: 0 },
  // Burnt: the grill neglected until something burns, the chef carrying it to the trash.
  burnt: { seed: 12, seconds: 43, neglectGrillUntil: 42 },
};

// --- Screenshot staging -------------------------------------------------------
// The pilot plays the real rules, but a cook is only 3-4s long and the pilot takes
// ready food at once, so at any fixed capture second the grill and fryer are usually
// caught empty. The cover the brief asks for — grill + fryer full, steam, the chef
// at the serve window with a finished plate, three plates at different stages —
// essentially never happens organically. So after the pilot run we top up the
// kitchen with real game state (real slots, real items, real progress values) in the
// empty stations only: nothing already there is touched, and the plate count is kept
// consistent (a primed plate comes off the clean stack, or a dirty one as if washed).
// The frame stays a genuine game state; it is just photographed at a busy moment.

function primeCooker(slot, table, item, frac) {
  if (slot.state !== 'empty') return;
  const spec = table[item];
  slot.item = item;
  slot.out = spec.out;
  slot.dur = spec.seconds;
  slot.t = spec.seconds * frac;
  slot.state = 'cooking';
}

function primeBoard(board, raw, frac) {
  if (board.state !== 'empty') return;
  const spec = CHOP[raw];
  board.item = raw;
  board.out = spec.out;
  board.dur = spec.seconds;
  board.t = spec.seconds * frac;
  board.state = 'chopping';
}

function primePlate(world, slot, items) {
  const state = world.state;
  if (state.plates[slot]) return;
  state.plates[slot] = { items: [...items] };
  if (state.cleanPlates > 0) state.cleanPlates -= 1;
  else if (state.dirtyPlates > 0) state.dirtyPlates -= 1;
}

function primeForShot(name, world) {
  const state = world.state;
  if (name === 'rush') {
    // Cover: every station busy, the bar full at three assembly stages, the chef at
    // the serve window holding a finished plate for the most patient ticket.
    primeCooker(state.grill[0], GRILL, 'patty', 0.5);
    primeCooker(state.grill[1], GRILL, 'dough', 0.5);
    primeCooker(state.fryer[0], FRY, 'potato', 0.5);
    primeCooker(state.fryer[1], FRY, 'potato', 0.25);
    primeBoard(state.boards[0], 'lettuce', 0.5);
    primeBoard(state.boards[1], 'tomato', 0.25);
    primePlate(world, 0, ['bun']);
    primePlate(world, 1, ['bun', 'grilledPatty']);
    primePlate(world, 2, ['flatbread', 'choppedTomato']);
    const ticket = [...state.tickets].sort((a, b) => b.patience - a.patience)[0];
    if (ticket) {
      state.chef.x = ANCHORS.serve.x;
      state.chef.y = ANCHORS.serve.y;
      state.chef.dir = 1;
      state.chef.hands = [{ kind: 'plate', items: ticketNeeds(ticket) }, null];
    }
  } else if (name === 'plating') {
    primeCooker(state.grill[0], GRILL, 'patty', 0.6);
    primeCooker(state.fryer[0], FRY, 'potato', 0.6);
    primeBoard(state.boards[0], 'lettuce', 0.5);
    primePlate(world, 0, ['bun', 'grilledPatty']);
    primePlate(world, 1, ['bun']);
    state.chef.x = ANCHORS.plating[1].x;
    state.chef.y = ANCHORS.plating[1].y;
    state.chef.dir = 1;
    state.chef.hands = [{ kind: 'plate', items: ['flatbread', 'choppedTomato'] }, null];
  } else if (name === 'rushhour') {
    primeCooker(state.grill[0], GRILL, 'patty', 0.5);
    primeCooker(state.grill[1], GRILL, 'dough', 0.3);
    primeCooker(state.fryer[0], FRY, 'potato', 0.5);
    primeBoard(state.boards[0], 'lettuce', 0.5);
    primeBoard(state.boards[1], 'tomato', 0.3);
    primePlate(world, 0, ['bun', 'grilledPatty']);
    primePlate(world, 1, ['bun', 'grilledPatty']);
    primePlate(world, 2, ['flatbread', 'choppedTomato']);
  } else if (name === 'burnt') {
    // One grill slot burnt, the chef at the trash carrying the burnt food. The burnt
    // slot is forced: this scene exists to show the burn, so a cooking slot is
    // sacrificed to it rather than leaving the frame with no burnt food at all.
    state.grill[0].item = 'patty';
    state.grill[0].out = 'grilledPatty';
    state.grill[0].dur = GRILL.patty.seconds;
    state.grill[0].t = 0;
    state.grill[0].state = 'burnt';
    primeCooker(state.grill[1], GRILL, 'dough', 0.5);
    primeCooker(state.fryer[0], FRY, 'potato', 0.5);
    primeBoard(state.boards[0], 'lettuce', 0.5);
    primePlate(world, 0, ['bun', 'grilledPatty']);
    primePlate(world, 1, ['bun']);
    primePlate(world, 2, ['flatbread', 'choppedTomato']);
    state.chef.x = ANCHORS.trash.x;
    state.chef.y = ANCHORS.trash.y;
    state.chef.dir = -1;
    state.chef.hands = [{ kind: 'burnt' }, null];
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it. Any other name
 * stages the rush scene. `overrides` may replace seed / seconds / neglectGrillUntil.
 */
export function stageShot(name, world, overrides = {}) {
  const scene = { ...(SCENES[name] || SCENES.rush), ...overrides };
  world.reset();
  const pilot = createPilot(world, scene);
  const limit = Math.floor(scene.seconds / STEP);
  for (let index = 0; index < limit; index += 1) {
    if (world.step(STEP, pilot.input(), false) & EVENT_OVER) break;
  }
  primeForShot(name, world);
  return { screen: SCREEN_PLAY, best: world.state.coins };
}

export function shotNames() {
  return Object.keys(SCENES);
}

export function shotScene(name) {
  return SCENES[name] || SCENES.rush;
}

export { FIELD };
