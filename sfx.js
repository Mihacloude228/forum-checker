// Звуки интерфейса сайта (набор «Тактильный»). Всё синтезируется на лету через Web Audio, файлов нет.
// window.FC_SFX.play(набор, звук), где звук: tab | press | copy | on
window.FC_SFX = (() => {
  let ctx = null;
  const audio = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  // тон: синус/треугольник со сдвигом высоты и быстрым затуханием
  const tone = ({ type = 'sine', f0 = 880, f1 = f0, dur = 0.08, vol = 0.12, attack = 0.002, delay = 0, lp = 0 } = {}) => {
    const a = audio(), t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node = node.connect(f); }
    node.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };
  // шум: короткий всплеск через фильтр
  const noise = ({ freq = 2400, q = 7, type = 'bandpass', dur = 0.035, vol = 0.2, delay = 0, curve = 4 } = {}) => {
    const a = audio(), t = a.currentTime + delay;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, curve);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination); src.start(t);
  };

  const PACKS = {
    // Тактильный - мягкий низкий «тук», как вибро-отклик тачпада
    haptic: {
      name: 'Тактильный', desc: 'Глухой мягкий «тук», будто кнопка физически нажалась.',
      tab:   () => tone({ f0: 180, f1: 90, dur: 0.035, vol: 0.22, lp: 900 }),
      press: () => { tone({ f0: 150, f1: 55, dur: 0.06, vol: 0.32, lp: 700 }); noise({ type: 'lowpass', freq: 600, q: 1, dur: 0.015, vol: 0.12 }); },
      copy:  () => { tone({ f0: 160, f1: 70, dur: 0.045, vol: 0.26, lp: 800 }); tone({ f0: 220, f1: 100, dur: 0.045, vol: 0.22, lp: 900, delay: 0.09 }); },
      on:    () => { tone({ f0: 120, f1: 50, dur: 0.08, vol: 0.32, lp: 600 }); tone({ f0: 240, f1: 120, dur: 0.05, vol: 0.18, lp: 900, delay: 0.07 }); },
    },
  };

  return {
    packs: PACKS,
    play: (pack, kind) => { try { (PACKS[pack] || PACKS.haptic)[kind](); } catch (e) {} },
  };
})();
