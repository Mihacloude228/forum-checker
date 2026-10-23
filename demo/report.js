// Отчёт картинкой: из результата проверки собирается картинка (Чек или Досье),
// её можно скопировать в буфер и вставить в Discord или сохранить PNG.
// Подключается после app.js: добавляет кнопку «🖼 Отчёт» в карточки кандидатов и окно «Подробнее».
(() => {
  const STYLE_KEY = 'fc_report_style';
  let rpStyle = 'receipt', rpItem = null, rpPassed = true;
  try { rpStyle = localStorage.getItem(STYLE_KEY) || 'receipt'; } catch (e) {}

  const esc = (t) => (typeof escapeHtml === 'function' ? escapeHtml(String(t ?? '')) : String(t ?? ''));
  const pad2 = (n) => String(n).padStart(2, '0');
  const nowStr = () => { const d = new Date(); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const initials = (n) => String(n || '?').split(/[_\s]+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
  const field = (fields, re) => { for (const [k, v] of Object.entries(fields || {})) if (re.test(k) && v) return String(v); return ''; };
  const checker = () => { try { return (getNormalizedGuideKey(state.currentGuide) || 'hero'); } catch (e) { return 'hero'; } };

  function collect(item) {
    const post = item.post || {}, res = item.res || {}, f = res.fields || {};
    const author = post.author || 'Кандидат';
    const stat = res.static || field(f, /static/i);
    const online = (state.onlineList || []).find(o => (stat && String(o.static_id) === String(stat)) || o.author === author) || null;
    const bl = !!res.is_blacklisted;
    return {
      author, stat, num: post.post_number || '?', passed: !!res.passed && !bl, bl,
      match: typeof res.match === 'number' ? Math.round(res.match * 100) : null,
      reasons: (res.reasons || []).filter(Boolean),
      age: field(f, /возраст/i), name: field(f, /^имя|как вас зовут/i), exp: field(f, /опыт|стаж/i), perDay: field(f, /онлайн/i),
      fields: Object.entries(f).filter(([k, v]) => v && String(v).length <= 40 && !/discord/i.test(k)).slice(0, 6),
      online, date: nowStr(), by: checker(),
    };
  }

  function receipt(d) {
    const verdict = d.bl ? 'ЧС' : d.passed ? 'ОДОБРЕН' : 'ОТКАЗ';
    const vc = d.passed ? '#1e8e5a' : '#c0392b';
    const o = d.online;
    const onl = o ? `<div class="row"><span>ОНЛАЙН ДЕНЬ</span><span>${esc(o.day)}</span></div><div class="row"><span>ОНЛАЙН НЕДЕЛЯ</span><span>${esc(o.week)}</span></div>
      <div class="row"><span>ОНЛАЙН МЕСЯЦ</span><span>${esc(o.month)}</span></div><div class="row"><span>ЗА 2 МЕСЯЦА</span><span>${esc(o.two_months || '-')}</span></div>`
      : `<div class="row"><span>ОНЛАЙН</span><span>не проверялся</span></div>`;
    const reasons = d.reasons.map(r => `<div class="row x"><span>✕ ${esc(r)}</span><span></span></div>`).join('');
    return `<div class="rp-rc"><div class="rp-slot"></div><div class="rp-clip"><div class="rp-receipt">
      <div class="c logo">FORUM CHECKER</div><div class="c">проверка анкеты · Majestic RP</div><div class="c">${esc(d.date)}</div>
      <hr><div class="row"><span>КАНДИДАТ</span><span>${esc(d.author)}</span></div>
      <div class="row"><span>СТАТИК</span><span>#${esc(d.stat || '-')}</span></div><div class="row"><span>ПОСТ В ТЕМЕ</span><span>#${esc(d.num)}</span></div>
      ${d.age ? `<div class="row"><span>ВОЗРАСТ</span><span>${esc(d.age)}</span></div>` : ''}
      <hr>${onl}
      <hr><div class="row"><span>СОВПАДЕНИЕ С ШАБЛОНОМ</span><span>${d.match != null ? d.match + '%' : '-'}</span></div>
      <div class="row ${d.bl ? 'x' : ''}"><span>ЧС ЛИДЕРОВ</span><span>${d.bl ? 'ДА' : 'НЕТ'}</span></div>
      ${reasons}
      <hr><div class="row ${d.reasons.length ? 'x' : ''}"><span>НАРУШЕНИЙ</span><span>${d.reasons.length}</span></div>
      <div class="total"><span>ИТОГ</span><span style="color:${vc}">${verdict}</span></div>
      <div class="bc"></div><div class="c" style="font-size:11px;letter-spacing:.3em">${esc(String(d.stat || '0') + d.date.replace(/\D/g, '').slice(0, 8))}</div>
      <div class="thanks">${d.passed ? 'удачи на посту! ✦' : 'приходи в следующий раз'}</div>
      <div class="row small"><span>проверил: ${esc(d.by)}</span><span>чек №${esc(d.num)}</span></div>
    </div></div></div>`;
  }

  function dossier(d) {
    const c = d.passed ? '#1e8e5a' : '#c0392b';
    const notes = d.reasons.length ? d.reasons : (d.passed ? ['всё по требованиям'] : ['не подходит по шаблону']);
    if (d.passed && d.online) notes.push(`онлайн за неделю ${d.online.week}`);
    const rows = [...(d.stat ? [['Статик', '#' + d.stat]] : []), ['Пост в теме', '#' + d.num], ...d.fields.filter(([k]) => !/static/i.test(k))].slice(0, 7);
    if (d.online) rows.push(['Онлайн / мес.', d.online.month]);
    return `<div class="rp-ds"><div class="tab">ДЕЛО №${esc(d.stat || d.num)}</div><div class="folder"><div class="paper">
      <div class="clipx"></div><div class="photo">${esc(initials(d.author))}</div>
      <h4>АНКЕТА КАНДИДАТА</h4><div class="nm">${esc(d.author.replace(/_/g, ' '))}</div>
      <dl>${rows.map(([k, v]) => `<dt>${esc(typeof cleanFieldName === 'function' ? cleanFieldName(k) : k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <div class="notes"><h4 style="margin-bottom:6px">ЗАМЕТКИ ПРОВЕРЯЮЩЕГО</h4>
        ${notes.map((n, i) => `<div class="note ${d.passed ? 'g' : ''}" style="animation-delay:${.35 + i * .3}s"><span>${d.passed ? '✓' : '→'}</span>${esc(n)}</div>`).join('')}</div>
      <div class="sign"><span>${esc(d.date)}<br>Forum Checker</span><span style="text-align:right">проверил<br><b>${esc(d.by)}</b></span></div>
      <div class="stamp" style="color:${c}">${d.bl ? 'ЧС ЛИДЕРОВ' : d.passed ? 'ОДОБРЕНО' : 'ОТКАЗАНО'}</div>
    </div></div></div>`;
  }

  function build() {
    if (document.getElementById('modalReport')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="modalReport" style="z-index: 1850;">
        <div class="modal-card rp-card">
          <div class="modal-header"><span id="rpTitle">Отчёт картинкой</span>
            <span class="mascot-bubble-close" onclick="closeModal('modalReport')">✕</span></div>
          <div class="modal-body">
            <div class="rp-top">
              <div class="rp-seg" id="rpSeg"><button data-s="receipt">🧾 Чек</button><button data-s="dossier">📁 Досье</button></div>
              <span class="rp-hint">Скопируй и вставь в Discord через Ctrl+V</span>
            </div>
            <div class="rp-stage"><div id="rpView"></div></div>
          </div>
          <div class="modal-footer rp-foot">
            <button class="btn btn-secondary" id="rpReplay">↻ Ещё раз</button>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" id="rpSave">⬇ Сохранить PNG</button>
              <button class="btn btn-primary" id="rpCopy">📋 Копировать картинку</button>
            </div>
          </div>
        </div>
      </div>`);
    document.querySelectorAll('#rpSeg button').forEach(b => b.onclick = () => {
      rpStyle = b.dataset.s; try { localStorage.setItem(STYLE_KEY, rpStyle); } catch (e) {}
      if (typeof playUiSound === 'function') playUiSound('tab');
      draw();
    });
    document.getElementById('rpReplay').onclick = draw;
    document.getElementById('rpSave').onclick = save;
    document.getElementById('rpCopy').onclick = copy;
  }

  function draw() {
    document.querySelectorAll('#rpSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === rpStyle));
    const d = collect(rpItem);
    document.getElementById('rpTitle').textContent = `Отчёт · ${d.author}`;
    document.getElementById('rpView').innerHTML = rpStyle === 'dossier' ? dossier(d) : receipt(d);
  }

  async function snapshot() {
    if (typeof html2canvas !== 'function') throw new Error('нет html2canvas');
    const el = document.getElementById('rpView').firstElementChild;
    el.classList.add('rp-export');
    await new Promise(r => setTimeout(r, 50));
    try { return await html2canvas(el, { backgroundColor: '#0E0F14', scale: 2 }); }
    finally { el.classList.remove('rp-export'); }
  }

  // В демо на сайте копируем и сохраняем средствами браузера
  const api = () => (window.__DEMO_DATA__ ? null : (window.pywebview && window.pywebview.api) || null);

  async function copy() {
    try {
      const cv = await snapshot();
      const a = api();
      if (a && a.copy_report_image) {
        const r = await a.copy_report_image(cv.toDataURL('image/png'));
        if (!r || !r.success) throw new Error((r && r.error) || 'clipboard');
      } else {
        const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
      if (typeof playUiSound === 'function') playUiSound('done');
      showToast('🖼 Картинка скопирована - вставь в Discord через Ctrl+V', 'success', 3200);
    } catch (e) {
      showToast('Не получилось скопировать картинку, сохрани её как PNG', 'warning', 3200);
    }
  }

  async function save() {
    try {
      const cv = await snapshot();
      const name = `Отчёт_${collect(rpItem).author}.png`;
      const a = api();
      if (a && a.save_report_image) {
        const r = await a.save_report_image(cv.toDataURL('image/png'), name);
        if (r && r.cancelled) return;
        if (!r || !r.success) throw new Error((r && r.error) || 'save');
        showToast('PNG сохранён', 'success', 2400);
        return;
      }
      const link = document.createElement('a');
      link.download = name;
      link.href = cv.toDataURL('image/png');
      link.click();
      showToast('PNG сохранён', 'success', 2400);
    } catch (e) {
      showToast('Не получилось сохранить картинку', 'warning', 3000);
    }
  }

  window.openReportModal = (idx, isPassed) => {
    const item = isPassed ? state.passedList[idx] : state.failedList[idx];
    if (!item) return;
    rpItem = item; rpPassed = isPassed;
    build(); draw();
    openModal('modalReport');
  };

  // Кнопка в карточках кандидатов
  const addButtons = (listId, isPassed) => {
    document.querySelectorAll(`#${listId} .candidate-card`).forEach(card => {
      const acts = card.querySelector('.candidate-actions');
      if (!acts || acts.querySelector('.rp-btn-report')) return;
      const b = document.createElement('button');
      b.className = 'btn btn-pill btn-secondary rp-btn-report';
      b.textContent = '🖼 Отчёт';
      b.onclick = () => openReportModal(+card.dataset.idx, isPassed);
      acts.insertBefore(b, acts.children[1] || null);
    });
  };
  const wrap = (name, listId, isPassed) => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function (...a) { const r = orig.apply(this, a); addButtons(listId, isPassed); return r; };
  };
  wrap('renderPassedList', 'passedList', true);
  wrap('renderFailedList', 'failedList', false);
  addButtons('passedList', true);
  addButtons('failedList', false);

  // Кнопка в окне «Подробнее»
  const copyAll = document.getElementById('btnDetailCopyAll');
  if (copyAll && !document.getElementById('btnDetailReport')) {
    const b = document.createElement('button');
    b.className = 'btn btn-secondary'; b.id = 'btnDetailReport'; b.textContent = '🖼 Отчёт картинкой';
    b.onclick = () => { closeModal('modalDetail'); openReportModal(currentDetailIdx, currentDetailPassed); };
    const box = document.createElement('div'); box.style.cssText = 'display: flex; gap: 8px;';
    copyAll.replaceWith(box); box.append(copyAll, b);
  }
})();
