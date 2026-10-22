// Живая демка: что меняется в интерфейсе только для сайта.
// Открыты два гида (hero и Fortuna), остальные - «секретные» карточки с вопросом.
(() => {
  const OPEN = ['hero', 'fortuna'];
  const isOpen = (k) => OPEN.includes(String(k || '').toLowerCase());

  const MYSTERY = (i) => `
    <div class="guide-mystery" tabindex="0" data-i="${i}" title="Секретный гид">
      <div class="gm-inner">
        <div class="gm-face gm-front">
          <div class="gm-q">?</div>
          <div class="gm-title">Секретный гид</div>
          <div class="gm-desc">У него свой характер и свои фразы. Нажмите, чтобы узнать, как с ним познакомиться.</div>
          <div class="gm-btn">Кто это?</div>
        </div>
        <div class="gm-face gm-back">
          <div class="gm-title">Ждёт в программе</div>
          <div class="gm-desc">Скачайте Forum Checker: там можно выбрать любого из гидов и посмотреть, как он комментирует вашу работу.</div>
          <a class="gm-btn gm-dl" href="https://github.com/Mihacloude228/forum-checker/releases/latest" target="_blank" rel="noopener">Скачать</a>
        </div>
      </div>
    </div>`;

  const patch = () => {
    if (typeof renderAuthenticGuideCards !== 'function' || window.__demoGuidesPatched) return;
    window.__demoGuidesPatched = true;
    const orig = renderAuthenticGuideCards;
    window.renderAuthenticGuideCards = function () {
      // <template> не загружает картинки, поэтому фото секретных гидов браузер даже не запросит
      const tmp = document.createElement('template');
      tmp.innerHTML = orig.apply(this, arguments);
      let n = 0;
      tmp.content.querySelectorAll('.guide-select-card').forEach(card => {
        const m = (card.getAttribute('onclick') || '').match(/selectGuide\('(.+?)'\)/);
        if (m && !isOpen(m[1])) card.outerHTML = MYSTERY(n++);
      });
      return tmp.innerHTML;
    };
    const origSelect = selectGuide;
    window.selectGuide = function (key) {
      if (!isOpen(key)) return;
      return origSelect.apply(this, arguments);
    };
  };

  // Наклон и блик за курсором + переворот по клику
  document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.guide-mystery');
    document.querySelectorAll('.guide-mystery.tilting').forEach(x => { if (x !== c) { x.classList.remove('tilting'); x.style.removeProperty('--rx'); x.style.removeProperty('--ry'); } });
    if (!c) return;
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.classList.add('tilting');
    c.style.setProperty('--ry', ((px - 0.5) * 16).toFixed(2) + 'deg');
    c.style.setProperty('--rx', ((0.5 - py) * 16).toFixed(2) + 'deg');
    c.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    c.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  });
  const flip = (c) => { c.classList.toggle('flipped'); try { playUiSound('tab'); } catch (e) {} };
  document.addEventListener('click', (e) => {
    if (e.target.closest('.gm-dl')) return;
    const c = e.target.closest('.guide-mystery');
    if (c) flip(c);
  });
  document.addEventListener('keydown', (e) => {
    const c = document.activeElement && document.activeElement.closest && document.activeElement.closest('.guide-mystery');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flip(c); }
  });

  // Диалогов гидов в демке нет; свои фразы сохраняются, но «Проверить» ничего не делает
  const muteGuides = () => {
    window.showMascotBubble = function () {};
    window.testCustomPhrase = function () {};
  };
  // «Быстрый экспорт» и «Проверка онлайна» в настройках - только в программе
  const LOCKED_SECTIONS = { export: 'Быстрый экспорт', online: 'Настройки проверки онлайна' };
  const lockSettings = () => {
    if (typeof showSettingsSection !== 'function') return;
    const orig = showSettingsSection;
    window.showSettingsSection = function (sec) {
      const r = orig.apply(this, arguments);
      const box = document.getElementById('settingsContainer');
      if (box) {
        box.querySelectorAll('.demo-lock').forEach(x => x.remove());
        box.classList.toggle('demo-locked', sec in LOCKED_SECTIONS);
        if (sec in LOCKED_SECTIONS) box.insertAdjacentHTML('beforeend', `<div class="demo-lock"><div class="demo-lock-card">
          <div class="demo-lock-ic">🔒</div><b>${LOCKED_SECTIONS[sec]}: только в приложении</b>
          <span>В демке на сайте этот раздел не настраивается. Скачайте Forum Checker, чтобы изменить его под себя.</span>
          <a class="btn btn-primary" href="https://github.com/Mihacloude228/forum-checker/releases/latest" target="_blank" rel="noopener">Скачать программу</a></div></div>`);
      }
      return r;
    };
  };

  document.addEventListener('DOMContentLoaded', () => {
    patch();
    muteGuides();
    lockSettings();
    const meta = document.querySelector('.header-meta');
    if (meta) meta.insertAdjacentHTML('afterbegin', '<div class="demo-badge" title="Все данные выдуманные">ДЕМО</div>');
    const url = document.getElementById('forumUrl');
    if (url && !url.value) url.value = window.__DEMO_DATA__.thread;
  });
})();
