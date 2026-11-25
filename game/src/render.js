// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. The kitchen is drawn station by station: header tickets, ingredient bins, the serve
// window, chop boards, the brick oven, the fryer, the prep island, the plating bar, the trash
// and the sink, then the chef, then the HUD popups. `now` is the animation clock in seconds.
import { ANCHORS, FIELD, FONT, ITEM_LABEL, LAYOUT, PALETTE, PLATE_SLOTS, RECIPES, RUSH_BANNER_SECONDS, TICKET } from './config.js';
import { drawChef, drawEmbers, drawFlame, drawItem, drawPlate, drawSteam } from './foodart.js';
import { recipeOf, ticketNeeds } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function formatTime(seconds) {
  const left = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function panel(x, y, w, h, fill, edge) {
    roundRect(x, y, w, h, 10);
    context.fillStyle = fill;
    context.fill();
    if (edge) {
      context.strokeStyle = edge;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function progressRing(x, y, r, frac, color) {
    context.strokeStyle = 'rgba(0,0,0,0.35)';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = color;
    context.beginPath();
    context.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    context.stroke();
  }

  function drawFloor(state, now) {
    const tile = 56;
    for (let ty = 0; ty < 11; ty += 1) {
      for (let tx = 0; tx < 23; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * tile, 96 + ty * tile, tile, tile);
      }
    }
    // Warm firelight washing the floor from the oven, stronger in rush hour.
    const glow = context.createRadialGradient(1160, 255, 20, 1160, 255, 420);
    glow.addColorStop(0, `rgba(255,122,47,${state.rush ? 0.22 : 0.13})`);
    glow.addColorStop(1, 'rgba(255,122,47,0)');
    context.fillStyle = glow;
    context.fillRect(700, 96, 580, 480);
    void now;
  }

  function drawHeader(state) {
    context.fillStyle = PALETTE.header;
    context.fillRect(0, 0, FIELD.width, 96);
    context.fillStyle = PALETTE.headerEdge;
    context.fillRect(0, 94, FIELD.width, 2);
    // Brand.
    drawFlame(context, 40, 58, 16, state.elapsed, 1);
    text('EMBERLINE', 62, 34, 24, PALETTE.text, 'left', '800');
    text('WOOD-FIRED KITCHEN', 62, 56, 11, PALETTE.muted, 'left', '700');
    text(`DAY 1`, 62, 76, 11, PALETTE.coin, 'left', '700');
    // Tickets.
    const tickets = state.tickets;
    for (let i = 0; i < 4; i += 1) {
      const x = 190 + i * 176;
      const ticket = tickets[i];
      if (!ticket) {
        roundRect(x, 8, 168, 80, 8);
        context.fillStyle = 'rgba(255,255,255,0.07)';
        context.fill();
        text('No tickets —', x + 84, 42, 12, 'rgba(255,255,255,0.45)', 'center');
        text('next order coming…', x + 84, 60, 12, 'rgba(255,255,255,0.45)', 'center');
        continue;
      }
      const recipe = recipeOf(ticket);
      const frac = Math.max(0, ticket.patience / ticket.maxPatience);
      const hurry = ticket.hurry && Math.floor(state.elapsed * 2) % 2 === 0;
      panel(x, 8, 168, 80, hurry ? '#ffe3df' : PALETTE.ticket, hurry ? PALETTE.hurry : PALETTE.ticketEdge);
      text(`#${i + 1}`, x + 8, 26, 11, '#8a6a42', 'left', '800');
      text(recipe.name, x + 30, 26, 13, PALETTE.ticketText, 'left', '800');
      text(`$${recipe.price}`, x + 160, 26, 13, '#7a5a1e', 'right', '800');
      if (ticket.modifier) {
        const label = ticket.modifier === 'extraCheese' ? '+ extra cheese' : ticket.modifier === 'noLettuce' ? 'no lettuce' : 'double patty';
        roundRect(x + 8, 32, 82, 16, 8);
        context.fillStyle = '#f2b544';
        context.fill();
        text(label, x + 49, 44, 10, '#3a2a18', 'center', '700');
      }
      if (ticket.hurry) {
        text('HURRY!', x + 160, 44, 11, PALETTE.hurry, 'right', '800');
      }
      const needs = ticketNeeds(ticket);
      for (let n = 0; n < needs.length && n < 5; n += 1) {
        drawItem(context, needs[n], x + 22 + n * 30, 62, 34, state.elapsed);
      }
      if (needs.length > 5) text(`+${needs.length - 5}`, x + 22 + 5 * 30, 66, 11, PALETTE.ticketText, 'left', '700');
      // Patience bar.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(x + 8, 78, 152, 6);
      context.fillStyle = frac > 0.5 ? '#7dc383' : frac > 0.25 ? '#f2b544' : '#e5534b';
      context.fillRect(x + 8, 78, 152 * frac, 6);
    }
    // Timer, coins, streak.
    const left = 150 - state.elapsed;
    text('SHIFT', 920, 24, 11, PALETTE.muted, 'left', '700');
    text(formatTime(left), 920, 58, 34, state.rush ? '#ffb02e' : PALETTE.text, 'left', '800');
    if (state.rush) text('RUSH!', 920, 80, 12, '#ff7a2f', 'left', '800');
    context.fillStyle = PALETTE.coin;
    context.beginPath();
    context.arc(1108, 34, 14, 0, Math.PI * 2);
    context.fill();
    text('$', 1108, 39, 16, '#7a5a1e', 'center', '800');
    text(`${state.coins}`, 1130, 40, 28, PALETTE.text, 'left', '800');
    if (state.streak >= 2) {
      roundRect(1100, 52, 150, 26, 13);
      context.fillStyle = '#e5534b';
      context.fill();
      text(`STREAK x${state.streak}`, 1175, 70, 14, '#fff', 'center', '800');
    } else {
      text(`Served ${state.served}`, 1100, 70, 13, PALETTE.muted, 'left');
    }
  }

  function drawBins(state) {
    for (let i = 0; i < 8; i += 1) {
      const bin = ANCHORS.bins[i];
      const x = LAYOUT.bins.x + i * (LAYOUT.bins.width + LAYOUT.bins.gap);
      panel(x, LAYOUT.bins.y, LAYOUT.bins.width, LAYOUT.bins.height, PALETTE.bin, PALETTE.binEdge);
      drawItem(context, bin.kind, x + LAYOUT.bins.width / 2, LAYOUT.bins.y + 26, 44, state.elapsed);
      text(ITEM_LABEL[bin.kind].toUpperCase(), x + LAYOUT.bins.width / 2, LAYOUT.bins.y + 54, 10, '#5d3d22', 'center', '700');
    }
    // Serve window: a warm counter with a bell.
    const s = LAYOUT.serve;
    panel(s.x, s.y, s.width, s.height, '#e8c98a', '#8a6a42');
    text('SERVE  •  RING THE BELL', s.x + s.width / 2, s.y + 26, 14, '#5d3d22', 'center', '800');
    context.fillStyle = '#f2b544';
    context.beginPath();
    context.arc(s.x + s.width - 40, s.y + 34, 13, Math.PI, 0);
    context.closePath();
    context.fill();
    context.fillRect(s.x + s.width - 54, s.y + 34, 28, 5);
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = 'rgba(217,43,31,0.85)';
      context.beginPath();
      context.arc(s.x + 40 + i * 22, s.y + 44, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBoards(state) {
    for (let i = 0; i < 2; i += 1) {
      const b = LAYOUT.boards[i];
      const board = state.boards[i];
      panel(b.x, b.y, b.width, b.height, PALETTE.board, PALETTE.boardEdge);
      context.fillStyle = '#f2e3c2';
      roundRect(b.x + 14, b.y + 10, b.width - 28, 34, 6);
      context.fill();
      if (board.state === 'chopping') {
        drawItem(context, board.item, b.x + b.width / 2, b.y + 27, 40, state.elapsed);
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(b.x + 14, b.y + 48, b.width - 28, 6);
        context.fillStyle = '#7dc383';
        context.fillRect(b.x + 14, b.y + 48, (b.width - 28) * (board.t / board.dur), 6);
      } else if (board.state === 'done') {
        drawItem(context, board.out, b.x + b.width / 2, b.y + 27, 40, state.elapsed);
        text('READY', b.x + b.width / 2, b.y + 62, 11, '#7dc383', 'center', '800');
      } else {
        text('CHOP', b.x + b.width / 2, b.y + 62, 11, '#c9b18a', 'center', '800');
      }
    }
  }

  function drawCooker(state, rect, slots, title, isOven) {
    panel(rect.x, rect.y, rect.width, rect.height, isOven ? PALETTE.grill : PALETTE.fryer, isOven ? PALETTE.grillBrick : PALETTE.fryerEdge);
    if (isOven) {
      // Brick courses and the fire mouth.
      context.strokeStyle = 'rgba(0,0,0,0.25)';
      context.lineWidth = 2;
      for (let r = 0; r < 4; r += 1) {
        context.beginPath();
        context.moveTo(rect.x + 8, rect.y + 24 + r * 30);
        context.lineTo(rect.x + rect.width - 8, rect.y + 24 + r * 30);
        context.stroke();
      }
      drawFlame(context, rect.x + 50, rect.y + rect.height - 18, 20, state.elapsed, 3);
      drawFlame(context, rect.x + 150, rect.y + rect.height - 18, 16, state.elapsed, 7);
      drawEmbers(context, rect.x + 20, rect.y + rect.height - 12, rect.width - 40, state.elapsed);
    } else {
      // Two oil vats.
      for (let i = 0; i < 2; i += 1) {
        const vx = rect.x + 18 + i * 92;
        context.fillStyle = '#f7c948';
        roundRect(vx, rect.y + 26, 76, 44, 8);
        context.fill();
        context.fillStyle = 'rgba(255,255,255,0.35)';
        context.fillRect(vx + 8, rect.y + 32, 60, 6);
      }
    }
    for (let i = 0; i < 2; i += 1) {
      const slot = slots[i];
      const cx = rect.x + 50 + i * 100;
      const cy = rect.y + 62;
      if (slot.state === 'empty') {
        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.lineWidth = 2;
        context.setLineDash([5, 5]);
        context.beginPath();
        context.arc(cx, cy, 24, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        continue;
      }
      const kind = slot.state === 'burnt' ? 'burnt' : slot.state === 'ready' ? slot.out : slot.item;
      drawItem(context, kind, cx, cy, 52, state.elapsed);
      if (slot.state === 'cooking') {
        progressRing(cx, cy, 30, slot.t / slot.dur, '#ffb02e');
      } else if (slot.state === 'ready') {
        const frac = 1 - slot.t / 7;
        progressRing(cx, cy, 30, frac, frac > 0.4 ? '#7dc383' : '#e5534b');
        text('READY', cx, cy + 44, 11, '#7dc383', 'center', '800');
      } else if (slot.state === 'burnt') {
        text('BURNT!', cx, cy + 44, 11, '#e5534b', 'center', '800');
      }
    }
    text(title, rect.x + rect.width / 2, rect.y + rect.height - 8, 12, isOven ? '#e8b48a' : '#5d6a72', 'center', '800');
  }

  function drawIsland(state) {
    const isl = LAYOUT.island;
    panel(isl.x, isl.y, isl.width, isl.height, PALETTE.island, '#5d3d22');
    context.fillStyle = PALETTE.islandTop;
    roundRect(isl.x + 10, isl.y + 10, isl.width - 20, isl.height - 20, 8);
    context.fill();
    // Props on the island: bowls of herbs, a cutting board, a pot of tomatoes.
    drawItem(context, 'lettuce', isl.x + 60, isl.y + 52, 52, state.elapsed);
    drawItem(context, 'tomato', isl.x + 150, isl.y + 46, 48, state.elapsed);
    drawItem(context, 'cheese', isl.x + 240, isl.y + 52, 48, state.elapsed);
    drawItem(context, 'mushroom', isl.x + 300, isl.y + 50, 46, state.elapsed);
    context.fillStyle = '#f2e3c2';
    roundRect(isl.x + 60, isl.y + 96, 220, 44, 6);
    context.fill();
    drawItem(context, 'potato', isl.x + 110, isl.y + 118, 40, state.elapsed);
    drawItem(context, 'dough', isl.x + 190, isl.y + 118, 44, state.elapsed);
    drawItem(context, 'bun', isl.x + 260, isl.y + 118, 44, state.elapsed);
    text('PREP ISLAND', isl.x + isl.width / 2, isl.y + isl.height - 12, 11, '#e8c98a', 'center', '800');
  }

  function drawBottomBar(state) {
    // Clean plates stack.
    const p = LAYOUT.plates;
    panel(p.x, p.y, p.width, p.height, '#6a4a2e', '#4a2c1c');
    for (let i = 0; i < Math.min(state.cleanPlates, 5); i += 1) {
      context.fillStyle = '#f4efe4';
      context.beginPath();
      context.ellipse(p.x + p.width / 2, p.y + 78 - i * 9, 38, 9, 0, 0, Math.PI * 2);
      context.fill();
    }
    text(`PLATES x${state.cleanPlates}`, p.x + p.width / 2, p.y + p.height - 10, 11, '#e8c98a', 'center', '800');
    // Plating bar: three plate slots.
    const bar = LAYOUT.plating;
    panel(bar.x, bar.y, bar.width, bar.height, PALETTE.plating, '#4a2c1c');
    for (let i = 0; i < PLATE_SLOTS; i += 1) {
      const cx = ANCHORS.plating[i].x;
      const cy = bar.y + 58;
      const plate = state.plates[i];
      if (plate) {
        drawPlate(context, cx, cy, 46, plate.items, state.elapsed);
        const matched = state.tickets.some((t) => {
          const needs = ticketNeeds(t);
          return plate.items.length === needs.length && plate.items.every((it) => needs.includes(it)) && needs.every((it) => plate.items.includes(it));
        });
        if (matched) {
          context.strokeStyle = '#7dc383';
          context.lineWidth = 3;
          context.beginPath();
          context.arc(cx, cy, 52, 0, Math.PI * 2);
          context.stroke();
          text('READY TO SERVE', cx, cy - 58, 11, '#7dc383', 'center', '800');
        }
      } else {
        context.strokeStyle = 'rgba(255,255,255,0.3)';
        context.lineWidth = 2;
        context.setLineDash([6, 6]);
        context.beginPath();
        context.arc(cx, cy, 42, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
      }
    }
    text('PLATING  •  BUILD THE DISH HERE', bar.x + bar.width / 2, bar.y + bar.height - 10, 11, '#c9b18a', 'center', '800');
    // Trash.
    const tr = LAYOUT.trash;
    panel(tr.x, tr.y, tr.width, tr.height, PALETTE.trash, '#22262c');
    context.fillStyle = '#22262c';
    context.fillRect(tr.x + 22, tr.y + 22, tr.width - 44, 12);
    text('TRASH', tr.x + tr.width / 2, tr.y + tr.height - 10, 11, '#9aa2ac', 'center', '800');
    // Sink: wash dirty plates here.
    const sk = LAYOUT.sink;
    panel(sk.x, sk.y, sk.width, sk.height, PALETTE.sink, PALETTE.sinkEdge);
    context.fillStyle = '#bfe0ea';
    roundRect(sk.x + 16, sk.y + 16, sk.width - 32, 56, 8);
    context.fill();
    for (let i = 0; i < Math.min(state.dirtyPlates, 4); i += 1) {
      context.fillStyle = '#d8cfb8';
      context.beginPath();
      context.ellipse(sk.x + 44 + i * 44, sk.y + 48, 18, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
    if (state.dirtyPlates > 0) {
      text(`WASH x${state.dirtyPlates}  (hold E)`, sk.x + sk.width / 2, sk.y + 92, 12, '#1e3a44', 'center', '800');
      if (state.chef.washT > 0) progressRing(sk.x + sk.width / 2, sk.y + 44, 26, state.chef.washT / 1.2, '#7dc383');
    } else {
      text('SINK', sk.x + sk.width / 2, sk.y + 92, 12, '#1e3a44', 'center', '800');
    }
  }

  function drawPopups(state) {
    for (const popup of state.popups) {
      const age = popup.t / popup.life;
      const alpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
      const y = popup.y - age * 34;
      context.save();
      context.globalAlpha = Math.max(0, alpha);
      text(popup.text, popup.x, y, 26, popup.color, 'center', '800');
      if (popup.sub) text(popup.sub, popup.x, y + 22, 14, '#fff', 'center', '700');
      context.restore();
    }
    if (state.banner) {
      const age = state.banner.t;
      const alpha = age > RUSH_BANNER_SECONDS - 0.6 ? Math.max(0, (RUSH_BANNER_SECONDS - age) / 0.6) : 1;
      context.save();
      context.globalAlpha = alpha;
      panel(440, 250, 400, 74, '#e5534b', '#ffb02e');
      text(state.banner.text, 640, 298, 40, '#fff', 'center', '800');
      text('orders are coming faster', 640, 316, 13, '#ffe3df', 'center');
      context.restore();
    }
  }

  function drawPanelBox(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(20,12,6,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(x, y, width, height, '#2e1f14', '#f2b544');
    text(title, FIELD.width / 2, y + 62, 40, PALETTE.text, 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 108 + i * 32, 17, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 18, PALETTE.coin, 'center', '800');
  }

  /** Paint one frame: the kitchen, then the HUD, then any panel for the screen. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state, now);
    drawHeader(state);
    drawBins(state);
    drawBoards(state);
    drawCooker(state, LAYOUT.grill, state.grill, 'BRICK OVEN', true);
    drawCooker(state, LAYOUT.fryer, state.fryer, 'FRYER', false);
    drawIsland(state);
    drawBottomBar(state);
    drawChef(context, state.chef.x, state.chef.y, state.chef.dir, state.chef.moving, now, state.chef.hands);
    drawPopups(state);
    if (screen === SCREEN_TITLE) {
      drawPanelBox('EMBERLINE', [
        'Walk with WASD / arrows — or click where to go.',
        'Grab ingredients, chop, grill & fry, build the dish on a plate.',
        'Serve at the window before the ticket walks out. Burnt food goes in the trash.',
        'Wash dirty plates at the sink. One shift: 2½ minutes. Rush hour hits at one minute.',
      ], 'CLICK OR PRESS ENTER TO START');
    } else if (screen === SCREEN_PAUSED) {
      drawPanelBox('Paused', ['The tickets will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const stars = '★'.repeat(state.stars) + '☆'.repeat(3 - state.stars);
      drawPanelBox('SHIFT COMPLETE', [
        `${stars}`,
        `Coins earned  $${state.coins}      Dishes served  ${state.served}`,
        `Perfect serves  ${state.perfect}      Best streak  x${state.bestStreak}`,
        `Walked out  ${state.walkedOut}`,
      ], 'PRESS R TO COOK AGAIN');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
