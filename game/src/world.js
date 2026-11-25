// The game's rules and state, with no drawing and no browser in it: the chef, the stations,
// the tickets, the plates, the coins and the streak. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react without the world knowing about screens
// or sound. Nothing here allocates after createWorld returns.
import {
  ANCHORS,
  BURN_AFTER,
  CHEF,
  CHOP,
  FIELD,
  FRY,
  GRILL,
  INGREDIENTS,
  LAYOUT,
  MODIFIERS,
  PERFECT_TIP,
  PLATE_MAX_ITEMS,
  PLATE_SLOTS,
  RECIPES,
  RUSH_AT,
  RUSH_BANNER_SECONDS,
  SHIFT_SECONDS,
  START_PLATES,
  STARS,
  STREAK_BONUS,
  STREAK_BONUS_AT,
  TICKET,
  WASH_SECONDS,
} from './config.js';

export const EVENT_SERVE = 1;
export const EVENT_PERFECT = 2;
export const EVENT_WALKOUT = 4;
export const EVENT_BURN = 8;
export const EVENT_OVER = 16;
export const EVENT_PICKUP = 32;
export const EVENT_CHOP = 64;
export const EVENT_PLATE = 128;
export const EVENT_WASH = 256;
export const EVENT_TRASH = 512;
export const EVENT_USE = 1024;

/** The exact multiset of items a ticket wants, after its modifier. */
export function ticketNeeds(ticket) {
  const recipe = RECIPES.find((r) => r.id === ticket.recipe);
  const needs = [...recipe.needs];
  if (ticket.modifier) {
    const mod = MODIFIERS.find((m) => m.id === ticket.modifier);
    for (const gone of mod.remove) {
      const at = needs.indexOf(gone);
      if (at !== -1) needs.splice(at, 1);
    }
    needs.push(...mod.extra);
  }
  return needs;
}

export function recipeOf(ticket) {
  return RECIPES.find((r) => r.id === ticket.recipe);
}

/** True when the plate's items are exactly the ticket's needs, order aside. */
export function plateMatchesPlate(items, needs) {
  if (items.length !== needs.length) return false;
  const rest = [...needs];
  for (const item of items) {
    const at = rest.indexOf(item);
    if (at === -1) return false;
    rest.splice(at, 1);
  }
  return rest.length === 0;
}

function solidRects() {
  const rects = [LAYOUT.island];
  for (const b of LAYOUT.boards) rects.push(b);
  rects.push(LAYOUT.grill, LAYOUT.fryer);
  rects.push(LAYOUT.plates, LAYOUT.plating, LAYOUT.trash, LAYOUT.sink);
  return rects;
}

const SOLIDS = solidRects();

function hitsSolid(x, y) {
  const r = CHEF.radius - 2;
  for (const s of SOLIDS) {
    if (x + r > s.x && x - r < s.x + s.width && y + r > s.y && y - r < s.y + s.height) return true;
  }
  return false;
}

export function createWorld(random) {
  const chef = { x: 640, y: 520, dir: 1, moving: false, target: null, washT: 0, hands: [null, null] };
  const boards = [
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
  ];
  const grill = [
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
  ];
  const fryer = [
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
    { item: null, out: null, t: 0, dur: 0, state: 'empty' },
  ];
  const plates = [null, null, null];
  const state = {
    chef,
    boards,
    grill,
    fryer,
    plates,
    tickets: [],
    popups: [],
    banner: null,
    elapsed: 0,
    coins: 0,
    served: 0,
    perfect: 0,
    streak: 0,
    bestStreak: 0,
    walkedOut: 0,
    cleanPlates: START_PLATES,
    dirtyPlates: 0,
    rush: false,
    over: false,
    stars: 0,
    spawnTimer: TICKET.firstAt,
    nextTicketId: 1,
    sizzleSlots: 0,
  };

  function reset() {
    chef.x = 640;
    chef.y = 520;
    chef.dir = 1;
    chef.moving = false;
    chef.target = null;
    chef.washT = 0;
    chef.hands = [null, null];
    for (const b of boards) {
      b.item = null;
      b.out = null;
      b.t = 0;
      b.dur = 0;
      b.state = 'empty';
    }
    for (const slot of [...grill, ...fryer]) {
      slot.item = null;
      slot.out = null;
      slot.t = 0;
      slot.dur = 0;
      slot.state = 'empty';
    }
    plates[0] = null;
    plates[1] = null;
    plates[2] = null;
    state.tickets = [];
    state.popups = [];
    state.banner = null;
    state.elapsed = 0;
    state.coins = 0;
    state.served = 0;
    state.perfect = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.walkedOut = 0;
    state.cleanPlates = START_PLATES;
    state.dirtyPlates = 0;
    state.rush = false;
    state.over = false;
    state.stars = 0;
    state.spawnTimer = TICKET.firstAt;
    state.nextTicketId = 1;
    state.sizzleSlots = 0;
  }

  function freeHand() {
    if (!chef.hands[0]) return 0;
    if (!chef.hands[1]) return 1;
    return -1;
  }

  function addPopup(x, y, text, sub, color) {
    state.popups.push({ x, y, text, sub: sub || '', color, t: 0, life: 1.7 });
    if (state.popups.length > 6) state.popups.shift();
  }

  function unlockedRecipes() {
    return RECIPES.filter((r) => r.unlock <= state.elapsed);
  }

  function spawnTicket() {
    const pool = unlockedRecipes();
    const recipe = pool[Math.floor(random() * pool.length)];
    let modifier = null;
    if (random() < 0.3) {
      const options = MODIFIERS.filter((m) => {
        if (m.id === 'noLettuce') return recipe.needs.includes('choppedLettuce');
        if (m.id === 'doublePatty') return recipe.needs.includes('grilledPatty');
        return true;
      });
      if (options.length > 0) modifier = options[Math.floor(random() * options.length)].id;
    }
    const patience = state.rush ? TICKET.rushPatience : TICKET.patience;
    state.tickets.push({
      id: state.nextTicketId,
      recipe: recipe.id,
      modifier,
      patience,
      maxPatience: patience,
      hurry: false,
    });
    state.nextTicketId += 1;
  }

  function nearestStation() {
    const cx = chef.x;
    const cy = chef.y;
    let best = null;
    let bestD = CHEF.reach;
    function consider(station, x, y) {
      const d = Math.hypot(cx - x, cy - y);
      if (d <= bestD) {
        bestD = d;
        best = station;
      }
    }
    for (const bin of ANCHORS.bins) consider({ type: 'bin', kind: bin.kind }, bin.x, bin.y);
    for (const board of ANCHORS.boards) consider({ type: 'board', index: board.index }, board.x, board.y);
    consider({ type: 'grill' }, ANCHORS.grill.x, ANCHORS.grill.y);
    consider({ type: 'fryer' }, ANCHORS.fryer.x, ANCHORS.fryer.y);
    consider({ type: 'serve' }, ANCHORS.serve.x, ANCHORS.serve.y);
    for (const slot of ANCHORS.plating) consider({ type: 'plating', slot: slot.slot }, slot.x, slot.y);
    consider({ type: 'trash' }, ANCHORS.trash.x, ANCHORS.trash.y);
    consider({ type: 'sink' }, ANCHORS.sink.x, ANCHORS.sink.y);
    return best;
  }

  function takeFromCooker(slots, table) {
    for (const slot of slots) {
      if (slot.state === 'ready' || slot.state === 'burnt') {
        const hand = freeHand();
        if (hand === -1) return 'full';
        chef.hands[hand] = { kind: slot.state === 'burnt' ? 'burnt' : slot.out };
        slot.item = null;
        slot.out = null;
        slot.t = 0;
        slot.dur = 0;
        slot.state = 'empty';
        return 'took';
      }
    }
    for (let hand = 0; hand < 2; hand += 1) {
      const held = chef.hands[hand];
      if (held && held.kind !== 'plate' && table[held.kind]) {
        const slot = slots.find((s) => s.state === 'empty');
        if (!slot) return 'busy';
        const spec = table[held.kind];
        slot.item = held.kind;
        slot.out = spec.out;
        slot.dur = spec.seconds;
        slot.t = 0;
        slot.state = 'cooking';
        chef.hands[hand] = null;
        return 'placed';
      }
    }
    return 'busy';
  }

  function interact() {
    const station = nearestStation();
    if (!station) return 0;
    let events = EVENT_USE;
    if (station.type === 'bin') {
      const hand = freeHand();
      if (hand === -1) return events;
      chef.hands[hand] = { kind: station.kind };
      return events | EVENT_PICKUP;
    }
    if (station.type === 'board') {
      const board = boards[station.index];
      if (board.state === 'done') {
        const hand = freeHand();
        if (hand === -1) return events;
        chef.hands[hand] = { kind: board.out };
        board.item = null;
        board.out = null;
        board.t = 0;
        board.dur = 0;
        board.state = 'empty';
        return events | EVENT_PICKUP;
      }
      if (board.state === 'empty') {
        for (let hand = 0; hand < 2; hand += 1) {
          const held = chef.hands[hand];
          if (held && held.kind !== 'plate' && CHOP[held.kind]) {
            board.item = held.kind;
            board.out = CHOP[held.kind].out;
            board.dur = CHOP[held.kind].seconds;
            board.t = 0;
            board.state = 'chopping';
            chef.hands[hand] = null;
            return events | EVENT_CHOP;
          }
        }
      }
      return events;
    }
    if (station.type === 'grill') {
      const result = takeFromCooker(grill, GRILL);
      if (result === 'took') return events | EVENT_PICKUP;
      if (result === 'placed') return events | EVENT_USE;
      return events;
    }
    if (station.type === 'fryer') {
      const result = takeFromCooker(fryer, FRY);
      if (result === 'took') return events | EVENT_PICKUP;
      if (result === 'placed') return events | EVENT_USE;
      return events;
    }
    if (station.type === 'plating') {
      const slot = station.slot;
      const plate = plates[slot];
      const handWithPlate = chef.hands[0] && chef.hands[0].kind === 'plate' ? 0 : chef.hands[1] && chef.hands[1].kind === 'plate' ? 1 : -1;
      const handWithItem = chef.hands[0] && chef.hands[0].kind !== 'plate' ? 0 : chef.hands[1] && chef.hands[1].kind !== 'plate' ? 1 : -1;
      if (handWithPlate !== -1 && !plate) {
        plates[slot] = { items: [...chef.hands[handWithPlate].items] };
        chef.hands[handWithPlate] = null;
        return events | EVENT_PLATE;
      }
      if (handWithItem !== -1) {
        if (!plate) {
          if (state.cleanPlates <= 0) {
            addPopup(525, 560, 'No clean plates!', 'wash some at the sink', '#e5534b');
            return events;
          }
          state.cleanPlates -= 1;
          plates[slot] = { items: [chef.hands[handWithItem].kind] };
          chef.hands[handWithItem] = null;
          return events | EVENT_PLATE;
        }
        if (plate.items.length >= PLATE_MAX_ITEMS) return events;
        plate.items.push(chef.hands[handWithItem].kind);
        chef.hands[handWithItem] = null;
        return events | EVENT_PLATE;
      }
      if (handWithItem === -1 && handWithPlate === -1 && plate) {
        const hand = freeHand();
        if (hand === -1) return events;
        chef.hands[hand] = { kind: 'plate', items: [...plate.items] };
        plates[slot] = null;
        return events | EVENT_PICKUP;
      }
      return events;
    }
    if (station.type === 'serve') {
      const handWithPlate = chef.hands[0] && chef.hands[0].kind === 'plate' ? 0 : chef.hands[1] && chef.hands[1].kind === 'plate' ? 1 : -1;
      if (handWithPlate === -1) return events;
      const plate = chef.hands[handWithPlate];
      let match = null;
      for (const ticket of state.tickets) {
        if (plateMatchesPlate(plate.items, ticketNeeds(ticket))) {
          match = ticket;
          break;
        }
      }
      if (!match) {
        addPopup(ANCHORS.serve.x, ANCHORS.serve.y + 40, 'No order matches!', 'check the tickets', '#e5534b');
        return events;
      }
      const recipe = recipeOf(match);
      const isPerfect = match.patience > match.maxPatience / 2;
      let earned = recipe.price + (isPerfect ? PERFECT_TIP : 0);
      if (state.streak >= STREAK_BONUS_AT) earned += STREAK_BONUS;
      state.coins += earned;
      state.served += 1;
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      if (isPerfect) state.perfect += 1;
      state.tickets.splice(state.tickets.indexOf(match), 1);
      state.dirtyPlates += 1;
      chef.hands[handWithPlate] = null;
      addPopup(ANCHORS.serve.x, ANCHORS.serve.y + 40, `+$${earned}`, isPerfect ? 'PERFECT!' : state.streak >= STREAK_BONUS_AT ? `STREAK x${state.streak}` : recipe.name, '#f2c94c');
      return events | EVENT_SERVE | (isPerfect ? EVENT_PERFECT : 0);
    }
    if (station.type === 'trash') {
      for (let hand = 0; hand < 2; hand += 1) {
        const held = chef.hands[hand];
        if (held) {
          if (held.kind === 'plate') state.dirtyPlates += 1;
          chef.hands[hand] = null;
          return events | EVENT_TRASH;
        }
      }
      return events;
    }
    if (station.type === 'sink') {
      return events;
    }
    return events;
  }

  function moveChef(mx, my, dt) {
    const len = Math.hypot(mx, my);
    if (len < 0.01) {
      chef.moving = false;
      return;
    }
    const nx = mx / len;
    const ny = my / len;
    chef.dir = nx < -0.1 ? -1 : nx > 0.1 ? 1 : chef.dir;
    chef.moving = true;
    const stepX = nx * CHEF.speed * dt;
    const stepY = ny * CHEF.speed * dt;
    const tryX = Math.min(FIELD.width - CHEF.radius, Math.max(CHEF.radius, chef.x + stepX));
    if (!hitsSolid(tryX, chef.y)) chef.x = tryX;
    const tryY = Math.min(560 - CHEF.radius, Math.max(172 + CHEF.radius, chef.y + stepY));
    if (!hitsSolid(chef.x, tryY)) chef.y = tryY;
  }

  /**
   * One fixed step. `input` is { mx, my, use, useHold, target } where mx/my steer the chef,
   * `use` is an edge-triggered E press and `useHold` is E held down. With `harmless` set (the
   * title screen's backdrop) the kitchen idles: no tickets, no timers, nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (harmless) {
      for (const popup of state.popups) popup.t += dt;
      state.popups = state.popups.filter((p) => p.t < p.life);
      return events;
    }
    if (state.over) {
      for (const popup of state.popups) popup.t += dt;
      state.popups = state.popups.filter((p) => p.t < p.life);
      return events;
    }
    state.elapsed += dt;
    if (!state.rush && state.elapsed >= RUSH_AT) {
      state.rush = true;
      state.banner = { text: 'RUSH HOUR!', t: 0 };
      state.spawnTimer = Math.min(state.spawnTimer, 2);
    }
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t > RUSH_BANNER_SECONDS) state.banner = null;
    }

    // Chef movement: keys steer directly; a click target steers until reached.
    if (input.target) chef.target = input.target;
    let mx = input.mx;
    let my = input.my;
    if ((mx !== 0 || my !== 0) && chef.target) {
      chef.target = null;
    }
    if (mx === 0 && my === 0 && chef.target) {
      const dx = chef.target.x - chef.x;
      const dy = chef.target.y - chef.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        chef.target = null;
      } else {
        mx = dx / d;
        my = dy / d;
      }
    }
    moveChef(mx, my, dt);

    // Chop boards finish their work.
    for (const board of boards) {
      if (board.state === 'chopping') {
        board.t += dt;
        if (board.t >= board.dur) {
          board.state = 'done';
          board.t = 0;
        }
      }
    }
    // Grill and fryer cook, then burn.
    state.sizzleSlots = 0;
    for (const slot of [...grill, ...fryer]) {
      if (slot.state === 'cooking') {
        state.sizzleSlots += 1;
        slot.t += dt;
        if (slot.t >= slot.dur) {
          slot.state = 'ready';
          slot.t = 0;
        }
      } else if (slot.state === 'ready') {
        state.sizzleSlots += 1;
        slot.t += dt;
        if (slot.t >= BURN_AFTER) {
          slot.state = 'burnt';
          slot.t = 0;
          events |= EVENT_BURN;
          addPopup(1064, 200, 'Burnt!', 'trash it', '#e5534b');
        }
      }
    }

    // The sink: hold E beside it to wash one dirty plate.
    const near = nearestStation();
    if (input.useHold && near && near.type === 'sink' && state.dirtyPlates > 0) {
      chef.washT += dt;
      if (chef.washT >= WASH_SECONDS) {
        chef.washT = 0;
        state.dirtyPlates -= 1;
        state.cleanPlates += 1;
        events |= EVENT_WASH;
      }
    } else {
      chef.washT = 0;
    }

    if (input.use) events |= interact();

    // Tickets arrive, lose patience, and walk out.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.tickets.length < TICKET.maxOpen) {
      spawnTicket();
      state.spawnTimer = (state.rush ? TICKET.rushSpawn : TICKET.spawn) + random() * 2 - 1;
    }
    for (let i = state.tickets.length - 1; i >= 0; i -= 1) {
      const ticket = state.tickets[i];
      ticket.patience -= dt;
      if (!ticket.hurry && ticket.patience <= TICKET.hurryAt) {
        ticket.hurry = true;
        events |= EVENT_USE;
      }
      if (ticket.patience <= 0) {
        state.tickets.splice(i, 1);
        state.streak = 0;
        state.walkedOut += 1;
        events |= EVENT_WALKOUT;
        addPopup(525, 110, 'Walked out!', 'ticket lost', '#e5534b');
      }
    }

    for (const popup of state.popups) popup.t += dt;
    state.popups = state.popups.filter((p) => p.t < p.life);

    if (state.elapsed >= SHIFT_SECONDS) {
      state.over = true;
      state.stars = state.coins >= STARS.three ? 3 : state.coins >= STARS.two ? 2 : 1;
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    interact,
    nearestStation,
    moveChef,
    ingredients: INGREDIENTS,
  };
}
