// Выбор типа фильтра (вариант A): короткое название, под ним пример.
// Вверху основные типы «Только цифры» и «Не пустое», остальные свёрнуты в «Другие проверки».
// Работает поверх <select id="ruleType">: меняет его значение и вызывает onRuleTypeChange().
(() => {
  const TYPES = [
    { g: 'main',  k: 'digits',       i: '12', n: 'Только цифры',      s: 'Static ID, возраст, числовой Discord ID', ok: '41000 · 18' },
    { g: 'main',  k: 'not_empty',    i: '✓',  n: 'Не пустое',         s: 'Любой ответ, лишь бы пункт заполнен',     ok: 'Иван · 5+ часов' },
    { g: 'ЧИСЛА', k: 'min',          i: '≥',  n: 'Число не меньше…',  s: 'Например, возраст от 16',                 ok: '18 при ≥ 16' },
    { g: 'ЧИСЛА', k: 'max',          i: '≤',  n: 'Число не больше…',  s: 'Например, возраст до 35',                 ok: '22 при ≤ 35' },
    { g: 'ТЕКСТ', k: 'alpha',        i: 'Аб', n: 'Только буквы',      s: 'Настоящее имя, без цифр и символов',      ok: 'Иван' },
    { g: 'ТЕКСТ', k: 'contains',     i: '+',  n: 'Содержит слово…',   s: 'В ответе должно быть указанное слово',    ok: '«есть опыт»' },
    { g: 'ТЕКСТ', k: 'not_contains', i: '−',  n: 'Без запрещённых слов…', s: 'Отклонить, если встречается слово',   ok: '«хочу развивать»' },
    { g: 'ТЕКСТ', k: 'min_len',      i: '↔',  n: 'Длина не меньше…',  s: 'Ответ не короче N символов',              ok: '«Наведу порядок…» при ≥ 20', help: 'Кандидат проходит, если ответ не короче указанного числа символов.', ph: 'например: 20' },
    { g: 'ТЕКСТ', k: 'max_len',      i: '⇥',  n: 'Длина не больше…',  s: 'Ответ не длиннее N символов',             ok: '«Иван» при ≤ 30', help: 'Кандидат проходит, если ответ не длиннее указанного числа символов.', ph: 'например: 30' },
    { g: 'ФОРМАТЫ', k: 'discord',    i: '@',  n: 'Discord',           s: 'ID из 17–21 цифры или тег',               ok: '7004…1237 · @nick' },
    { g: 'ФОРМАТЫ', k: 'regex',      i: '.*', n: 'Своё правило (RegEx)', s: 'Для продвинутых: шаблон проверки',     ok: '^\\d{5}$' },
    { g: 'ПРОЧЕЕ', k: 'none',        i: '·',  n: 'Без проверки',      s: 'Не проверять, только показать в карточке', ok: 'что угодно' },
  ];
  const ALIAS = { any: 'none', min_num: 'min', max_num: 'max' };
  const byKey = (k) => TYPES.find(t => t.k === (ALIAS[k] || k)) || null;
  window.FILTER_TYPES = TYPES;

  const sel = document.getElementById('ruleType');
  if (!sel) return;
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const box = document.createElement('div');
  box.className = 'ft-sel';
  box.innerHTML = `<button type="button" class="input-text ft-btn"><span class="ft-cur"></span><span class="ft-chev">▾</span></button><div class="ft-menu" hidden></div>`;
  // Типы, которые программа понимает, но которых не было в списке
  [...TYPES.map(t => t.k), ...Object.keys(ALIAS)].forEach(k => { if (![...sel.options].some(o => o.value === k)) sel.add(new Option(k, k)); });
  sel.style.display = 'none';
  sel.after(box);
  const btn = box.querySelector('.ft-btn'), cur = box.querySelector('.ft-cur'), menu = box.querySelector('.ft-menu');
  let moreOpen = false;

  const curKey = () => ALIAS[sel.value] || sel.value;
  const opt = (t) => `<div class="ft-opt${t.k === curKey() ? ' on' : ''}" data-k="${t.k}"><i>${esc(t.i)}</i>
    <div><b>${esc(t.n)}</b><span>${esc(t.s)} · <em>${esc(t.ok)}</em></span></div></div>`;

  function render() {
    const t = byKey(sel.value) || TYPES[0];
    cur.innerHTML = `<i>${esc(t.i)}</i>${esc(t.n)}`;
    const rest = TYPES.filter(x => x.g !== 'main');
    const inRest = rest.some(x => x.k === curKey());
    const open = moreOpen || inRest;
    let html = `<div class="ft-grp">ОСНОВНЫЕ</div>` + TYPES.filter(x => x.g === 'main').map(opt).join('');
    if (!inRest) html += `<button type="button" class="ft-more${open ? ' open' : ''}">${open ? 'Скрыть другие проверки' : `Другие проверки (${rest.length})`}<span>▾</span></button>`;
    if (open) {
      let g = '';
      rest.forEach(x => { if (x.g !== g) { g = x.g; html += `<div class="ft-grp">${g}</div>`; } html += opt(x); });
    }
    menu.innerHTML = html;
  }

  const close = () => { menu.hidden = true; box.classList.remove('open'); };
  // Меню поверх окна (position: fixed), чтобы его не обрезала прокрутка модального окна
  const place = () => {
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 260 && above > below;
    menu.style.left = r.left + 'px';
    menu.style.width = r.width + 'px';
    menu.style.maxHeight = Math.max(160, Math.min(360, up ? above : below)) + 'px';
    menu.style.top = up ? '' : (r.bottom + 6) + 'px';
    menu.style.bottom = up ? (window.innerHeight - r.top + 6) + 'px' : '';
  };
  window.addEventListener('resize', close);
  document.addEventListener('scroll', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); }, true);
  btn.onclick = (e) => {
    e.stopPropagation();
    if (menu.hidden) { moreOpen = false; render(); menu.hidden = false; place(); box.classList.add('open'); menu.querySelector('.ft-opt.on')?.scrollIntoView({ block: 'nearest' }); }
    else close();
  };
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('.ft-more')) { moreOpen = !moreOpen; render(); place(); return; }
    const o = e.target.closest('.ft-opt');
    if (!o) return;
    sel.value = o.dataset.k;
    close();
    if (typeof playUiSound === 'function') playUiSound('tab');
    onRuleTypeChange();
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); close(); } }, true);

  // Значение меняется из кода (открытие/редактирование фильтра) - обновляем кнопку
  const origChange = window.onRuleTypeChange;
  window.onRuleTypeChange = function (...a) {
    if (ALIAS[sel.value]) sel.value = ALIAS[sel.value];  // старые названия типов → новые, программа понимает оба
    const r = origChange && origChange.apply(this, a);
    const t = byKey(sel.value);
    if (t && t.help) {
      const inp = document.getElementById('ruleParam'), help = document.getElementById('ruleParamHelp');
      if (inp) { inp.disabled = false; inp.placeholder = t.ph || ''; }
      if (help) help.textContent = '💡 ' + t.help;
    }
    render();
    return r;
  };

  // Короткие одинаковые названия в таблице фильтров
  window.getFilterTypeName = (ft) => { const t = byKey(ft || 'not_empty'); return t ? t.n.replace('…', '') : ft; };
  if (typeof renderRulesTable === 'function' && state && state.rules) renderRulesTable();
  render();
})();
