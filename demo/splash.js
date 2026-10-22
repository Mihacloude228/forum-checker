// Заставка при запуске: детали пазла F и C падают сверху и защёлкиваются.
// Подключается до app.js, ничего не ждёт от API. Клик или любая клавиша - пропустить.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STATUS = ['Загрузка интерфейса…', 'Проверка ключа…', 'Готово'];
  const MARK = `<svg class="fs-puzzle" viewBox="0 0 64 64" aria-hidden="true">
      <g class="fs-pl"><path d="M13 16H33V26.5A5.5 5.5 0 0 1 33 37.5V48H13A5 5 0 0 1 8 43V21A5 5 0 0 1 13 16Z" fill="#8B7CF6"/>
        <path d="M17 24V40M17 24H25M17 32H23.5" fill="none" stroke="#0E0F14" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g class="fs-pr"><path d="M35 16H51A5 5 0 0 1 56 21V43A5 5 0 0 1 51 48H35V38.6A6.6 6.6 0 0 0 35 25.4Z" fill="#E8E9EE"/>
        <path d="M51 27.2A6.6 6.6 0 1 0 51 36.8" fill="none" stroke="#0E0F14" stroke-width="4" stroke-linecap="round"/></g>
      <rect class="fs-seam" x="33" y="12" width="2" height="40" rx="1" fill="#fff"/></svg>`;

  const build = () => {
    const ver = (document.getElementById('statusBarVersion') || {}).textContent || '';
    const el = document.createElement('div');
    el.id = 'fcSplash';
    if (reduce) el.classList.add('still');
    el.innerHTML = `
      <div class="fs-stage">${MARK}</div>
      <div class="fs-name">Forum <span>Checker</span></div>
      <div class="fs-status"></div>
      <div class="fs-ver">${ver}</div><div class="fs-by">byhero</div>
      <div class="fs-prog"></div>`;
    document.body.appendChild(el);

    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    let gone = false;
    const hide = () => {
      if (gone) return; gone = true;
      timers.forEach(clearTimeout);
      el.classList.add('out');
      setTimeout(() => el.remove(), 380);
      removeEventListener('keydown', hide, true);
    };
    el.addEventListener('mousedown', hide);
    addEventListener('keydown', hide, true);

    const st = el.querySelector('.fs-status');
    if (reduce) {
      el.classList.add('named');
      st.textContent = STATUS[0];
      at(900, hide);
      return;
    }
    requestAnimationFrame(() => el.classList.add('play'));
    at(1250, () => el.classList.add('named'));
    STATUS.forEach((s, k) => at(1400 + k * 420, () => { st.textContent = s; }));
    at(2700, hide);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
