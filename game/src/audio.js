// All sound is synthesised with WebAudio: no audio files, no network. A short chop thock, a
// grill sizzle that runs while anything cooks, a bell ding on a serve, a low buzz for a wrong
// move, and a tick when a ticket turns HURRY!. The context is created on the first user gesture,
// so a silent screenshot run stays silent.

export function createAudio() {
  let context = null;
  let sizzle = null;
  let sizzleGain = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + when);
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + dur + 0.05);
  }

  function startSizzle() {
    const ctx = ensure();
    if (!ctx || sizzle) return;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4200;
    filter.Q.value = 0.6;
    sizzleGain = ctx.createGain();
    sizzleGain.gain.value = 0;
    source.connect(filter);
    filter.connect(sizzleGain);
    sizzleGain.connect(ctx.destination);
    source.start();
    sizzle = source;
  }

  return {
    /** Call from any user gesture so the browser lets sound start. */
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startSizzle();
    },
    chop() {
      tone(180, 0.09, 'triangle', 0.25);
      tone(90, 0.07, 'sine', 0.2, 0.01);
    },
    pickup() {
      tone(520, 0.06, 'sine', 0.12);
    },
    place() {
      tone(300, 0.07, 'triangle', 0.16);
    },
    ding() {
      tone(880, 0.35, 'sine', 0.22);
      tone(1318, 0.4, 'sine', 0.14, 0.02);
    },
    perfect() {
      tone(880, 0.2, 'sine', 0.2);
      tone(1108, 0.2, 'sine', 0.2, 0.08);
      tone(1318, 0.35, 'sine', 0.2, 0.16);
    },
    buzz() {
      tone(140, 0.16, 'sawtooth', 0.12);
    },
    tick() {
      tone(1200, 0.05, 'square', 0.08);
    },
    walkout() {
      tone(220, 0.25, 'sawtooth', 0.12);
      tone(165, 0.35, 'sawtooth', 0.12, 0.12);
    },
    /** The grill/fryer sizzle follows how many slots are cooking right now. */
    setSizzle(activeSlots) {
      if (!context || !sizzleGain) return;
      const target = activeSlots > 0 ? 0.05 : 0;
      sizzleGain.gain.setTargetAtTime(target, context.currentTime, 0.2);
    },
  };
}
