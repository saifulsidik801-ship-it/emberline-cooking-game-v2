// Drawing only: every ingredient, cooked dish and the chef, drawn with canvas paths and
// radial shading so the food looks worth serving. No images, no network: all of it is code.
// `t` is the running clock in seconds, used for flame flicker and steam drift.

/** A soft radial highlight: a bright centre fading into the base colour. */
function shade(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** One wavy steam curl rising from hot food. */
export function drawSteam(ctx, x, y, t, scale) {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i += 1) {
    const ox = x + (i - 0.5) * 10 * scale;
    ctx.beginPath();
    for (let s = 0; s <= 1; s += 0.25) {
      const yy = y - s * 16 * scale;
      const xx = ox + Math.sin(s * 5 + t * 3 + i * 2) * 3 * scale;
      if (s === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
}

/** A wood-fire flame: three layered teardrops that flicker with the clock. */
export function drawFlame(ctx, x, y, size, t, seed) {
  const flick = 1 + Math.sin(t * 9 + seed * 2.4) * 0.12;
  const h = size * flick;
  const layers = [
    { color: '#ff5a1f', w: 0.62, hh: 1 },
    { color: '#ff8c1a', w: 0.46, hh: 0.78 },
    { color: '#ffd23e', w: 0.28, hh: 0.52 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(x, y - h * layer.hh);
    ctx.bezierCurveTo(x + size * layer.w, y - h * layer.hh * 0.4, x + size * layer.w * 0.7, y + size * 0.3, x, y + size * 0.3);
    ctx.bezierCurveTo(x - size * layer.w * 0.7, y + size * 0.3, x - size * layer.w, y - h * layer.hh * 0.4, x, y - h * layer.hh);
    ctx.fill();
  }
}

/** Glowing embers under the oven: a few pulsing dots. */
export function drawEmbers(ctx, x, y, w, t) {
  for (let i = 0; i < 6; i += 1) {
    const ex = x + 8 + ((i * 37) % (w - 16));
    const ey = y + 4 + ((i * 13) % 8);
    const pulse = 0.55 + Math.sin(t * 5 + i * 1.7) * 0.35;
    ctx.fillStyle = `rgba(255,${Math.floor(110 + pulse * 60)},30,${pulse})`;
    circle(ctx, ex, ey, 2.5 + pulse);
  }
}

function tomato(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#ff7a6b', '#d92b1f');
  circle(ctx, x, y, s * 0.5);
  ctx.fillStyle = '#3f9e4d';
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.42);
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * s * 0.34, y - s * 0.42 + Math.sin(a) * s * 0.14);
    ctx.lineTo(x + Math.cos(a + 0.6) * s * 0.12, y - s * 0.42 + Math.sin(a + 0.6) * s * 0.12);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ellipse(ctx, x - s * 0.16, y - s * 0.18, s * 0.1, s * 0.06);
}

function lettuce(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#9fe08a', '#3f9e4d');
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    circle(ctx, x + Math.cos(a) * s * 0.22, y + Math.sin(a) * s * 0.22, s * 0.26);
  }
  ctx.fillStyle = '#6cc45e';
  circle(ctx, x, y, s * 0.26);
  ctx.strokeStyle = '#2f7a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.2);
  ctx.lineTo(x, y + s * 0.2);
  ctx.stroke();
}

function cheese(ctx, x, y, s) {
  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y + s * 0.3);
  ctx.lineTo(x + s * 0.45, y + s * 0.3);
  ctx.lineTo(x, y - s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e0a92e';
  circle(ctx, x - s * 0.12, y + s * 0.08, s * 0.07);
  circle(ctx, x + s * 0.16, y + s * 0.16, s * 0.05);
  circle(ctx, x + s * 0.02, y - s * 0.16, s * 0.05);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y + s * 0.3);
  ctx.lineTo(x - s * 0.05, y - s * 0.3);
  ctx.lineTo(x + s * 0.08, y - s * 0.3);
  ctx.lineTo(x - s * 0.18, y + s * 0.3);
  ctx.closePath();
  ctx.fill();
}

function patty(ctx, x, y, s, grilled) {
  shade(ctx, x, y, s * 0.5, grilled ? '#8a5a34' : '#a86a4a', grilled ? '#4a2c1c' : '#7a4a30');
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.5, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  if (grilled) {
    ctx.strokeStyle = '#2e1a10';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.18 - s * 0.2, y - s * 0.2);
      ctx.lineTo(x + i * s * 0.18 + s * 0.2, y + s * 0.2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ellipse(ctx, x - s * 0.18, y - s * 0.12, s * 0.16, s * 0.06);
}

function bun(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#f0c078', '#c98a3e');
  ctx.beginPath();
  ctx.arc(x, y + s * 0.1, s * 0.48, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a8762e';
  ctx.fillRect(x - s * 0.48, y + s * 0.08, s * 0.96, s * 0.1);
  ctx.fillStyle = '#fff3d0';
  circle(ctx, x - s * 0.18, y - s * 0.16, s * 0.045);
  circle(ctx, x + s * 0.1, y - s * 0.26, s * 0.045);
  circle(ctx, x + s * 0.24, y - s * 0.1, s * 0.04);
}

function potato(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#e8c88f', '#b98a4e');
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.42, s * 0.3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6a35';
  circle(ctx, x - s * 0.1, y - s * 0.05, s * 0.035);
  circle(ctx, x + s * 0.14, y + s * 0.08, s * 0.03);
}

function mushroom(ctx, x, y, s, chopped) {
  if (chopped) {
    ctx.fillStyle = '#f2e8d8';
    for (let i = 0; i < 3; i += 1) {
      const ox = (i - 1) * s * 0.22;
      ctx.beginPath();
      ctx.ellipse(x + ox, y + (i % 2) * s * 0.08, s * 0.16, s * 0.1, (i - 1) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#d8c8b0';
    return;
  }
  ctx.fillStyle = '#f2e8d8';
  ctx.fillRect(x - s * 0.07, y - s * 0.05, s * 0.14, s * 0.3);
  shade(ctx, x, y - s * 0.16, s * 0.42, '#e8a0a0', '#b0503c');
  ctx.beginPath();
  ctx.arc(x, y - s * 0.1, s * 0.42, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  circle(ctx, x - s * 0.16, y - s * 0.28, s * 0.07);
  circle(ctx, x + s * 0.14, y - s * 0.34, s * 0.05);
}

function dough(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#f7ecd2', '#e0c89a');
  circle(ctx, x, y, s * 0.46);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, x - s * 0.14, y - s * 0.16, s * 0.12, s * 0.07);
}

function fries(ctx, x, y, s) {
  ctx.fillStyle = '#d92b1f';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y - s * 0.1);
  ctx.lineTo(x + s * 0.4, y - s * 0.1);
  ctx.lineTo(x + s * 0.3, y + s * 0.42);
  ctx.lineTo(x - s * 0.3, y + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7c948';
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillRect(x + i * s * 0.13 - s * 0.045, y - s * 0.48 + Math.abs(i) * s * 0.05, s * 0.09, s * 0.5);
  }
  ctx.fillStyle = '#e0a92e';
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillRect(x + i * s * 0.13 - s * 0.045, y - s * 0.48 + Math.abs(i) * s * 0.05, s * 0.09, s * 0.07);
  }
}

function flatbread(ctx, x, y, s) {
  shade(ctx, x, y, s * 0.5, '#f0cd8a', '#c98a3e');
  circle(ctx, x, y, s * 0.48);
  ctx.fillStyle = '#f7c948';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y - s * 0.1);
  ctx.quadraticCurveTo(x, y + s * 0.22, x + s * 0.28, y - s * 0.05);
  ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.05, x - s * 0.05, y - s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d92b1f';
  circle(ctx, x - s * 0.18, y - s * 0.18, s * 0.09);
  circle(ctx, x + s * 0.16, y - s * 0.22, s * 0.08);
  ctx.fillStyle = '#3f9e4d';
  circle(ctx, x + s * 0.02, y - s * 0.26, s * 0.06);
}

function choppedBits(ctx, x, y, s, color, dark) {
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.16, s * 0.14, s * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = dark;
  circle(ctx, x, y, s * 0.08);
}

function burnt(ctx, x, y, s) {
  ctx.fillStyle = '#241a12';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.44, s * 0.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  circle(ctx, x - s * 0.12, y - s * 0.08, s * 0.1);
  circle(ctx, x + s * 0.14, y + s * 0.06, s * 0.08);
  drawSteam(ctx, x, y - s * 0.2, 0, 0.7);
}

/** Draw one item kind at (x, y) with nominal size s. `t` animates steam and flames. */
export function drawItem(ctx, kind, x, y, s, t) {
  switch (kind) {
    case 'tomato': tomato(ctx, x, y, s); break;
    case 'lettuce': lettuce(ctx, x, y, s); break;
    case 'cheese': cheese(ctx, x, y, s); break;
    case 'patty': patty(ctx, x, y, s, false); break;
    case 'bun': bun(ctx, x, y, s); break;
    case 'potato': potato(ctx, x, y, s); break;
    case 'mushroom': mushroom(ctx, x, y, s, false); break;
    case 'dough': dough(ctx, x, y, s); break;
    case 'choppedTomato': choppedBits(ctx, x, y, s, '#e84a3a', '#8a1f14'); break;
    case 'choppedLettuce': choppedBits(ctx, x, y, s, '#7dc383', '#2f7a3a'); break;
    case 'choppedMushroom': mushroom(ctx, x, y, s, true); break;
    case 'grilledPatty': patty(ctx, x, y, s, true); drawSteam(ctx, x, y - s * 0.2, t || 0, 0.8); break;
    case 'grilledMushroom': mushroom(ctx, x, y, s, true); drawSteam(ctx, x, y - s * 0.2, t || 0, 0.7); break;
    case 'flatbread': flatbread(ctx, x, y, s); drawSteam(ctx, x, y - s * 0.2, t || 0, 0.8); break;
    case 'fries': fries(ctx, x, y, s); drawSteam(ctx, x, y - s * 0.3, t || 0, 0.8); break;
    case 'burnt': burnt(ctx, x, y, s); break;
    default: dough(ctx, x, y, s); break;
  }
}

/** A white plate, optionally holding a pile of items drawn small on top of it. */
export function drawPlate(ctx, x, y, r, items, t) {
  shade(ctx, x, y, r, '#ffffff', '#d8cfb8');
  circle(ctx, x, y, r);
  ctx.strokeStyle = '#b8ac90';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  if (!items || items.length === 0) return;
  const n = items.length;
  for (let i = 0; i < n; i += 1) {
    const a = -Math.PI / 2 + (i / Math.max(n, 1)) * Math.PI * 2;
    const rr = n === 1 ? 0 : r * 0.42;
    drawItem(ctx, items[i], x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, r * 0.52, t);
  }
}

/** The chef: white hat, face, red apron, arms; `dir` -1 faces left, 1 faces right. */
export function drawChef(ctx, x, y, dir, moving, t, hands) {
  const bob = moving ? Math.sin(t * 12) * 2 : 0;
  const by = y + bob;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 26, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: apron over a shirt.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.ellipse(x, by + 8, 15, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c94f43';
  ctx.beginPath();
  ctx.ellipse(x, by + 12, 12, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms reach toward the facing side.
  ctx.strokeStyle = '#f0c08a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 12, by + 2);
  ctx.lineTo(x + dir * 16, by + 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 12, by + 2);
  ctx.lineTo(x + dir * 14, by + 12);
  ctx.stroke();
  // Head and hat.
  ctx.fillStyle = '#f0c08a';
  circle(ctx, x, by - 14, 12);
  ctx.fillStyle = '#f8f4ec';
  ctx.beginPath();
  ctx.arc(x, by - 20, 12, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - 12, by - 24, 24, 6);
  circle(ctx, x - 6, by - 28, 5);
  circle(ctx, x + 6, by - 28, 5);
  // Face.
  ctx.fillStyle = '#241a12';
  circle(ctx, x + dir * 4 - 3, by - 14, 1.6);
  circle(ctx, x + dir * 4 + 4, by - 14, 1.6);
  ctx.strokeStyle = '#241a12';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + dir * 3, by - 10, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // Carried items float above the hat, one per hand.
  if (hands) {
    for (let i = 0; i < 2; i += 1) {
      const held = hands[i];
      if (!held) continue;
      const hx = x + (i === 0 ? -14 : 14);
      const hy = by - 44;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      circle(ctx, hx, hy + 2, 15);
      ctx.fillStyle = '#fff8e7';
      circle(ctx, hx, hy, 14);
      if (held.kind === 'plate') drawPlate(ctx, hx, hy, 11, held.items, t);
      else drawItem(ctx, held.kind, hx, hy, 24, t);
    }
  }
}
