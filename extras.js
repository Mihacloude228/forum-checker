// Дополнения сайта: звуки интерфейса (по умолчанию выключены) и 3D-наклон карточек
(() => {
  /* ═════════ Звуки ═════════
     Сами звуки - в sfx.js. */
  let on = false;
  try { on = localStorage.getItem('fc-site-sfx') === '1'; } catch (e) {}
  const pack = 'haptic';
  const play = (k) => { if (on && window.FC_SFX) FC_SFX.play(pack, k); };

  // кнопка в шапке, возле «Скачать»
  const cta = document.querySelector('.nav-links .nav-cta');
  if (cta) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sfx-toggle';
    b.title = 'Звуки интерфейса';
    b.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
      + '<path class="wave" d="M15.5 8.5a5 5 0 0 1 0 7M18.8 5.2a9.5 9.5 0 0 1 0 13.6"/>'
      + '<path class="mute" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'
      + '<span class="sfx-label">Звуки:</span><span class="sfx-state"></span>';
    const sync = () => { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.querySelector('.sfx-state').textContent = on ? 'ВКЛ' : 'ВЫКЛ'; };
    b.addEventListener('click', () => {
      on = !on;
      try { localStorage.setItem('fc-site-sfx', on ? '1' : '0'); } catch (e) {}
      sync();
      play('on');
    });
    sync();
    cta.before(b);
  }

  // какие клики озвучиваем
  document.addEventListener('click', (e) => {
    const t = e.target.closest('a, button, summary');
    if (!t || t.classList.contains('sfx-toggle')) return;
    if (t.id === 'dsBtn') play('copy');
    else if (t.classList.contains('tab')) play('tab');
    else play('press');
  }, true);

  /* ═════════ 3D-наклон карточек ═════════ */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const MAX = 7; // градусов
  const cards = [...document.querySelectorAll('.feat')];
  cards.forEach(c => c.classList.add('tilt'));

  const setTilt = (c, px, py) => { // px, py: от 0 до 1 внутри карточки
    c.style.setProperty('--ry', ((px - 0.5) * 2 * MAX).toFixed(2) + 'deg');
    c.style.setProperty('--rx', ((0.5 - py) * 2 * MAX).toFixed(2) + 'deg');
    c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  };
  const reset = (c) => {
    c.classList.remove('tilting');
    ['--rx', '--ry', '--ty'].forEach(p => c.style.removeProperty(p));
  };

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine) {
    cards.forEach(c => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.classList.add('tilting');
        c.style.setProperty('--ty', '-3px');
        setTilt(c, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      });
      c.addEventListener('pointerleave', () => reset(c));
    });
    return;
  }

  // Телефон: карточки слегка следуют за наклоном устройства
  let base = null, cur = { x: 0.5, y: 0.5 }, target = { x: 0.5, y: 0.5 }, raf = 0;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const loop = () => {
    cur.x += (target.x - cur.x) * 0.12; cur.y += (target.y - cur.y) * 0.12;
    cards.forEach(c => { c.classList.add('tilting'); setTilt(c, cur.x, cur.y); });
    raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.001 ? requestAnimationFrame(loop) : 0;
  };
  const onOrient = (e) => {
    if (e.gamma == null) return;
    if (!base) base = { g: e.gamma, b: e.beta };
    target.x = clamp(0.5 + (e.gamma - base.g) / 50);
    target.y = clamp(0.5 + (e.beta - base.b) / 50);
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const start = () => window.addEventListener('deviceorientation', onOrient);
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    // iPhone спрашивает разрешение - только после касания
    window.addEventListener('touchend', function ask() {
      window.removeEventListener('touchend', ask);
      DOE.requestPermission().then(s => { if (s === 'granted') start(); }).catch(() => {});
    });
  } else if (DOE) start();
})();
