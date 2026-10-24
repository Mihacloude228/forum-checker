// ── Forum Checker Modern Frontend (WebView2 / Chromium) ──

// ── IN-APP TOAST NOTIFICATIONS (в стиле текущего гида) ──
function showToast(msg, type = 'info', duration = 3800, opts = {}) {
  let container = document.getElementById('appToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'appToastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const safeType = ['success', 'error', 'info', 'warning'].includes(type) ? type : 'info';
  toast.className = `app-toast toast-${safeType}`;

  const badge = { success: '✓', error: '✕', warning: '!', info: 'i' }[safeType];
  const guide = (typeof getCurrentGuide === 'function') ? getCurrentGuide() : null;
  const avatar = (guide && guide.sprite) || 'assets/mascot_idle.png';
  const guideName = (guide && guide.name) || 'hero';

  // Убираем эмодзи-префикс из текста: тип уже показан значком на аватаре
  const rawText = String(msg).replace(/^\s*(✅|❌|⚠️|ℹ️|⚡)\s*/u, '');
  const cleanText = (typeof escapeHtml === 'function') ? escapeHtml(rawText) : rawText;
  const action = opts && opts.action;

  toast.innerHTML = `
    <div class="app-toast-avatar">
      <img src="${avatar}" alt="">
      <span class="app-toast-badge">${badge}</span>
    </div>
    <div class="app-toast-body">
      <div class="app-toast-name">${escapeHtml ? escapeHtml(guideName) : guideName}</div>
      <div class="app-toast-content">${cleanText}</div>
      ${action ? `<button class="app-toast-action">${escapeHtml(action.label)}</button>` : ''}
    </div>
    <button class="app-toast-close" title="Закрыть">✕</button>
    <div class="app-toast-timer" style="animation-duration: ${duration}ms"></div>
  `;

  const closeBtn = toast.querySelector('.app-toast-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismissToast(toast);
    };
  }
  const actBtn = toast.querySelector('.app-toast-action');
  if (actBtn && action) {
    actBtn.onclick = (e) => {
      e.stopPropagation();
      try { action.fn(); } catch (_) {}
      dismissToast(toast);
    };
  }

  container.appendChild(toast);

  if (!(opts && opts.silent)) playUiSound('toast');

  const timer = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  toast.onclick = (e) => {
    if (e && e.target && (e.target.classList.contains('app-toast-close') || e.target.classList.contains('app-toast-action'))) return;
    clearTimeout(timer);
    if (String(msg).includes('обновление') || String(msg).includes('GitHub') || String(msg).includes('Доступно')) {
      if (typeof openReleasePage === 'function') openReleasePage();
    }
    dismissToast(toast);
  };
}

function dismissToast(toast) {
  if (!toast || toast._dismissed) return;
  toast._dismissed = true;
  toast.style.animation = 'toastSlideOut 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 280);
}

// Override native window.alert with application-styled toast notifications
window.alert = function(msg) {
  if (msg === undefined || msg === null) return;
  const str = String(msg);
  let type = 'info';
  const lower = str.toLowerCase();
  if (str.includes('✅') || lower.includes('успешно') || lower.includes('скопирован')) {
    type = 'success';
  } else if (str.includes('❌') || lower.includes('ошибка') || lower.includes('пуст') || lower.includes('не удал') || lower.includes('не найден') || lower.includes('приостановлен')) {
    type = 'error';
  } else if (str.includes('⚠️') || lower.includes('внимание') || lower.includes('предупреждение')) {
    type = 'warning';
  }
  showToast(str, type, 4000);
};

let state = {
  activeTab: 'auth',
  passedList: [],
  failedList: [],
  onlineList: [],
  rules: [],
  blacklist: [],
  config: {},
  guides: {},
  currentGuide: 'hero',
  failedSubfilter: 'all',
  selectedRuleIdx: -1
};

// Wait for pywebview API to be ready
window.addEventListener('pywebviewready', () => {
  console.log('pywebview ready, initializing state...');
  initApp();
});

// Fallback init if pywebview is already loaded or in browser testing
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  if (window.pywebview && window.pywebview.api) {
    initApp();
  }
});

async function initApp() {
  try {
    const initData = await window.pywebview.api.get_initial_data();
    state.config = initData.config || {};
    state.rules = initData.rules || [];
    state.blacklist = initData.blacklist || [];
    state.guides = initData.guides || {};
    state.presets = initData.presets || {};
    state.currentGuide = initData.config.selected_guide || 'hero';
    
    if (initData.discord_contact) state.discordContact = initData.discord_contact;

    // Auth statuses
    updateAuthIndicators(initData.auth);
    
    // Dynamic Build Name & Version
    if (initData.build_name) {
      const vEl = document.getElementById('statusBarVersion');
      if (vEl) vEl.textContent = initData.build_name;
      const rEl = document.getElementById('railBuildVersion');
      if (rEl) rEl.textContent = initData.build_name;
      const sEl = document.getElementById('settingsAppVersion');
      if (sEl) sEl.textContent = `Forum Checker ${initData.build_name}`;
    }
    
    // Config fields
    if (initData.config.forum_url) {
      document.getElementById('forumUrl').value = initData.config.forum_url;
    }
    if (initData.config.template) {
      document.getElementById('tmplText').value = initData.config.template;
    }

    // Вид меню (нижний док / боковая рейка)
    applyMenuLayout(state.config.menu_layout || getMenuLayout());
    applyListView(state.config.list_density || getListView().density, state.config.list_columns || getListView().cols);
    applyUiScale(state.config.ui_scale);
    renderPassedList();
    renderFailedList();
    renderOnlineList();

    // Rules
    renderRulesTable();

    // Guide profile
    updateGuideDisplay(state.currentGuide);

    // Check License Status (HWID Protection)
    if (initData.license) {
      state.license = initData.license;
      const b = document.getElementById('headerLicenseBadge');
      if (initData.license.is_revoked) {
        if (b) { b.className = 'status-pill p-bad'; b.textContent = 'Доступ отозван'; }
        document.getElementById('revokedHwidText').textContent = initData.license.hwid;
        openModal('modalRevoked');
        return;
      }
      if (!initData.license.is_activated) {
        if (b) { b.className = 'status-pill p-bad'; b.textContent = 'Требуется ключ'; }
        document.getElementById('licenseHwidText').textContent = initData.license.hwid;
        openModal('modalLicense');
        return;
      }
      if (b) { b.className = 'status-pill p-ok'; b.textContent = 'Лицензия активна'; }
    }

    // Disclaimer
    if (!initData.config.disclaimer_accepted) {
      showDisclaimer(true);
    }

    // Restore previous results if any
    if (initData.passed_candidates) {
      state.passedList = initData.passed_candidates;
      renderPassedList();
    }
    if (initData.failed_candidates) {
      state.failedList = initData.failed_candidates;
      renderFailedList();
    }
    if (initData.online_candidates) {
      state.onlineList = initData.online_candidates;
      renderOnlineList();
    }

    // Гид дня, приветствие по времени суток, реплики и «скука»
    await maybeRandomGuide();
    setTimeout(guideGreetByTime, 2500);
    startMascotDialogueLoop();
    startMascotIdleAnimationLoop();

    // Check for updates on GitHub (non-intrusive release notification)
    checkAppUpdates();

    setStatus('Готово к работе');
  } catch (err) {
    console.error('initApp error:', err);
  }
}

// ── GITHUB UPDATES & CHARACTER DIALOGUES ──
let updateState = null;
let updateReminderInterval = null;

async function checkAppUpdates() {
  try {
    const res = await window.pywebview.api.check_for_updates();
    if (res && res.has_update) {
      updateState = res;

      // Update version string in settings to show clickable link
      const setVerEl = document.getElementById('settingsAppVersion');
      if (setVerEl) {
        setVerEl.innerHTML = `<span style="color: #a78bfa; cursor: pointer; text-decoration: underline;" onclick="openReleasePage()" title="Открыть страницу релиза на GitHub">⚡ Доступно обновление ${res.remote_version} (Скачать)</span>`;
      }

      // Show toast in app
      showToast(`⚡ Доступно обновление ${res.remote_version}! Кликните, чтобы перейти на GitHub`, 'info', 8000);

      // Trigger guide dialogue immediately in character (always, even if browser auto-open is disabled)
      setTimeout(() => {
        triggerUpdateGuideDialogue(false);
      }, 1500);

      // Setup periodic reminder every 7 minutes (within 5-10 minutes range)
      if (!updateReminderInterval) {
        updateReminderInterval = setInterval(() => {
          triggerUpdateGuideDialogue(true);
        }, 7 * 60 * 1000);
      }
    }
  } catch (e) {
    console.error('Update check failed:', e);
  }
}

function triggerUpdateGuideDialogue(isReminder = false) {
  if (!updateState || !updateState.has_update) return;
  const guideKey = getNormalizedGuideKey(state.currentGuide) || 'hero';
  const guideDialogs = updateState.dialogs && (updateState.dialogs[guideKey] || updateState.dialogs['hero']);
  if (!guideDialogs) return;

  const phrase = isReminder ? guideDialogs.reminder : guideDialogs.initial;
  showMascotBubble(phrase);
  triggerMascotReaction('talk', phrase);
}

function openReleasePage() {
  if (updateState && updateState.release_url) {
    window.pywebview.api.open_browser_url(updateState.release_url);
  } else {
    window.pywebview.api.open_browser_url('https://github.com/Mihacloude228/forum-checker/releases');
  }
}

// ── NAVIGATION ──
function setupTabs() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-tab');
      selectTab(target);
    });
  });
}

function selectTab(tabKey) {
  if (state.activeTab !== tabKey) playUiSound('tab');
  state.activeTab = tabKey;
  
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabKey);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tabKey}`);
  });

  const titles = {
    auth: 'Авторизация на форуме',
    load: 'Загрузка темы форума',
    tmpl: 'Шаблон и разметка заявки',
    fields: 'Фильтры и критерии отбора',
    passed: 'Одобренные кандидаты',
    failed: 'Отклонённые кандидаты',
    online: 'Проверка онлайна в панели',
    settings: 'Настройки и база данных'
  };
  const overlines = {
    auth: 'ДОСТУП',
    load: 'ИСТОЧНИК',
    tmpl: 'СТРУКТУРА',
    fields: 'КРИТЕРИИ',
    passed: 'РЕЗУЛЬТАТЫ · ОДОБРЕНО',
    failed: 'РЕЗУЛЬТАТЫ · ОТКЛОНЕНО',
    online: 'ПРОВЕРКА · АКТИВНОСТЬ',
    settings: 'СИСТЕМА · КОНФИГУРАЦИЯ'
  };
  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.textContent = titles[tabKey] || tabKey;
  const overlineEl = document.getElementById('headerOverline');
  if (overlineEl) overlineEl.textContent = overlines[tabKey] || 'РАЗДЕЛ';

  if (tabKey === 'settings') {
    showSettingsSection('appearance');
  }
}

// ── ВИД МЕНЮ: НИЖНИЙ ДОК / БОКОВАЯ РЕЙКА ──
function getMenuLayout() {
  return document.body.classList.contains('layout-rail') ? 'rail' : 'dock';
}

function applyMenuLayout(layout) {
  const mode = layout === 'rail' ? 'rail' : 'dock';
  document.body.classList.toggle('layout-rail', mode === 'rail');
  document.body.classList.toggle('layout-dock', mode === 'dock');
  try { localStorage.setItem('fc-menu-layout', mode); } catch (e) {}
  ['dock', 'rail'].forEach(m => {
    const opt = document.getElementById(`layoutOpt-${m}`);
    if (opt) opt.classList.toggle('active', m === mode);
  });
}

async function setMenuLayout(layout) {
  applyMenuLayout(layout);
  showToast(layout === 'rail' ? 'Меню переключено на боковую рейку' : 'Меню переключено на нижний док', 'info', 2200);
  try { await saveGeneralSetting('menu_layout', layout); } catch (e) {}
}

// ── ВИД СПИСКОВ «ПОДОШЛИ / НЕ ПОДОШЛИ» ──
function getListView() {
  const cl = document.body.classList;
  const density = cl.contains('cand-rows') ? 'rows' : (cl.contains('cand-compact') ? 'compact' : 'cards');
  const cols = cl.contains('cand-cols-3') ? 3 : (cl.contains('cand-cols-2') ? 2 : 1);
  return { density, cols };
}

function applyListView(density, cols) {
  const d = ['cards', 'compact', 'rows'].includes(density) ? density : 'cards';
  const c = [1, 2, 3].includes(parseInt(cols, 10)) ? parseInt(cols, 10) : 1;
  const cl = document.body.classList;
  cl.toggle('cand-compact', d === 'compact');
  cl.toggle('cand-rows', d === 'rows');
  cl.toggle('cand-cols-2', c === 2);
  cl.toggle('cand-cols-3', c === 3);
  try { localStorage.setItem('fc-list-view', JSON.stringify({ density: d, cols: c })); } catch (e) {}
  document.querySelectorAll('.seg-btn[data-density]').forEach(b => b.classList.toggle('active', b.dataset.density === d));
  document.querySelectorAll('.seg-btn[data-cols]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.cols, 10) === c));
}

async function setListDensity(density) {
  applyListView(density, getListView().cols);
  try { await saveGeneralSetting('list_density', density); } catch (e) {}
}

async function setListColumns(cols) {
  applyListView(getListView().density, cols);
  try { await saveGeneralSetting('list_columns', cols); } catch (e) {}
}

// ── ОКНО БЕЗ СИСТЕМНОЙ РАМКИ: перетаскивание, размер, кнопки ──
function winApi() {
  return (window.pywebview && window.pywebview.api) ? window.pywebview.api : null;
}

function winMinimize() {
  const api = winApi();
  if (api && api.win_minimize) api.win_minimize();
}

async function winToggleMaximize() {
  const api = winApi();
  if (!api || !api.win_toggle_maximize) return;
  try {
    const res = await api.win_toggle_maximize();
    syncWinMaximized(res && res.maximized);
  } catch (e) {}
}

function winClose() {
  const api = winApi();
  if (api && api.win_close) api.win_close();
}

function syncWinMaximized(isMax) {
  document.body.classList.toggle('win-maximized', !!isMax);
  const btn = document.getElementById('btnWinMax');
  if (!btn) return;
  btn.title = isMax ? 'Восстановить' : 'Развернуть';
  btn.innerHTML = isMax
    ? '<svg viewBox="0 0 12 12"><rect x="2" y="4" width="6" height="6" rx="1"></rect><path d="M4 4V2.8a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8v4.4a.8.8 0 0 1-.8.8H8"></path></svg>'
    : '<svg viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" rx="1"></rect></svg>';
}

document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.main-header');
  if (header) {
    // Шапка - область перетаскивания окна (кроме кнопок и полей)
    // Двойной клик считаем вручную: системное перетаскивание «съедает» отпускание кнопки
    let lastHeaderDown = 0;
    header.addEventListener('mousedown', async (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, select, textarea, a, .win-controls')) return;
      const api = winApi();
      if (!api || !api.win_start_drag) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastHeaderDown < 380) {
        lastHeaderDown = 0;
        winToggleMaximize();
        return;
      }
      lastHeaderDown = now;
      try {
        const res = await api.win_start_drag();
        if (res && 'maximized' in res) syncWinMaximized(res.maximized);
      } catch (err) {}
    });
  }

  document.querySelectorAll('.win-grip').forEach(grip => {
    grip.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const api = winApi();
      if (!api || !api.win_start_resize) return;
      e.preventDefault();
      api.win_start_resize(grip.dataset.edge);
    });
  });
});

// ── ПАЛИТРА РАЗДЕЛОВ (Ctrl+E, по-старому Ctrl+K) И БЫСТРЫЙ ПЕРЕХОД Alt+1…8 ──
const NAV_SECTIONS = [
  { key: 'auth',     label: 'Авторизация', sub: 'Форум Majestic RP',   words: 'вход логин сессия' },
  { key: 'load',     label: 'Загрузка',    sub: 'Тема заявок',         words: 'ссылка url страницы посты' },
  { key: 'tmpl',     label: 'Шаблон',      sub: 'Форма заявки',        words: 'вопросы пост' },
  { key: 'fields',   label: 'Фильтры',     sub: 'Критерии отбора',     words: 'правила поля критерии' },
  { key: 'passed',   label: 'Подошли',     sub: 'Одобренные заявки',   words: 'одобренные кандидаты' },
  { key: 'failed',   label: 'Не подошли',  sub: 'Отсеянные заявки',    words: 'отказ отклонённые чс' },
  { key: 'online',   label: 'Онлайн',      sub: 'Проверка активности', words: 'активность панель' },
  { key: 'settings', label: 'Настройки',   sub: 'Конфигурация и ЧС',   words: 'чс экспорт гиды пресеты меню' }
];
let navPaletteSel = 0;
let navPaletteItems = [];

function isNavPaletteOpen() {
  const bg = document.getElementById('navPaletteBg');
  return !!(bg && bg.classList.contains('open'));
}

function openNavPalette() {
  const bg = document.getElementById('navPaletteBg');
  const input = document.getElementById('navPaletteInput');
  if (!bg || !input) return;
  bg.classList.add('open');
  input.value = '';
  navPaletteSel = 0;
  renderNavPalette();
  setTimeout(() => input.focus(), 0);
}

function closeNavPalette() {
  const bg = document.getElementById('navPaletteBg');
  if (bg) bg.classList.remove('open');
}

function renderNavPalette() {
  const input = document.getElementById('navPaletteInput');
  const list = document.getElementById('navPaletteList');
  if (!input || !list) return;
  const q = input.value.trim().toLowerCase();
  navPaletteItems = NAV_SECTIONS.filter(s => !q || `${s.label} ${s.sub} ${s.words}`.toLowerCase().includes(q));
  navPaletteSel = Math.min(navPaletteSel, Math.max(navPaletteItems.length - 1, 0));
  if (!navPaletteItems.length) {
    list.innerHTML = '<div class="nav-palette-empty">Такого раздела нет. Попробуй «фильтры» или «онлайн».</div>';
    return;
  }
  list.innerHTML = navPaletteItems.map((s, i) => {
    const icon = document.querySelector(`.app-nav .nav-item[data-tab="${s.key}"] .nav-svg`);
    return `<div class="nav-palette-item ${i === navPaletteSel ? 'sel' : ''}" data-i="${i}">
      ${icon ? icon.outerHTML : ''}<span><b>${s.label}</b><small>${s.sub}</small></span>
      <kbd>Alt+${NAV_SECTIONS.indexOf(s) + 1}</kbd></div>`;
  }).join('');
  list.querySelectorAll('.nav-palette-item').forEach(el => {
    el.addEventListener('click', () => pickNavPalette(+el.dataset.i));
  });
}

function pickNavPalette(idx) {
  const s = navPaletteItems[idx];
  if (!s) return;
  closeNavPalette();
  selectTab(s.key);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('navPaletteInput');
  if (input) input.addEventListener('input', () => { navPaletteSel = 0; renderNavPalette(); });
  const bg = document.getElementById('navPaletteBg');
  if (bg) bg.addEventListener('click', (e) => { if (e.target === bg) closeNavPalette(); });

  // Закрываем меню гида кликом мимо него
  document.addEventListener('click', (e) => {
    const dock = document.getElementById('guideDock');
    const menu = document.getElementById('mascotMenu');
    if (dock && menu && menu.style.display === 'block' && !dock.contains(e.target)) closeMascotMenu();
  });
});

window.addEventListener('keydown', (e) => {
  const tutCard = document.getElementById('tutorialCard');
  const tutorialOn = tutCard && tutCard.style.display !== 'none';

  if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyE' || e.code === 'KeyK') && !tutorialOn) {
    e.preventDefault();
    isNavPaletteOpen() ? closeNavPalette() : openNavPalette();
    return;
  }
  if (e.altKey && !e.ctrlKey && /^Digit[1-8]$/.test(e.code) && !tutorialOn) {
    e.preventDefault();
    closeNavPalette();
    selectTab(NAV_SECTIONS[parseInt(e.code.slice(5), 10) - 1].key);
    return;
  }
  if (!isNavPaletteOpen()) return;
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopImmediatePropagation(); closeNavPalette();
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = Math.max(navPaletteItems.length, 1);
    navPaletteSel = (navPaletteSel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    renderNavPalette();
  } else if (e.key === 'Enter') {
    e.preventDefault(); e.stopImmediatePropagation(); pickNavPalette(navPaletteSel);
  }
}, true);

function setStatus(text) {
  document.getElementById('statusBarText').textContent = text;
}

// ── AUTHENTICATION ──
function updateAuthIndicators(auth) {
  if (!auth) return;
  const forumOk = auth.forum;
  const panelOk = auth.panel;

  const fIcon = document.getElementById('forumAuthIcon');
  const fText = document.getElementById('forumAuthText');
  if (fIcon) fIcon.textContent = forumOk ? '✅' : '⚪';
  if (fText) {
    fText.textContent = forumOk ? 'Авторизован на форуме' : 'Не авторизован на форуме';
    fText.style.color = forumOk ? '#4ade80' : '#e2e8f0';
  }

  const pIcon = document.getElementById('panelAuthIcon');
  const pText = document.getElementById('panelAuthText');
  if (pIcon) pIcon.textContent = panelOk ? '✅' : '⚪';
  if (pText) {
    pText.textContent = panelOk ? 'Авторизован в Админ-панели' : 'Не авторизован в Панели';
    pText.style.color = panelOk ? '#4ade80' : '#e2e8f0';
  }
}

async function loginForum() {
  setStatus('Открыто окно авторизации на форуме...');
  const res = await window.pywebview.api.login_forum();
  updateAuthIndicators(res);
  setStatus(res.forum ? 'Успешный вход на форум' : 'Окно авторизации закрыто');
}

async function loginPanel() {
  setStatus('Открыто окно авторизации в Админ-панели...');
  const res = await window.pywebview.api.login_panel();
  updateAuthIndicators(res);
  setStatus(res.panel ? 'Успешный вход в панель' : 'Окно панели закрыто');
}

async function clearSession() {
  if (confirm('Очистить сохранённую сессию браузера?')) {
    await window.pywebview.api.clear_session();
    updateAuthIndicators({ forum: false, panel: false });
    setStatus('Сессия браузера очищена');
  }
}

// ── FORUM LOAD & SCRAPING ──
window.onLoadProgress = function(st) {
  if (!st) return;
  const pBar = document.getElementById('loadProgressBar');
  const pTxt = document.getElementById('loadProgText');
  const pPct = document.getElementById('loadProgPercent');
  if (typeof st === 'string') {
    if (st.startsWith('p:')) {
      const parts = st.substring(2);
      if (pTxt) pTxt.textContent = `Загрузка страницы ${parts}...`;
      if (parts.includes('/')) {
        const [cur, tot] = parts.split('/').map(Number);
        if (tot > 0) {
          const pct = Math.min(100, Math.round((cur / tot) * 100));
          if (pBar) pBar.style.width = `${pct}%`;
          if (pPct) pPct.textContent = `${pct}%`;
        }
      } else {
        if (pBar) pBar.style.width = '30%';
        if (pPct) pPct.textContent = '30%';
      }
    } else if (st === 'nav') {
      if (pTxt) pTxt.textContent = 'Подключение к теме форума...';
      if (pBar) pBar.style.width = '15%';
      if (pPct) pPct.textContent = '15%';
    } else if (st === 'login') {
      if (pTxt) pTxt.textContent = 'Ожидание авторизации...';
    }
  }
};

async function loadAllPages() {
  const url = document.getElementById('forumUrl').value.trim();
  if (!url) {
    alert('Введите ссылку на тему форума!');
    return;
  }
  const btn = document.querySelector('#pane-load button[onclick="loadAllPages()"]');
  if (btn) btn.disabled = true;
  setStatus('Загрузка всех страниц форума...');
  const pBar = document.getElementById('loadProgressBar');
  const pTxt = document.getElementById('loadProgText');
  const pPct = document.getElementById('loadProgPercent');
  if (pBar) pBar.style.width = '10%';
  if (pPct) pPct.textContent = '10%';
  if (pTxt) pTxt.textContent = 'Подключение к форуму...';
  
  try {
    const res = await window.pywebview.api.load_forum(url, 0);
    handleLoadResult(res);
  } catch (err) {
    alert(`Ошибка загрузки: ${err}`);
    setStatus(`Ошибка: ${err}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function loadSinglePage() {
  const url = document.getElementById('forumUrl').value.trim();
  const page = parseInt(document.getElementById('targetPageNum').value) || 2;
  if (!url) { alert('Введите ссылку на тему!'); return; }
  
  setStatus(`Загрузка страницы №${page}...`);
  const pBar = document.getElementById('loadProgressBar');
  const pTxt = document.getElementById('loadProgText');
  const pPct = document.getElementById('loadProgPercent');
  if (pBar) pBar.style.width = '20%';
  if (pPct) pPct.textContent = '20%';
  if (pTxt) pTxt.textContent = `Загрузка страницы №${page}...`;

  try {
    const res = await window.pywebview.api.load_forum(url, page);
    handleLoadResult(res);
  } catch (err) {
    alert(`Ошибка загрузки: ${err}`);
  }
}

async function loadNextPage() {
  const curPage = parseInt(document.getElementById('targetPageNum').value) || 2;
  document.getElementById('targetPageNum').value = curPage + 1;
  loadSinglePage();
}

function handleLoadResult(res) {
  if (res.error) {
    alert(`Ошибка загрузки: ${res.error}`);
    setStatus(`Ошибка: ${res.error}`);
    const pTxt = document.getElementById('loadProgText');
    if (pTxt) pTxt.textContent = `Ошибка: ${res.error}`;
    return;
  }
  document.getElementById('statPages').textContent = `Загружено страниц: ${res.page_count}`;
  document.getElementById('statPosts').textContent = `Всего постов: ${res.post_count}`;
  document.getElementById('loadProgressBar').style.width = '100%';
  document.getElementById('loadProgPercent').textContent = '100%';
  document.getElementById('loadProgText').textContent = `Готово! Загружено ${res.post_count} постов (${res.page_count} стр.).`;
  setStatus(`Загружено постов: ${res.post_count} (${res.page_count} стр.)`);
  triggerMascotReaction('talk', null);
  showMascotBubble(pickGuidePhrase('load', { n: res.post_count }), { replies: 'show', tab: 'load' });
}

async function clearAllPosts() {
  await window.pywebview.api.clear_posts();
  document.getElementById('statPages').textContent = 'Загружено страниц: 0';
  document.getElementById('statPosts').textContent = 'Всего постов: 0';
  document.getElementById('loadProgressBar').style.width = '0%';
  document.getElementById('loadProgPercent').textContent = '0%';
  document.getElementById('loadProgText').textContent = 'Данные очищены';
  state.passedList = [];
  state.failedList = [];
  renderPassedList();
  renderFailedList();
  setStatus('Все загруженные данные очищены');
  showToast('Все загруженные данные очищены', 'info');
}

// ── APPLICATIONS CHECKING ──
async function checkAllApplications() {
  setStatus('Идёт проверка заявок по фильтрам...');
  const res = await window.pywebview.api.check_all();
  if (res.error) {
    alert(res.error);
    setStatus(`Ошибка: ${res.error}`);
    return;
  }

  state.passedList = res.passed || [];
  state.failedList = res.failed || [];

  renderPassedList();
  renderFailedList();

  // Не открываем принудительно вкладки - пользователь сам перейдет туда, куда захочет
  setStatus(`Проверено: ${state.passedList.length} подошли, ${state.failedList.length} не подошли`);
  showToast(`✅ Проверка завершена: ${state.passedList.length} подошли, ${state.failedList.length} отклонено`, 'success', 3800, { silent: true });
  playUiSound('done');
  triggerMascotReaction('wink', null);
  showMascotBubble(pickGuidePhrase('check', { p: state.passedList.length, f: state.failedList.length }), { replies: 'show', tab: 'passed' });
}

// ── RENDERING CANDIDATE CARDS ──
function renderPassedList() {
  const container = document.getElementById('passedList');
  document.getElementById('badgePassed').textContent = state.passedList.length;
  document.getElementById('countPassed').textContent = state.passedList.length;

  const query = (document.getElementById('searchPassed').value || '').toLowerCase();
  container.innerHTML = '';
  pruneSelection('passed');
  let shown = 0;

  state.passedList.forEach((item, idx) => {
    const post = item.post;
    const res = item.res;
    const author = post.author || 'Неизвестный';
    const postNum = post.post_number || idx + 1;

    // Search filter
    if (query && !JSON.stringify(item).toLowerCase().includes(query)) {
      return;
    }

    const isSel = getSelection('passed').has(item);
    const card = document.createElement('div');
    card.className = `candidate-card passed${isSel ? ' is-selected' : ''}`;
    card.dataset.idx = idx;
    shown++;
    card.innerHTML = `
      <div class="candidate-header">
        <div class="candidate-author">
          ${candCheckHtml('passed', idx, isSel)}
          <span>${author}</span>
          <span class="candidate-post-num" onclick="openPostUrl('${post.url}')">#${postNum}</span>
        </div>
        <span class="badge badge-passed">✅ Одобрен</span>
      </div>
      <div class="candidate-fields">
        ${renderFieldsPills(res.fields)}
      </div>
      <div class="candidate-actions">
        <button class="btn btn-pill btn-secondary" onclick="openDetailModal(${idx}, true)">Подробнее</button>
        <button class="btn btn-pill btn-secondary" onclick="copyCandidateData(${idx}, true)">📋 Копировать</button>
        <button class="btn btn-pill btn-danger" onclick="rejectCandidate(${idx})">❌ Отклонить</button>
      </div>
    `;
    container.appendChild(card);
  });

  if (!shown) container.innerHTML = emptyStateFor('passed', query);
  updateBulkUI('passed');
}

function renderFailedList() {
  const container = document.getElementById('failedList');
  document.getElementById('badgeFailed').textContent = state.failedList.length;
  document.getElementById('countFailed').textContent = state.failedList.length;

  const regCount = state.failedList.filter(x => !x.res.is_blacklisted).length;
  const blCount = state.failedList.filter(x => x.res.is_blacklisted).length;

  document.getElementById('subfilterAll').textContent = `❌ Все отклонённые (${state.failedList.length})`;
  document.getElementById('subfilterRegular').textContent = `📋 Обычные отказы (${regCount})`;
  document.getElementById('subfilterBl').textContent = `🚫 ЧС лидеров (${blCount})`;

  const query = (document.getElementById('searchFailed').value || '').toLowerCase();
  container.innerHTML = '';
  pruneSelection('failed');
  let shown = 0;

  state.failedList.forEach((item, idx) => {
    const post = item.post;
    const res = item.res;
    const isBl = res.is_blacklisted;
    const author = post.author || 'Неизвестный';
    const postNum = post.post_number || idx + 1;

    // Subfilter
    if (state.failedSubfilter === 'regular' && isBl) return;
    if (state.failedSubfilter === 'blacklist' && !isBl) return;

    // Search query
    if (query && !JSON.stringify(item).toLowerCase().includes(query)) return;

    const isSel = getSelection('failed').has(item);
    const card = document.createElement('div');
    card.className = `candidate-card failed ${isBl ? 'blacklisted' : ''}${isSel ? ' is-selected' : ''}`;
    card.dataset.idx = idx;
    shown++;
    card.innerHTML = `
      <div class="candidate-header">
        <div class="candidate-author">
          ${candCheckHtml('failed', idx, isSel)}
          <span>${author}</span>
          <span class="candidate-post-num" onclick="openPostUrl('${post.url}')">#${postNum}</span>
        </div>
        ${isBl ? '<span class="badge badge-bl">🚫 ЧС ЛИДЕРОВ</span>' : '<span class="badge badge-failed">❌ Отклонён</span>'}
      </div>
      <div style="font-size: 12px; color: ${isBl ? '#fca5a5' : '#f87171'}; font-weight: 600;">
        Причина: ${res.reasons ? res.reasons.join(', ') : 'Не соответствует шаблону'}
      </div>
      <div class="candidate-fields">
        ${renderFieldsPills(res.fields)}
      </div>
      <div class="candidate-actions">
        <button class="btn btn-pill btn-secondary" onclick="openDetailModal(${idx}, false)">Подробнее</button>
        <button class="btn btn-pill btn-secondary" onclick="copyCandidateData(${idx}, false)">📋 Копировать</button>
        <button class="btn btn-pill btn-success" onclick="approveCandidate(${idx})">✅ Одобрить</button>
      </div>
    `;
    container.appendChild(card);
  });

  if (!shown) container.innerHTML = emptyStateFor('failed', query);
  updateBulkUI('failed');
}

function renderFieldsPills(fields) {
  if (!fields) return '';
  return Object.entries(fields).slice(0, 8).map(([k, v]) => `
    <div class="field-pill">
      <span class="field-name">${escapeHtml(k)}:</span>
      <span class="field-val">${escapeHtml(String(v))}</span>
    </div>
  `).join('');
}

function setFailedSubfilter(mode) {
  state.failedSubfilter = mode;
  document.getElementById('subfilterAll').style.background = mode === 'all' ? '#3b1d24' : '#1c1f2e';
  document.getElementById('subfilterRegular').style.background = mode === 'regular' ? '#2b2344' : '#1c1f2e';
  document.getElementById('subfilterBl').style.background = mode === 'blacklist' ? '#881337' : '#1c1f2e';
  renderFailedList();
}

function filterPassedList() { renderPassedList(); }
function filterFailedList() { renderFailedList(); }

// ── STATE TRANSFERS (Approve / Reject) ──
async function approveCandidate(failedIdx) {
  const item = state.failedList.splice(failedIdx, 1)[0];
  item.res.passed = true;
  state.passedList.push(item);
  await window.pywebview.api.sync_candidates(state.passedList, state.failedList);
  renderPassedList();
  renderFailedList();
  setStatus(`Кандидат ${item.post.author} перенесён в «Подошли»`);
  playUiSound('approve');
  guideReact('approve');
}

async function rejectCandidate(passedIdx) {
  const item = state.passedList.splice(passedIdx, 1)[0];
  item.res.passed = false;
  if (!item.res.reasons || item.res.reasons.length === 0) {
    item.res.reasons = ['Отклонён администратором вручную'];
  }
  state.failedList.push(item);
  await window.pywebview.api.sync_candidates(state.passedList, state.failedList);
  renderPassedList();
  renderFailedList();
  setStatus(`Кандидат ${item.post.author} перенесён в «Не подошли»`);
  playUiSound('reject');
  guideReact('reject');
}

function cleanFieldName(key) {
  let k = String(key || '').trim();
  k = k.replace(/\([^\)]*\)/g, '').trim();
  k = k.replace(/[:\.\?]+$/, '').trim();
  const low = k.toLowerCase();
  if (low.includes('discord') || low.includes('дискорд') || low.includes('дс')) return 'Discord ID';
  if (low.includes('static') || low.includes('статик') || low.includes('статистический')) return 'Static ID';
  if (low.includes('возраст') || low.includes('age')) return 'Возраст';
  if (low.includes('имя фамилия') || low.includes('фио')) return 'Имя Фамилия';
  if (low.includes('имя')) return 'Имя';
  if (low.includes('онлайн')) return 'Онлайн';
  if (low.includes('состав')) return 'Стартовый состав';
  if (low.includes('часовой')) return 'Часовой пояс';
  return k || key;
}

function copyCandidateData(idx, isPassed) {
  const item = isPassed ? state.passedList[idx] : state.failedList[idx];
  if (!item) return;
  const post = item.post || {};
  const res = item.res || {};
  const fields = res.fields || {};
  
  const lines = [];
  lines.push(`Автор: ${post.author || 'Неизвестный'}`);
  lines.push(`Пост: #${post.post_number || '?'}`);
  
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    const cleanK = cleanFieldName(k);
    let valStr = String(v).trim();
    lines.push(`${cleanK}: ${valStr}`);
  }
  
  const text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    copyTextFallback(text);
  }
  setStatus(`Данные ${post.author} скопированы`);
  guideReact('copy');
}

function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function openPostUrl(url) {
  if (url && window.pywebview) {
    window.pywebview.api.open_browser_url(url);
  }
}

// ── CANDIDATE DETAILS MODAL ──
let currentDetailIdx = -1;
let currentDetailPassed = true;

function openDetailModal(idx, isPassed) {
  currentDetailIdx = idx;
  currentDetailPassed = isPassed;
  const item = isPassed ? state.passedList[idx] : state.failedList[idx];
  if (!item) return;
  const post = item.post || {};
  const res = item.res || {};

  document.getElementById('detailTitle').textContent = `Заявка #${post.post_number || '?'} - ${post.author || 'Кандидат'}`;
  
  let html = `
    <div style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
      <div><strong>Автор:</strong> ${escapeHtml(post.author || 'Неизвестный')}</div>
      <div><strong>Статус:</strong> ${res.passed ? '<span style="color:#4ade80; font-weight:700;">✅ Одобрен</span>' : '<span style="color:#f87171; font-weight:700;">❌ Отклонён</span>'}</div>
    </div>
  `;

  if (res.reasons && res.reasons.length > 0) {
    html += `
      <div style="background: #2a151b; border: 1px solid #5c2230; padding: 10px; border-radius: 8px; color: #fda4af; margin-bottom: 14px;">
        <strong>Причины отказа:</strong> ${escapeHtml(res.reasons.join(', '))}
      </div>
    `;
  }

  html += `<div style="font-weight: 700; color: #c4b5fd; margin-bottom: 8px;">Извлечённые данные:</div>`;
  html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">`;
  for (const [k, v] of Object.entries(res.fields || {})) {
    if (!v) continue;
    html += `
      <div style="background: #1a1b24; padding: 8px 10px; border-radius: 6px; border: 1px solid #282d3d;">
        <span style="color: #94a3b8; font-size: 11px;">${escapeHtml(cleanFieldName(k))}:</span><br>
        <strong style="color: #ffffff; font-size: 13px;">${escapeHtml(String(v))}</strong>
      </div>
    `;
  }
  html += `</div>`;

  html += `<div style="font-weight: 700; color: #c4b5fd; margin-bottom: 8px;">Полный текст поста:</div>`;
  html += `<pre class="detail-post" style="background: #0e1017; border: 1px solid #282d3d; padding: 12px; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 12px; color: #cbd5e1; max-height: 280px; overflow-y: auto;">${escapeHtml(post.content || '')}</pre>`;

  document.getElementById('detailBody').innerHTML = html;

  const btnRej = document.getElementById('btnDetailReject');
  const btnApp = document.getElementById('btnDetailApprove');
  if (btnRej) btnRej.style.display = isPassed ? 'inline-block' : 'none';
  if (btnApp) btnApp.style.display = isPassed ? 'none' : 'inline-block';

  openModal('modalDetail');
}

function copyDetailModalAll() {
  if (currentDetailIdx < 0) return;
  const item = currentDetailPassed ? state.passedList[currentDetailIdx] : state.failedList[currentDetailIdx];
  if (!item) return;
  const post = item.post || {};
  const res = item.res || {};
  const fields = res.fields || {};

  const lines = [];
  lines.push(`Заявка #${post.post_number || '?'} - ${post.author || 'Кандидат'}`);
  lines.push(`Статус: ${res.passed ? 'Одобрен' : 'Отклонён'}`);
  if (res.reasons && res.reasons.length > 0) {
    lines.push(`Причины отказа: ${res.reasons.join(', ')}`);
  }
  lines.push('\nИзвлечённые данные:');
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    lines.push(`${cleanFieldName(k)}: ${String(v).trim()}`);
  }
  if (post.content) {
    lines.push('\nПолный текст поста:');
    lines.push(post.content.trim());
  }

  const text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  } else {
    copyTextFallback(text);
  }
  setStatus(`Вся информация по заявке #${post.post_number || '?'} скопирована`);
}

async function detailRejectCandidate() {
  if (currentDetailIdx < 0 || !currentDetailPassed) return;
  const item = state.passedList[currentDetailIdx];
  await rejectCandidate(currentDetailIdx);
  currentDetailPassed = false;
  currentDetailIdx = state.failedList.length - 1;
  openDetailModal(currentDetailIdx, false);
}

async function detailApproveCandidate() {
  if (currentDetailIdx < 0 || currentDetailPassed) return;
  const item = state.failedList[currentDetailIdx];
  await approveCandidate(currentDetailIdx);
  currentDetailPassed = true;
  currentDetailIdx = state.passedList.length - 1;
  openDetailModal(currentDetailIdx, true);
}

// ── ONLINE CHECK ──
async function startOnlineCheck() {
  if (state.passedList.length === 0) {
    alert('Сначала проверьте заявки! Список «Подошли» пуст.');
    return;
  }
  const cd = document.getElementById('onlineCooldown').value;
  document.getElementById('btnStartOnline').disabled = true;
  document.getElementById('btnCancelOnline').disabled = false;
  setStatus('Запуск проверки онлайна через админ-панель...');

  const res = await window.pywebview.api.start_online_check(parseInt(cd));
  if (res.error) {
    alert(res.error);
    document.getElementById('btnStartOnline').disabled = false;
    document.getElementById('btnCancelOnline').disabled = true;
  }
}

async function cancelOnlineCheck() {
  await window.pywebview.api.cancel_online_check();
  document.getElementById('btnStartOnline').disabled = false;
  document.getElementById('btnCancelOnline').disabled = true;
  setStatus('Проверка онлайна остановлена');
}

// Callback invoked from Python during online check progress
window.onOnlineProgress = function(data) {
  document.getElementById('onlineProgText').textContent = data.text || '';
  const pct = Math.round((data.progress || 0) * 100);
  document.getElementById('onlineProgressBar').style.width = `${pct}%`;
  document.getElementById('onlineProgPercent').textContent = `${pct}%`;
  
  if (data.results) {
    state.onlineList = data.results;
    renderOnlineList();
  }
  if (data.done) {
    document.getElementById('btnStartOnline').disabled = false;
    document.getElementById('btnCancelOnline').disabled = true;
    setStatus('Проверка онлайна завершена');
    showToast('✅ Проверка онлайна завершена!', 'success');
  }
};

function renderOnlineList() {
  const container = document.getElementById('onlineList');
  document.getElementById('badgeOnline').textContent = state.onlineList.length;
  document.getElementById('countOnline').textContent = state.onlineList.length;
  container.innerHTML = '';
  if (!state.onlineList.length) {
    container.innerHTML = emptyStateFor('online', '');
    return;
  }

  state.onlineList.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `candidate-card online-card${item.ok ? '' : ' online-err'}`;
    const status = item.online_now
      ? '<span class="online-status on">● Сейчас в игре</span>'
      : (item.last_seen ? `<span class="online-status">Был: ${escapeHtml(item.last_seen)}</span>` : '');
    const tile = (cls, icon, label, val) => `
      <div class="online-tile ${cls}">
        <span class="online-tile-label">${icon} ${label}</span>
        <strong>${escapeHtml(String(val || '-'))}</strong>
      </div>`;
    card.innerHTML = `
      <div class="candidate-header">
        <div class="candidate-author">
          <span>${escapeHtml(item.author)}</span>
          <span class="candidate-post-num">#${escapeHtml(String(item.static_id))}</span>
          ${status}
        </div>
        <button class="btn btn-pill btn-secondary" onclick="copyOnlineSingle(${idx})">📋 Копировать</button>
      </div>
      ${item.error ? `<div class="online-error">⚠️ ${escapeHtml(item.error)}</div>` : ''}
      <div class="online-tiles">
        ${tile('t-day', '☀️', 'За день', item.day)}
        ${tile('t-week', '📅', 'За неделю', item.week)}
        ${tile('t-month', '🗓️', 'За месяц', item.month)}
        ${tile('t-two', '📆', 'За 2 месяца', item.two_months)}
      </div>
      ${item.sessions ? `<div class="online-meta">Сессий за 2 месяца: ${item.sessions} · формат ч:мм · время МСК</div>` : ''}
    `;
    container.appendChild(card);
  });
}

function copyOnlineSingle(idx) {
  const item = state.onlineList[idx];
  const text = `${item.author} (Static #${item.static_id}) - День: ${item.day} | Неделя: ${item.week} | Месяц: ${item.month} | 2 месяца: ${item.two_months || '-'}`;
  navigator.clipboard.writeText(text);
  setStatus(`Скопирован онлайн ${item.author}`);
  showToast(`✅ Скопирован онлайн ${item.author}`, 'success', 2500);
}

function exportOnlineStats() {
  if (state.onlineList.length === 0) {
    alert('Список проверенного онлайна пуст!');
    return;
  }
  let text = '🕒 Статистика онлайна кандидатов:\n';
  state.onlineList.forEach((it, i) => {
    text += `${i + 1}. ${it.author} (#${it.post_number}, Static #${it.static_id}) - День: ${it.day} | Неделя: ${it.week} | Месяц: ${it.month} | 2 месяца: ${it.two_months || '-'}\n`;
  });
  navigator.clipboard.writeText(text);
  setStatus('Полный отчёт по онлайну скопирован в буфер обмена');
  showToast('✅ Полный отчёт по онлайну скопирован в буфер обмена!', 'success');
}

// ── TEMPLATE & RULES ──
async function saveTemplate() {
  const text = document.getElementById('tmplText').value;
  await window.pywebview.api.save_template(text);
  setStatus('Шаблон сохранён');
  showToast('✅ Шаблон сохранён', 'success', 2500);
}

async function extractTemplateFromPost1() {
  const res = await window.pywebview.api.get_post1_template();
  if (res.template) {
    document.getElementById('tmplText').value = res.template;
    setStatus('Шаблон извлечён из первого поста темы');
  } else {
    alert('Пост #1 не найден! Сначала загрузите тему.');
  }
}

async function autoFieldsFromTemplate() {
  const text = document.getElementById('tmplText').value;
  const res = await window.pywebview.api.auto_fields(text);
  if (res.rules) {
    state.rules = res.rules;
    renderRulesTable();
    selectTab('fields');
    setStatus(`Сгенерировано ${res.rules.length} полей фильтрации`);
  }
}

function getFilterTypeName(ft) {
  const map = {
    digits: '🔢 Только цифры',
    not_empty: '📝 Не пустое',
    alpha: '🔤 Только буквы',
    none: '👁️ Без проверки',
    any: '👁️ Без проверки',
    min: '📈 Число >=',
    max: '📉 Число <=',
    contains: '🔍 Содержит',
    not_contains: '🚫 НЕ содержит',
    discord: '💬 Формат Discord',
    regex: '⚡ RegEx'
  };
  return map[ft] || ft || '📝 Не пустое';
}

function renderRulesTable() {
  const tbody = document.getElementById('rulesTableBody');
  tbody.innerHTML = '';
  if (!state.rules.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="rules-empty">Фильтров нет. Нажми «➕ Добавить», «📋 Авто-поля» во вкладке «Шаблон» или выбери пресет в «Настройки → 03. Шаблоны фильтров».</td></tr>`;
    return;
  }
  state.rules.forEach((r, idx) => {
    const ft = r.ftype || r.filter_type || 'not_empty';
    const fv = r.fval || r.param || '';
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #28243c';
    tr.style.cursor = 'pointer';
    tr.onclick = () => selectRuleRow(idx);
    tr.innerHTML = `
      <td style="padding: 8px 12px; font-weight: 600; color: #ffffff;">${escapeHtml(r.name)}</td>
      <td style="padding: 8px 12px; color: #cbd5e1;">${escapeHtml(r.keyword)}</td>
      <td style="padding: 8px 12px; color: #c4b5fd;">${escapeHtml(getFilterTypeName(ft))}</td>
      <td style="padding: 8px 12px; color: #93c5fd;">${escapeHtml(fv || '-')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function selectRuleRow(idx) {
  state.selectedRuleIdx = idx;
  const rows = document.querySelectorAll('#rulesTableBody tr');
  rows.forEach((r, i) => {
    r.style.background = i === idx ? '#2d244c' : 'transparent';
  });
}

function onRuleTypeChange() {
  const ft = document.getElementById('ruleType').value;
  const pInput = document.getElementById('ruleParam');
  const pHelp = document.getElementById('ruleParamHelp');
  
  if (ft === 'digits') {
    pInput.placeholder = 'Параметр не нужен (проверяется, что в поле только цифры)';
    pInput.disabled = true;
    pInput.value = '';
    if (pHelp) pHelp.textContent = '💡 Проверяет, что кандидат указал число (например Static ID, возраст или числовой ID).';
  } else if (ft === 'not_empty') {
    pInput.placeholder = 'Параметр не нужен (проверяется, что поле не пустое)';
    pInput.disabled = true;
    pInput.value = '';
    if (pHelp) pHelp.textContent = '💡 Проверяет, что пункт заполнен любым содержательным текстом.';
  } else if (ft === 'alpha') {
    pInput.placeholder = 'Параметр не нужен (проверяется, что указаны только буквы)';
    pInput.disabled = true;
    pInput.value = '';
    if (pHelp) pHelp.textContent = '💡 Проверяет, что значение содержит только буквы (например реальное имя OOC).';
  } else if (ft === 'none') {
    pInput.placeholder = 'Параметр не нужен (значение просто извлекается в карточку)';
    pInput.disabled = true;
    pInput.value = '';
    if (pHelp) pHelp.textContent = '💡 Извлекает информацию в карточку кандидата без отсева и без ошибок.';
  } else if (ft === 'min') {
    pInput.disabled = false;
    pInput.placeholder = 'например: 16 (минимальный возраст или онлайн)';
    if (pHelp) pHelp.textContent = '💡 Кандидат проходит, если найденное число больше или равно указанному.';
  } else if (ft === 'max') {
    pInput.disabled = false;
    pInput.placeholder = 'например: 35 (максимальное число)';
    if (pHelp) pHelp.textContent = '💡 Кандидат проходит, если число меньше или равно указанному.';
  } else if (ft === 'contains') {
    pInput.disabled = false;
    pInput.placeholder = 'например: FIB или LSPD';
    if (pHelp) pHelp.textContent = '💡 Кандидат проходит, только если в ответе содержится указанный текст.';
  } else if (ft === 'not_contains') {
    pInput.disabled = false;
    pInput.placeholder = 'например: ЧС или Бан';
    if (pHelp) pHelp.textContent = '💡 Кандидат отклоняется, если в ответе найдено указанное запрещённое слово.';
  } else if (ft === 'discord') {
    pInput.placeholder = 'Параметр не нужен (авто-проверка тега или ID)';
    pInput.disabled = true;
    pInput.value = '';
    if (pHelp) pHelp.textContent = '💡 Проверяет корректность Discord ID (17-21 цифра) или тега пользователя.';
  } else if (ft === 'regex') {
    pInput.disabled = false;
    pInput.placeholder = 'например: ^[A-Za-z]+_[A-Za-z]+$';
    if (pHelp) pHelp.textContent = '💡 Проверка по шаблону регулярного выражения.';
  }
}

function openAddRuleModal() {
  state.selectedRuleIdx = -1;
  document.getElementById('ruleModalTitle').textContent = 'Добавить фильтр';
  document.getElementById('ruleName').value = '';
  document.getElementById('ruleKw').value = '';
  document.getElementById('ruleType').value = 'digits';
  document.getElementById('ruleParam').value = '';
  onRuleTypeChange();
  openModal('modalRule');
}

function editSelectedRule() {
  if (state.selectedRuleIdx < 0 || state.selectedRuleIdx >= state.rules.length) {
    alert('Выберите правило из таблицы для редактирования!');
    return;
  }
  const r = state.rules[state.selectedRuleIdx];
  document.getElementById('ruleModalTitle').textContent = 'Редактировать фильтр';
  document.getElementById('ruleName').value = r.name || '';
  document.getElementById('ruleKw').value = r.keyword || '';
  const ft = r.ftype || r.filter_type || 'not_empty';
  document.getElementById('ruleType').value = ft;
  document.getElementById('ruleParam').value = r.fval || r.param || '';
  onRuleTypeChange();
  openModal('modalRule');
}

async function saveRuleModal() {
  const name = document.getElementById('ruleName').value.trim();
  const kw = document.getElementById('ruleKw').value.trim();
  const ft = document.getElementById('ruleType').value;
  const param = document.getElementById('ruleParam').value.trim();

  if (!name || !kw) {
    alert('Заполните название и ключевое слово!');
    return;
  }

  const ruleObj = { 
    name, 
    keyword: kw, 
    ftype: ft, 
    filter_type: ft, 
    fval: param, 
    param: param 
  };
  if (state.selectedRuleIdx >= 0) {
    state.rules[state.selectedRuleIdx] = ruleObj;
  } else {
    state.rules.push(ruleObj);
  }

  closeModal('modalRule');
  renderRulesTable();
  await window.pywebview.api.save_rules(state.rules);
  setStatus('Правила сохранены');
}

function deleteSelectedRule() {
  if (state.selectedRuleIdx < 0 || state.selectedRuleIdx >= state.rules.length) {
    alert('Выберите правило из таблицы для удаления!');
    return;
  }
  const r = state.rules[state.selectedRuleIdx];
  state.confirmAction = null;
  setConfirmTexts('🗑️ Удаление фильтра', 'Удалить (Enter)');
  const msgEl = document.getElementById('confirmDeleteMsg');
  if (msgEl) {
    msgEl.innerHTML = `Вы действительно хотите удалить фильтр <strong>«${escapeHtml(r.name || 'Без названия')}»</strong>?`;
  }
  openModal('modalConfirmDelete');
  setTimeout(() => {
    const btnOk = document.getElementById('btnConfirmDeleteOk');
    if (btnOk) btnOk.focus();
  }, 50);
}

// Общее окно подтверждения (то же, что у удаления фильтра)
function setConfirmTexts(title, okLabel) {
  const t = document.getElementById('confirmDeleteTitle');
  if (t) t.textContent = title;
  const ok = document.getElementById('btnConfirmDeleteOk');
  if (ok) ok.textContent = okLabel;
}

function askConfirm({ title, html, okLabel, onOk }) {
  state.confirmAction = onOk;
  setConfirmTexts(title, okLabel || 'Удалить (Enter)');
  const msgEl = document.getElementById('confirmDeleteMsg');
  if (msgEl) msgEl.innerHTML = html;
  openModal('modalConfirmDelete');
  setTimeout(() => {
    const btnOk = document.getElementById('btnConfirmDeleteOk');
    if (btnOk) btnOk.focus();
  }, 50);
}

async function executeDeleteRule() {
  if (state.confirmAction) {
    const fn = state.confirmAction;
    state.confirmAction = null;
    closeModal('modalConfirmDelete');
    await fn();
    return;
  }
  if (state.selectedRuleIdx >= 0 && state.selectedRuleIdx < state.rules.length) {
    const rName = state.rules[state.selectedRuleIdx].name;
    state.rules.splice(state.selectedRuleIdx, 1);
    state.selectedRuleIdx = -1;
    renderRulesTable();
    closeModal('modalConfirmDelete');
    await window.pywebview.api.save_rules(state.rules);
    setStatus(`Фильтр «${rName}» удалён`);
  } else {
    closeModal('modalConfirmDelete');
  }
}

function deleteAllRules() {
  if (!state.rules.length) {
    showToast('Фильтров и так нет', 'info', 2400);
    return;
  }
  const n = state.rules.length;
  askConfirm({
    title: '🗑️ Удаление всех фильтров',
    html: `Удалить <strong>все фильтры (${n})</strong>? Стоковые фильтры сами больше не появятся - добавить их можно вручную или пресетом в Настройках.`,
    okLabel: 'Удалить все (Enter)',
    onOk: async () => {
      const backup = state.rules.slice();
      state.rules = [];
      state.selectedRuleIdx = -1;
      renderRulesTable();
      try { await window.pywebview.api.save_rules([]); } catch (e) {}
      setStatus(`Удалены все фильтры (${n})`);
      playUiSound('reject');
      showToast(`Удалено фильтров: ${n}`, 'warning', 6000, {
        silent: true,
        action: {
          label: '↶ Вернуть',
          fn: async () => {
            state.rules = backup;
            renderRulesTable();
            try { await window.pywebview.api.save_rules(state.rules); } catch (e) {}
            setStatus('Фильтры восстановлены');
          }
        }
      });
    }
  });
}

function clearOnlineResults() {
  const startBtn = document.getElementById('btnStartOnline');
  if (startBtn && startBtn.disabled) {
    showToast('Проверка онлайна ещё идёт - сначала отмените её', 'warning', 3000);
    return;
  }
  if (!state.onlineList.length) {
    showToast('Результатов проверки онлайна нет', 'info', 2400);
    return;
  }
  askConfirm({
    title: '🧹 Очистка онлайна',
    html: `Удалить результаты проверки онлайна (<strong>${state.onlineList.length}</strong> канд.)? Кандидаты во вкладке «Подошли» останутся.`,
    okLabel: 'Очистить (Enter)',
    onOk: async () => {
      let res = { success: true };
      try { res = await window.pywebview.api.clear_online_results(); } catch (e) {}
      if (res && res.success === false) {
        showToast(res.error || 'Не удалось очистить', 'error', 3500);
        return;
      }
      state.onlineList = [];
      renderOnlineList();
      document.getElementById('onlineProgText').textContent = 'Готово к проверке онлайна';
      document.getElementById('onlineProgressBar').style.width = '0%';
      document.getElementById('onlineProgPercent').textContent = '0%';
      setStatus('Результаты проверки онлайна очищены');
      showToast('Результаты онлайна очищены', 'success', 2600);
    }
  });
}

async function saveRulesConfig() {
  await window.pywebview.api.save_rules(state.rules);
  setStatus('Фильтры успешно сохранены');
}

// ── MASCOT & GUIDES ──
// ── MASCOT & GUIDES ──
function getNormalizedGuideKey(k) {
  if (!k) return 'hero';
  for (let key in state.guides) {
    if (key.toLowerCase() === String(k).toLowerCase()) return key;
  }
  return k;
}

function updateGuideDisplay(guideKey) {
  const normKey = getNormalizedGuideKey(guideKey);
  state.currentGuide = normKey;
  const guide = state.guides[normKey] || state.guides['hero'] || {
    display_name: 'hero (Официально и факты)',
    short_name: 'hero • Факты',
    greeting: 'Приветствую. Нужна справка по работе системы?',
    sub_greeting: 'Могу провести краткий инструктаж по алгоритму фильтрации заявок.',
    accent: '#8b5cf6',
    sprites: {
      idle: 'assets/mascot_idle.png',
      talk: 'assets/mascot_talk.png',
      wink: 'assets/mascot_wink.png',
      shrug: 'assets/mascot_shrug.png'
    }
  };
  
  const spriteMap = {
    hero: 'assets/mascot_idle.png',
    Fortuna: 'assets/fortuna_idle.png',
    fortuna: 'assets/fortuna_idle.png',
    sempitern: 'assets/sempitern_idle.png',
    Silvia: 'assets/silvia_idle.png',
    silvia: 'assets/silvia_idle.png',
    Skifzy: 'assets/skifzy_idle.png',
    skifzy: 'assets/skifzy_idle.png'
  };

  const sprite = (guide.sprites && guide.sprites.idle) || spriteMap[normKey] || 'assets/mascot_idle.png';
  const imgEl = document.getElementById('mascotImg');
  if (imgEl) {
    imgEl.src = sprite;
  }

  const nameEl = document.getElementById('mascotName');
  if (nameEl) {
    nameEl.textContent = guide.short_name || guide.display_name || normKey;
  }
  const greetEl = document.getElementById('mascotMenuGreeting');
  if (greetEl) {
    greetEl.textContent = `💬 ${guide.greeting || 'Привет!'}`;
  }
  const subEl = document.getElementById('mascotMenuSub');
  if (subEl) {
    subEl.textContent = guide.sub_greeting || '';
  }
  const speakEl = document.getElementById('bubbleSpeaker');
  if (speakEl) {
    speakEl.textContent = `💬 ${guide.short_name || normKey}:`;
  }
}

function toggleMascotMenu() {
  if (guideEggClick()) return;
  const menu = document.getElementById('mascotMenu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
function closeMascotMenu() {
  document.getElementById('mascotMenu').style.display = 'none';
}


function closeMascotBubble() {
  const b = document.getElementById('mascotBubble');
  if (b) b.style.display = 'none';
}

function triggerMascotReaction(emotion, text) {
  try {
    const normKey = getNormalizedGuideKey(state.currentGuide);
    const guide = state.guides[normKey] || state.guides['hero'];
    if (guide && guide.sprites && guide.sprites[emotion]) {
      const imgEl = document.getElementById('mascotImg');
      if (imgEl) {
        imgEl.src = guide.sprites[emotion];
        setTimeout(() => {
          const idleSprite = (guide.sprites && guide.sprites.idle) || 'assets/mascot_idle.png';
          if (imgEl) imgEl.src = idleSprite;
        }, 4000);
      }
    }
  } catch (e) {
    console.warn('triggerMascotReaction error:', e);
  }
  if (text) {
    showMascotBubble(text);
  }
}

function startMascotDialogueLoop() {
  restartGuideDialogLoop();
  bumpGuideIdle();
}

function startMascotIdleAnimationLoop() {
  setInterval(() => {
    try {
      const normKey = getNormalizedGuideKey(state.currentGuide);
      const guide = state.guides[normKey] || state.guides['hero'];
      if (!guide || !guide.sprites) return;
      const imgEl = document.getElementById('mascotImg');
      if (!imgEl) return;
      const altEmotions = ['wink', 'shrug'];
      const emo = altEmotions[Math.floor(Math.random() * altEmotions.length)];
      if (guide.sprites[emo]) {
        imgEl.src = guide.sprites[emo];
        setTimeout(() => {
          const idleSprite = (guide.sprites && guide.sprites.idle) || 'assets/mascot_idle.png';
          if (imgEl) imgEl.src = idleSprite;
        }, 2500);
      }
    } catch (e) {}
  }, 140000); // ~2.3 minutes
}

function openGuideSettings() {
  closeMascotMenu();
  selectTab('settings');
  showSettingsSection('guides');
}

// ── INTERACTIVE TUTORIAL WITH SOUNDS & GUIDE POINTING HAND ──
let tutorialStepIdx = 0;
let tutorialTypeTimer = null;
let tutSoundEnabled = true;

const sndStep = new Audio('assets/sounds/tut_step.wav');
const sndBlip = new Audio('assets/sounds/tut_blip.wav');

function toggleTutSound() {
  tutSoundEnabled = !tutSoundEnabled;
  const btn = document.getElementById('btnTutSound');
  if (btn) btn.textContent = tutSoundEnabled ? '🔊' : '🔇';
}

function playTutSound(type) {
  if (!tutSoundEnabled || !uiSoundsEnabled()) return;
  try {
    const snd = (type === 'blip') ? sndBlip : sndStep;
    if (snd) {
      snd.currentTime = 0;
      snd.volume = (type === 'blip') ? 0.35 : 0.55;
      snd.play().catch(() => {});
    }
  } catch (e) {}
}

function getGuideHand(guideKey) {
  const norm = (getNormalizedGuideKey(guideKey) || 'hero').toLowerCase();
  const map = {
    hero: 'assets/hands/hand_hero.png',
    fortuna: 'assets/hands/hand_fortuna.png',
    sempitern: 'assets/hands/hand_sempitern.png',
    silvia: 'assets/hands/hand_silvia.png',
    skifzy: 'assets/hands/hand_skifzy.png'
  };
  return map[norm] || 'assets/hands/hand_hero.png';
}

function positionTutorialHand(step) {
  const handEl = document.getElementById('tutorialPointingHand');
  const overlay = document.getElementById('tutorialSpotlightOverlay');
  const cutout = document.getElementById('tutorialCutout');
  const border = document.getElementById('tutorialCutoutBorder');
  if (!handEl || !step) return;

  // Clear existing highlights
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

  const stepTargetMap = {
    auth: '#btnLoginForum, #pane-auth button[onclick="loginForum()"], .nav-item[data-tab="auth"]',
    load: '#btnCheckAllApps, #pane-load button[onclick="loadAllPages()"], .nav-item[data-tab="load"]',
    tmpl: '#btnAutoFields, #pane-tmpl button[onclick="autoFieldsFromTemplate()"], .nav-item[data-tab="tmpl"]',
    fields: '#rulesTable, #pane-fields table, .nav-item[data-tab="fields"]',
    passed: '#passedList, .nav-item[data-tab="passed"]',
    failed: '#subfilterBl, .nav-item[data-tab="failed"]',
    online: '#btnStartOnline, .nav-item[data-tab="online"]',
    settings: '#btnSetNav-appearance, .nav-item[data-tab="settings"]'
  };

  let sel = step.selector || stepTargetMap[step.tab] || `.nav-item[data-tab="${step.tab}"]`;
  if (sel === '#passedList') {
    const firstCard = document.querySelector('#passedList .candidate-card');
    if (firstCard) sel = '#passedList .candidate-card:first-child';
  }

  const target = document.querySelector(sel);
  if (target) {
    target.classList.add('tutorial-highlight');
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch (e) {}

    const rawRect = target.getBoundingClientRect();
    // При масштабе интерфейса координаты переводим в «масштабированные» пиксели
    const z = (typeof getUiScale === 'function') ? getUiScale() : 1;
    const zoomedOut = (rawRect.width && target.offsetWidth) ? (rawRect.width / target.offsetWidth) : 1;
    const k = Math.abs(zoomedOut - 1) > 0.02 ? z : 1;
    const rect = { left: rawRect.left / k, top: rawRect.top / k, right: rawRect.right / k, bottom: rawRect.bottom / k, width: rawRect.width / k, height: rawRect.height / k };
    const pad = 6;
    const cx = Math.max(0, rect.left - pad);
    const cy = Math.max(0, rect.top - pad);
    const cw = rect.width + pad * 2;
    const ch = rect.height + pad * 2;

    const normKey = getNormalizedGuideKey(state.currentGuide);
    const guide = state.guides[normKey] || state.guides['hero'] || {};
    const accent = guide.accent || '#3b82f6';

    if (cutout) {
      cutout.setAttribute('x', cx);
      cutout.setAttribute('y', cy);
      cutout.setAttribute('width', cw);
      cutout.setAttribute('height', ch);
      cutout.setAttribute('rx', '8');
      cutout.setAttribute('ry', '8');
    }
    if (border) {
      border.setAttribute('x', cx);
      border.setAttribute('y', cy);
      border.setAttribute('width', cw);
      border.setAttribute('height', ch);
      border.setAttribute('rx', '8');
      border.setAttribute('ry', '8');
      border.setAttribute('stroke', accent);
    }
    if (overlay) {
      overlay.style.display = 'block';
    }

    const winW = window.innerWidth / k;
    const winH = window.innerHeight / k;

    // ── COLLISION AVOIDANCE FOR DIALOGUE CARD ──
    const card = document.getElementById('tutorialCard');
    if (card && card.style.display !== 'none') {
      const cardW = Math.min(530, winW - 36);
      const isTargetNearBottom = (rect.bottom > winH - 245);
      const isTargetRightOrCenter = (rect.right > winW - cardW - 30 || rect.left > 220);

      if (isTargetNearBottom && isTargetRightOrCenter) {
        card.style.top = '20px';
        card.style.bottom = 'auto';
      } else {
        card.style.bottom = '20px';
        card.style.top = 'auto';
      }
    }

    // ── STRICT HAND POSITIONING & SCREEN BOUNDS CLAMPING ──
    const handW = 58;
    const handH = 28;
    // Рука указывает влево только у боковой рейки; у нижнего дока - как у обычных элементов
    const isSidebar = !!target.closest('.app-nav') && document.body.classList.contains('layout-rail');

    let handX;
    let handY;
    let pointDir;

    if (isSidebar) {
      pointDir = 'pointing-left';
      handX = cx + cw + 10;
      handY = cy + (ch / 2) - (handH / 2);
    } else {
      pointDir = 'pointing-right';
      handX = cx - handW - 12;

      if (handX < 10) {
        if (cx + cw + handW + 16 < winW) {
          handX = cx + cw + 12;
          pointDir = 'pointing-left';
        } else {
          handX = Math.max(10, cx + 14);
          pointDir = 'pointing-right';
        }
      }

      const targetY = (ch > 140) ? (cy + 36) : (cy + (ch / 2) - (handH / 2));
      handY = targetY;
    }

    // Strictly clamp within visible screen boundaries
    handX = Math.max(10, Math.min(handX, winW - handW - 10));
    handY = Math.max(10, Math.min(handY, winH - handH - 10));

    handEl.className = `tutorial-pointing-hand ${pointDir}`;
    handEl.style.left = `${handX}px`;
    handEl.style.top = `${handY}px`;
    handEl.style.display = 'block';
  } else {
    handEl.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }
}

function lockTutorialSize() {
  const card = document.getElementById('tutorialCard');
  const body = card && card.querySelector('.tutorial-body');
  const ghost = document.getElementById('tutorialTextGhost');
  const titleEl = document.getElementById('tutorialStepTitle');
  if (!body || !ghost) return;
  const normKey = getNormalizedGuideKey(state.currentGuide);
  const guide = state.guides[normKey] || state.guides['hero'] || {};
  const steps = guide.steps || [];
  body.style.minHeight = '';
  const oldTitle = titleEl ? titleEl.textContent : '';
  let maxH = 0;
  steps.forEach(st => {
    ghost.textContent = st.text || '';
    if (titleEl) titleEl.textContent = st.title || '';
    maxH = Math.max(maxH, body.scrollHeight);
  });
  if (titleEl) titleEl.textContent = oldTitle;
  if (maxH) body.style.minHeight = `${maxH}px`;
}

function startTutorial() {
  closeMascotMenu();
  tutorialStepIdx = 0;
  const card = document.getElementById('tutorialCard');
  if (card) {
    card.style.display = 'flex';
    lockTutorialSize();
  }
  const overlay = document.getElementById('tutorialSpotlightOverlay');
  if (overlay) {
    overlay.style.display = 'block';
  }
  playTutSound('step');
  renderTutorialStep();
}

function finishTutorial() {
  if (tutorialTypeTimer) {
    clearTimeout(tutorialTypeTimer);
    tutorialTypeTimer = null;
  }
  const card = document.getElementById('tutorialCard');
  if (card) {
    card.style.display = 'none';
  }
  const handEl = document.getElementById('tutorialPointingHand');
  if (handEl) {
    handEl.style.display = 'none';
  }
  const overlay = document.getElementById('tutorialSpotlightOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
  const cutout = document.getElementById('tutorialCutout');
  if (cutout) {
    cutout.setAttribute('width', '0');
    cutout.setAttribute('height', '0');
  }
  const border = document.getElementById('tutorialCutoutBorder');
  if (border) {
    border.setAttribute('width', '0');
    border.setAttribute('height', '0');
  }
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));

  selectTab('auth');
  saveGeneralSetting('tutorial_completed', true);
  setStatus('Обучение завершено');
  playTutSound('step');
  showMascotBubble('Обучение завершено! Все разделы и ключевые функции освоены. Если понадобится помощь - кликайте по мне в левом нижнем углу! 🚀');
}

function renderTutorialStep() {
  const normKey = getNormalizedGuideKey(state.currentGuide);
  const guide = state.guides[normKey] || state.guides['hero'] || {};
  const steps = guide.steps || (state.guides['hero'] && state.guides['hero'].steps) || [];
  if (!steps || steps.length === 0) {
    finishTutorial();
    return;
  }

  const step = steps[tutorialStepIdx];
  if (!step) {
    finishTutorial();
    return;
  }

  // Switch tab automatically to match lesson
  if (step.tab) {
    selectTab(step.tab);
  }
  if (step.tab === 'settings' && step.section) {
    showSettingsSection(step.section);
  }

  // Position hand pointing at target element
  const handImg = document.getElementById('tutorialHandImg');
  if (handImg) {
    handImg.src = getGuideHand(normKey);
  }
  setTimeout(() => {
    positionTutorialHand(step);
  }, 120);

  const stepCategory = step.category || 'ОБЗОР';
  const badgeEl = document.getElementById('tutorialBadge');
  if (badgeEl) {
    badgeEl.textContent = `ШАГ ${tutorialStepIdx + 1} ИЗ ${steps.length} • ${stepCategory}`;
  }

  const stepTitleEl = document.getElementById('tutorialStepTitle');
  if (stepTitleEl) {
    stepTitleEl.textContent = step.title || '';
  }

  const guideNameEl = document.getElementById('tutorialGuideName');
  if (guideNameEl) guideNameEl.textContent = guide.short_name || normKey;

  const avatarEl = document.getElementById('tutorialAvatar');
  if (avatarEl) {
    const talkSprite = (guide.sprites && guide.sprites.talk) || (guide.sprites && guide.sprites.idle) || 'assets/mascot_talk.png';
    avatarEl.src = talkSprite;
  }

  const stepInd = document.getElementById('tutorialStepIndicator');
  if (stepInd) stepInd.textContent = `Шаг ${tutorialStepIdx + 1} из ${steps.length}`;

  const btnPrev = document.getElementById('btnTutPrev');
  if (btnPrev) btnPrev.disabled = (tutorialStepIdx === 0);

  const btnNext = document.getElementById('btnTutNext');
  if (btnNext) {
    if (tutorialStepIdx === steps.length - 1) {
      btnNext.innerHTML = 'Завершить 🚀 <kbd class="tut-enter-badge">Enter ↵</kbd>';
      btnNext.style.background = '#16a34a';
      btnNext.style.borderColor = '#22c55e';
    } else {
      btnNext.innerHTML = 'Далее ➡️ <kbd class="tut-enter-badge">Enter ↵</kbd>';
      btnNext.style.background = guide.accent || 'var(--accent)';
      btnNext.style.borderColor = guide.accent || 'var(--accent)';
    }
  }

  // Typewriter effect with typewriter blips
  if (tutorialTypeTimer) {
    clearTimeout(tutorialTypeTimer);
    tutorialTypeTimer = null;
  }
  const textEl = document.getElementById('tutorialText');
  const ghostEl = document.getElementById('tutorialTextGhost');
  const fullText = step.text || '';
  let charIdx = 0;
  textEl.textContent = '';
  // Невидимая копия полного текста держит размер - карточка не прыгает во время печати
  if (ghostEl) ghostEl.textContent = fullText;

  function typeTick() {
    charIdx = Math.min(fullText.length, charIdx + 1);
    textEl.textContent = fullText.substring(0, charIdx);
    if (charIdx % 6 === 0) {
      playTutSound('blip');
      if (avatarEl && guide.sprites) {
        const isMouthOpen = (Math.floor(charIdx / 6) % 2 === 0);
        avatarEl.src = isMouthOpen ? (guide.sprites.talk || guide.sprites.idle) : (guide.sprites.idle || guide.sprites.talk);
      }
    }
    if (charIdx < fullText.length) {
      // Медленнее, с паузами на знаках препинания
      const ch = fullText.charAt(charIdx - 1);
      const delay = /[.!?]/.test(ch) ? 170 : (/[,:;-]/.test(ch) ? 80 : 20);
      tutorialTypeTimer = setTimeout(typeTick, delay);
    } else {
      if (avatarEl && guide.sprites && guide.sprites.idle) {
        avatarEl.src = guide.sprites.idle;
      }
    }
  }
  typeTick();
}

function nextTutorialStep() {
  const normKey = getNormalizedGuideKey(state.currentGuide);
  const guide = state.guides[normKey] || state.guides['hero'] || {};
  const steps = guide.steps || [];
  if (tutorialStepIdx < steps.length - 1) {
    tutorialStepIdx++;
    playTutSound('step');
    renderTutorialStep();
  } else {
    finishTutorial();
  }
}

function prevTutorialStep() {
  if (tutorialStepIdx > 0) {
    tutorialStepIdx--;
    playTutSound('step');
    renderTutorialStep();
  }
}

// ── SETTINGS SECTIONS (01 - 06) ──
function showSettingsSection(sec) {
  const sections = ['appearance', 'blacklist', 'presets', 'online', 'export', 'guides'];
  sections.forEach(s => {
    const btn = document.getElementById(`btnSetNav-${s}`);
    if (btn) {
      if (s === sec) {
        btn.className = 'menu-btn menu-btn-primary';
      } else {
        btn.className = 'menu-btn menu-btn-secondary';
      }
    }
  });

  const container = document.getElementById('settingsContainer');
  let html = '';

  if (sec === 'appearance') {
    const activeColor = state.config.table_text_color || '#e9d5ff';
    const curLayout = getMenuLayout();
    const curList = getListView();
    const curScale = normScale(state.config.ui_scale);
    html = `
      <div class="card-title">01. Основные настройки</div>
      <div class="card-desc">Авто-открытие обновлений, закрепление окна, фоновый режим и оформление.</div>

      <div style="margin-top: 14px;">
        <div style="font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;">🧭 Вид меню разделов:</div>
        <div class="layout-picker">
          <div class="layout-option ${curLayout === 'dock' ? 'active' : ''}" id="layoutOpt-dock" onclick="setMenuLayout('dock')">
            <span class="layout-thumb t-dock"></span>
            <div><b>Нижний док</b><small>Плавающая панель внизу, контент на всю ширину</small></div>
          </div>
          <div class="layout-option ${curLayout === 'rail' ? 'active' : ''}" id="layoutOpt-rail" onclick="setMenuLayout('rail')">
            <span class="layout-thumb t-rail"></span>
            <div><b>Боковая рейка</b><small>Статичная колонка иконок слева</small></div>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #e2e8f0;">📋 Вид списков «Подошли» и «Не подошли»:</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Чем плотнее вид и больше колонок - тем больше заявок помещается на экран.</div>
        <div class="setting-line">
          <span class="setting-name">Плотность карточек</span>
          <div class="seg-group">
            <button class="seg-btn ${curList.density === 'cards' ? 'active' : ''}" data-density="cards" onclick="setListDensity('cards')">Обычные</button>
            <button class="seg-btn ${curList.density === 'compact' ? 'active' : ''}" data-density="compact" onclick="setListDensity('compact')">Компактные</button>
            <button class="seg-btn ${curList.density === 'rows' ? 'active' : ''}" data-density="rows" onclick="setListDensity('rows')">В одну строку</button>
          </div>
        </div>
        <div class="setting-line">
          <span class="setting-name">Колонок</span>
          <div class="seg-group">
            <button class="seg-btn ${curList.cols === 1 ? 'active' : ''}" data-cols="1" onclick="setListColumns(1)">1</button>
            <button class="seg-btn ${curList.cols === 2 ? 'active' : ''}" data-cols="2" onclick="setListColumns(2)">2</button>
            <button class="seg-btn ${curList.cols === 3 ? 'active' : ''}" data-cols="3" onclick="setListColumns(3)">3</button>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #e2e8f0;">🔍 Масштаб интерфейса:</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">«Авто» подбирает масштаб под разрешение экрана. Меньше - больше помещается, больше - крупнее текст.</div>
        <div class="setting-line">
          <div class="seg-group">
            ${UI_SCALES.map(p => `<button class="seg-btn ${String(curScale) === String(p) ? 'active' : ''}" data-scale="${p}" onclick="setUiScale('${p}')">${p === 'auto' ? 'Авто' : p + '%'}</button>`).join('')}
          </div>
          <span class="setting-hint" id="uiScaleAutoHint">${curScale === 'auto' ? `Сейчас: ${autoUiScale()}%` : ''}</span>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <label class="switch-row">
          <span class="switch-toggle">
            <input type="checkbox" id="setUiSounds" ${state.config.ui_sounds !== false ? 'checked' : ''} onchange="setUiSounds(this.checked)">
            <span class="switch-slider"></span>
          </span>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #f1f5f9;">🔔 Звуки интерфейса</div>
            <div style="font-size: 11px; color: #94a3b8;">Мягкие звуки при переключении вкладок, одобрении, отказе и уведомлениях. Выключите, и программа станет полностью беззвучной.</div>
          </div>
          <div class="vol-control" onclick="event.preventDefault()">
            <input type="range" min="10" max="100" step="5" value="${state.config.ui_sounds_volume != null ? state.config.ui_sounds_volume : 60}"
              oninput="setUiSoundsVolume(this.value)" onchange="playUiSound('tab')">
            <span id="uiSoundsVolLabel">${state.config.ui_sounds_volume != null ? state.config.ui_sounds_volume : 60}%</span>
          </div>
        </label>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;">
        <label class="switch-row">
          <span class="switch-toggle">
            <input type="checkbox" id="setAutoOpenRelease" ${state.config.auto_open_release !== false ? 'checked' : ''} onchange="saveGeneralSetting('auto_open_release', this.checked)">
            <span class="switch-slider"></span>
          </span>
          <div>
            <div style="font-weight: 600; color: #f1f5f9;">🌐 Авто-открытие страницы релиза в браузере</div>
            <div style="font-size: 11px; color: #94a3b8;">Открывать страницу обновления на GitHub в вашем браузере по умолчанию при обнаружении новой версии.</div>
          </div>
        </label>

        <label class="switch-row">
          <span class="switch-toggle">
            <input type="checkbox" id="setBgMode" ${state.config.background_mode ? 'checked' : ''} onchange="saveGeneralSetting('background_mode', this.checked)">
            <span class="switch-slider"></span>
          </span>
          <div>
            <div style="font-weight: 600; color: #f1f5f9;">🕶️ Фоновый режим парсера и проверки онлайна</div>
            <div style="font-size: 11px; color: #94a3b8;">Скрывать всплывающее вспомогательное окно Chromium при загрузке страниц и панели.</div>
          </div>
        </label>

        <label class="switch-row">
          <span class="switch-toggle">
            <input type="checkbox" id="setAlwaysTop" ${state.config.always_on_top ? 'checked' : ''} onchange="toggleAlwaysOnTop(this.checked)">
            <span class="switch-slider"></span>
          </span>
          <div>
            <div style="font-weight: 600; color: #f1f5f9;">📌 Закрепить поверх всех окон (Always on Top)</div>
            <div style="font-size: 11px; color: #94a3b8;">Окно Forum Checker остаётся на переднем плане (удобно при обзвоне в Discord).</div>
          </div>
        </label>

        <label class="switch-row">
          <span class="switch-toggle">
            <input type="checkbox" id="setCheckDups" ${state.config.check_dups !== false ? 'checked' : ''} onchange="saveGeneralSetting('check_dups', this.checked)">
            <span class="switch-slider"></span>
          </span>
          <div>
            <div style="font-weight: 600; color: #f1f5f9;">👥 Авто-отклонение дубликатов</div>
            <div style="font-size: 11px; color: #94a3b8;">Автоматически помечать повторные заявки с одинаковыми Static ID или Discord.</div>
          </div>
        </label>
      </div>

      <div style="margin-top: 20px; border-top: 1px solid var(--line-card); padding-top: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;">🎨 Цвет текста в таблицах и карточках:</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-pill" style="background: #2b2344; color: #e9d5ff;" onclick="applyTableTextColor('Лавандовый', '#e9d5ff')">Лавандовый</button>
          <button class="btn btn-pill" style="background: #232632; color: #ffffff;" onclick="applyTableTextColor('Белый', '#ffffff')">Белый</button>
          <button class="btn btn-pill" style="background: #112638; color: #38bdf8;" onclick="applyTableTextColor('Голубой', '#38bdf8')">Голубой</button>
          <button class="btn btn-pill" style="background: #122b1c; color: #4ade80;" onclick="applyTableTextColor('Изумрудный', '#4ade80')">Изумрудный</button>
          <button class="btn btn-pill" style="background: #332b13; color: #facc15;" onclick="applyTableTextColor('Золотой', '#facc15')">Золотой</button>
          <button class="btn btn-pill" style="background: #331525; color: #f472b6;" onclick="applyTableTextColor('Розовый', '#f472b6')">Розовый</button>
          <label style="display: flex; align-items: center; gap: 6px; margin-left: 8px; cursor: pointer; font-size: 12px; color: #cbd5e1;">
            <span>Свой цвет:</span>
            <input type="color" value="${activeColor}" onchange="applyTableTextColor('Свой', this.value)" style="border: none; width: 32px; height: 32px; background: transparent; cursor: pointer;">
          </label>
        </div>
      </div>

    `;
  } else if (sec === 'blacklist') {
    html = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">02. ЧС лидеров (Чёрный список)</div>
          <div class="card-desc">Кандидаты с совпадениями по Static ID или Discord автоматически отклоняются в подраздел 🚫 ЧС ЛИДЕРОВ.</div>
        </div>
        <button class="btn btn-secondary" onclick="openBlacklistSubfilterTab()">🚫 Открыть подраздел «ЧС лидеров»</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1.5fr auto; gap: 8px; margin-top: 14px;">
        <input type="text" class="input-text" id="blInputNick" placeholder="Никнейм / ФИ">
        <input type="text" class="input-text" id="blInputDiscord" placeholder="Discord ID / логин">
        <input type="text" class="input-text" id="blInputStatic" placeholder="Static ID">
        <input type="text" class="input-text" id="blInputNote" placeholder="Причина / сервер">
        <button class="btn btn-danger" onclick="addBlacklistItem()">➕ Добавить</button>
      </div>

      <div style="margin-top: 14px; flex: 1; overflow-y: auto; max-height: 400px;">
        ${renderBlacklistItems()}
      </div>
    `;
  } else if (sec === 'presets') {
    const allPresets = (state.presets && state.presets.presets) || {};
    const presetNames = (state.presets && state.presets.all_names) || Object.keys(allPresets);
    const optionsHtml = presetNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    html = `
      <div class="card-title">03. Шаблоны фильтров под лидерку</div>
      <div class="card-desc">Быстро переключайтесь между готовыми критериями отбора (Гос. структуры, Крайм) или сохраняйте свои наборы.</div>

      <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 14px; margin-top: 14px;">
        <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">Загрузить готовый пресет:</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select class="input-text" id="selectPresetName" style="flex: 1;">
            ${optionsHtml}
          </select>
          <button class="btn btn-primary" onclick="applyPresetFromSelect()">📥 Применить пресет</button>
          <button class="btn btn-danger" onclick="deletePresetFromSelect()">🗑️ Удалить пресет</button>
        </div>
      </div>

      <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 14px; margin-top: 14px;">
        <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">Сохранить текущие фильтры как новый пресет:</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input type="text" class="input-text" id="inputNewPresetName" placeholder="Название лидерки (напр: LSPD Обзвон / SANG / Yakuza)" style="flex: 1;">
          <button class="btn" style="background: #059669; color: #ffffff; font-weight: 700;" onclick="saveCurrentRulesAsPreset()">💾 Сохранить как пресет</button>
        </div>
      </div>
    `;
  } else if (sec === 'online') {
    html = `
      <div class="card-title">04. Проверка онлайна (Majestic Panel)</div>
      <div class="card-desc">Автоматический пробив суточного, недельного и месячного онлайна кандидатов из вкладки «Подошли».</div>

      <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 14px; margin-top: 14px; line-height: 1.6; font-size: 13px; color: #cbd5e1;">
        • Заранее входить в Админ-панель не нужно: авторизация потребуется только при старте проверки.<br>
        • Достаточно войти один раз - защищённая сессия сохраняется навсегда.<br>
        • Защитный кулдаун между запросами предотвращает ограничения со стороны панели.
      </div>

      <div style="display: flex; gap: 10px; align-items: center; margin-top: 16px; flex-wrap: wrap;">
        <span style="font-size: 13px; font-weight: 600;">Кулдаун:</span>
        <select class="input-text" id="setOnlineCooldown" style="width: 120px;" onchange="syncOnlineCooldown(this.value)">
          <option value="20" ${state.config.cooldown == 20 ? 'selected' : ''}>20 сек</option>
          <option value="25" ${(!state.config.cooldown || state.config.cooldown == 25) ? 'selected' : ''}>25 сек</option>
          <option value="30" ${state.config.cooldown == 30 ? 'selected' : ''}>30 сек</option>
        </select>
        <button class="btn btn-primary" onclick="startOnlineCheck()">🕒 Запустить проверку</button>
        <button class="btn btn-secondary" onclick="selectTab('online')">📊 Открыть вкладку «Онлайн»</button>
      </div>
    `;
  } else if (sec === 'export') {
    html = `
      <div class="card-title">05. Быстрый экспорт для Discord и итогов</div>
      <div class="card-desc">Копирование готовых тегов кандидатов, списков одобренных и отказов в один клик.</div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 16px;">
        <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #ffffff; font-size: 14px;">📣 Пинги Discord (&lt;@id&gt;)</div>
          <div style="font-size: 12px; color: #94a3b8;">Копирует готовые теги всех допущенных кандидатов для публикации в канале обзвона.</div>
          <button class="btn btn-primary" style="margin-top: auto;" onclick="exportDiscordPings()">Скопировать пинги</button>
        </div>

        <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #ffffff; font-size: 14px;">📝 Таблица одобренных</div>
          <div style="font-size: 12px; color: #94a3b8;">Список кандидатов с заполненными полями (Ник, статик, возраст, Discord, идеи).</div>
          <button class="btn btn-secondary" style="margin-top: auto;" onclick="exportPassedSummary()">Скопировать таблицу</button>
        </div>

        <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #fca5a5; font-size: 14px;">❌ Список отказов</div>
          <div style="font-size: 12px; color: #94a3b8;">Список отклонённых анкет с подробным указанием причины непрохождения фильтра.</div>
          <button class="btn btn-danger" style="margin-top: auto;" onclick="exportFailedSummary()">Скопировать отказы</button>
        </div>

        <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 14px;">🕒 Статистика онлайна</div>
          <div style="font-size: 12px; color: #94a3b8;">Итоги проверки онлайна за день, неделю и месяц для отправки в Discord.</div>
          <button class="btn btn-secondary" style="margin-top: auto;" onclick="exportOnlineStats()">Скопировать онлайн</button>
        </div>

        <div style="background: #181b28; border: 1px solid #282d40; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 700; color: #a78bfa; font-size: 14px;">⚡ Только пинги допущенных</div>
          <div style="font-size: 12px; color: #94a3b8;">Копирует исключительно теги &lt;@id&gt; через пробел без ников, номеров и лишнего текста.</div>
          <button class="btn btn-primary" style="margin-top: auto;" onclick="exportDiscordRawPings()">Только пинги допущенных без воды</button>
        </div>
      </div>
    `;
  } else if (sec === 'guides') {
    html = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title">06. Помощник и гиды</div>
          <div class="card-desc">Выберите интерактивного персонажа с уникальным характером, диалогами и стилем обучения.</div>
        </div>
        <button class="btn btn-primary" onclick="startTutorial()">🎓 Запустить обучение (20 шагов)</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; margin-top: 14px;">
        ${renderAuthenticGuideCards()}
      </div>

      <div style="margin-top: 20px; border-top: 1px solid #232738; padding-top: 14px;">
        ${renderGuideExtrasSettings()}
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderAuthenticGuideCards() {
  const normKey = getNormalizedGuideKey(state.currentGuide);
  const guidesList = [
    {
      key: 'hero',
      name: 'hero • Факты',
      desc: 'Официальный тон, проверенные факты, чёткая аналитика без воды.',
      img: 'assets/mascot_idle.png',
      accent: '#8b5cf6'
    },
    {
      key: 'Fortuna',
      name: 'Fortuna • Чилл',
      desc: 'На полном чилле и расслабоне. Объясняет просто, по-дружески и без суеты.',
      img: 'assets/fortuna_idle.png',
      accent: '#38bdf8'
    },
    {
      key: 'sempitern',
      name: 'sempitern • Грубиян',
      desc: 'Грубоватый и дерзкий характер: любит поторопить и слегка подколоть.',
      img: 'assets/sempitern_idle.png',
      accent: '#f43f5e'
    },
    {
      key: 'Silvia',
      name: 'Silvia • По делу',
      desc: 'Милая и внимательная девушка: объясняет очень бережно и чётко по делу.',
      img: 'assets/silvia_idle.png',
      accent: '#f472b6'
    },
    {
      key: 'Skifzy',
      name: 'Skifzy • Скуф',
      desc: 'Добряк: долго думает, зависает посреди мысли, тянет «Эммм...» и «Ммм...».',
      img: 'assets/skifzy_idle.png',
      accent: '#84cc16'
    }
  ];

  return guidesList.map(g => {
    const isSelected = normKey.toLowerCase() === g.key.toLowerCase();
    return `
      <div class="guide-select-card" onclick="selectGuide('${g.key}')" style="background: ${isSelected ? '#251b3d' : '#171924'}; border: 2px solid ${isSelected ? g.accent : '#292d3e'}; border-radius: 12px; padding: 14px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; transition: all 0.2s ease;">
        <img src="${g.img}" style="width: 58px; height: 58px; object-fit: contain; margin-bottom: 8px;">
        <div style="font-weight: 700; color: #ffffff; font-size: 13px;">${g.name}</div>
        <div style="font-size: 11px; color: #94a3b8; line-height: 1.4; margin: 6px 0 12px 0; min-height: 48px;">${g.desc}</div>
        <button class="btn btn-pill" style="width: 100%; margin-top: auto; font-size: 12px; font-weight: 700; background: ${isSelected ? g.accent : '#25293a'}; color: #ffffff;" onclick="event.stopPropagation(); selectGuide('${g.key}')">
          ${isSelected ? '✓ Выбран' : `Выбрать ${g.key}`}
        </button>
      </div>
    `;
  }).join('');
}

async function selectGuide(key) {
  state.currentGuide = key;
  updateGuideDisplay(key);
  showSettingsSection('guides');
  // Пустые экраны показывают нового гида
  renderPassedList();
  renderFailedList();
  renderOnlineList();
  await window.pywebview.api.set_guide(key);
  setStatus(`Выбран гид: ${key}`);
}

function renderBlacklistItems() {
  if (state.blacklist.length === 0) {
    return '<div style="color: #64748b; font-size: 12px; padding: 12px;">Чёрный список пуст.</div>';
  }
  return state.blacklist.map((item, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: center; background: #1c1f2e; padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; font-size: 12px; border: 1px solid #282d3e;">
      <span><strong>${escapeHtml(item.nick || '-')}</strong> (DS: ${escapeHtml(item.discord || '-')}, Static: ${escapeHtml(item.static || '-')}${item.note ? ` - ${escapeHtml(item.note)}` : ''})</span>
      <button class="btn btn-pill btn-danger" onclick="removeBlacklistItem(${idx})">🗑️</button>
    </div>
  `).join('');
}

async function addBlacklistItem() {
  const nick = document.getElementById('blInputNick').value.trim();
  const ds = document.getElementById('blInputDiscord').value.trim();
  const st = document.getElementById('blInputStatic').value.trim();
  const note = document.getElementById('blInputNote').value.trim();
  if (!nick && !ds && !st) {
    alert('Заполните хотя бы одно поле (Ник, Discord или Static ID)!');
    return;
  }
  state.blacklist.push({ nick, discord: ds, static: st, note });
  document.getElementById('blInputNick').value = '';
  document.getElementById('blInputDiscord').value = '';
  document.getElementById('blInputStatic').value = '';
  document.getElementById('blInputNote').value = '';
  showSettingsSection('blacklist');
  await window.pywebview.api.save_blacklist(state.blacklist);
  setStatus('Запись добавлена в ЧС');
}

async function removeBlacklistItem(idx) {
  state.blacklist.splice(idx, 1);
  showSettingsSection('blacklist');
  await window.pywebview.api.save_blacklist(state.blacklist);
  setStatus('Запись удалена из ЧС');
}

function openBlacklistSubfilterTab() {
  selectTab('failed');
  setFailedSubfilter('blacklist');
}

async function applyPresetFromSelect() {
  const sel = document.getElementById('selectPresetName');
  if (!sel || !sel.value) return;
  const name = sel.value;
  const allPresets = (state.presets && state.presets.presets) || {};
  const rules = allPresets[name];
  if (!rules) {
    alert(`Пресет "${name}" не найден!`);
    return;
  }
  state.rules = JSON.parse(JSON.stringify(rules));
  renderRulesTable();
  await window.pywebview.api.save_rules(state.rules);
  setStatus(`Применён пресет: "${name}" (${rules.length} правил)`);
  alert(`Шаблон фильтров "${name}" (${rules.length} правил) успешно применён во вкладку «⚙️ Фильтры»!`);
}

async function deletePresetFromSelect() {
  const sel = document.getElementById('selectPresetName');
  if (!sel || !sel.value) return;
  const name = sel.value;
  if (!confirm(`Удалить пресет "${name}"?`)) return;
  const res = await window.pywebview.api.delete_preset(name);
  if (res && res.success) {
    state.presets = res.presets;
    showSettingsSection('presets');
    setStatus(`Пресет "${name}" удалён`);
  } else {
    alert((res && res.error) || 'Не удалось удалить пресет');
  }
}

async function saveCurrentRulesAsPreset() {
  const input = document.getElementById('inputNewPresetName');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    alert('Введите название лидерки или пресета (например: "LSPD Обзвон")!');
    return;
  }
  if (!state.rules || state.rules.length === 0) {
    alert('Список правил пуст! Сначала настройте поля во вкладке «Фильтры».');
    return;
  }
  const res = await window.pywebview.api.save_preset(name, state.rules);
  if (res && res.success) {
    state.presets = res.presets;
    input.value = '';
    showSettingsSection('presets');
    setStatus(`Пресет "${name}" сохранён`);
    alert(`Пресет "${name}" успешно сохранён!`);
  } else {
    alert((res && res.error) || 'Ошибка сохранения пресета');
  }
}

async function applyTableTextColor(colorName, hexColor) {
  state.config.table_text_color = hexColor;
  state.config.table_text_color_name = colorName;
  document.documentElement.style.setProperty('--text-main', hexColor);
  await window.pywebview.api.set_table_text_color(colorName, hexColor);
  setStatus(`Цвет текста: ${colorName} (${hexColor})`);
  showSettingsSection('appearance');
}

async function copyTextToClipboard(text, successMsg) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setStatus(successMsg);
    alert(successMsg);
  } catch (err) {
    console.error('Clipboard error:', err);
    prompt('Скопируйте текст вручную (Ctrl+C):', text);
  }
}

async function exportDiscordPings() {
  const res = await window.pywebview.api.export_discord_pings();
  if (res && res.success) {
    await copyTextToClipboard(res.text, '✅ Пинги Discord скопированы в буфер обмена!');
  } else {
    alert((res && res.error) || 'Список «Подошли» пока пуст!');
  }
}

async function exportDiscordRawPings() {
  const res = await window.pywebview.api.export_discord_raw_pings();
  if (res && res.success) {
    await copyTextToClipboard(res.text, '⚡ Пинги допущенных (без воды) скопированы в буфер!');
  } else {
    alert((res && res.error) || 'Список «Подошли» пока пуст!');
  }
}

async function exportPassedSummary() {
  const res = await window.pywebview.api.export_passed_summary();
  if (res && res.success) {
    await copyTextToClipboard(res.text, '✅ Таблица одобренных скопирована в буфер обмена!');
  } else {
    alert((res && res.error) || 'Список «Подошли» пока пуст!');
  }
}

async function exportFailedSummary() {
  const res = await window.pywebview.api.export_failed_summary();
  if (res && res.success) {
    await copyTextToClipboard(res.text, '❌ Список отказов скопирован в буфер обмена!');
  } else {
    alert((res && res.error) || 'Список «Не подошли» пока пуст!');
  }
}

function syncOnlineCooldown(val) {
  state.config.cooldown = parseInt(val, 10);
  const el = document.getElementById('onlineCooldown');
  if (el) el.value = val;
  saveGeneralSetting('cooldown', state.config.cooldown);
}

async function saveGeneralSetting(key, val) {
  state.config[key] = val;
  await window.pywebview.api.save_config_key(key, val);
}

async function toggleAlwaysOnTop(val) {
  state.config.always_on_top = val;
  await window.pywebview.api.set_always_on_top(val);
}


// ── DISCLAIMER ──
let disclaimerTimer = null;
function showDisclaimer(firstLaunch) {
  openModal('modalDisclaimer');
  let timeLeft = 10;
  const btn = document.getElementById('btnDisclaimerContinue');
  btn.disabled = true;
  btn.textContent = `Продолжить (${timeLeft})`;

  if (disclaimerTimer) clearInterval(disclaimerTimer);
  disclaimerTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      btn.textContent = `Продолжить (${timeLeft})`;
    } else {
      clearInterval(disclaimerTimer);
      btn.disabled = false;
      btn.textContent = 'Продолжить';
    }
  }, 1000);
}

async function acceptDisclaimer() {
  if (disclaimerTimer) clearInterval(disclaimerTimer);
  closeModal('modalDisclaimer');
  const dontShow = document.getElementById('chkDontShowDisclaimer').checked;
  if (dontShow) {
    await window.pywebview.api.accept_disclaimer();
  }
}

// ── MODAL HELPERS ──
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'flex';
  if (!el.dataset.backdropBound) {
    el.dataset.backdropBound = 'true';
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        if (id === 'modalDisclaimer' || id === 'modalLicense' || id === 'modalRevoked') return;
        closeModal(id);
      }
    });
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Global key listener for modals, tutorial navigation, and filter deletion
window.addEventListener('keydown', (e) => {
  const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  const isEditingText = targetTag === 'input' || targetTag === 'textarea';

  // 1. Confirm Delete Modal: Enter confirms, Escape cancels
  const delModal = document.getElementById('modalConfirmDelete');
  if (delModal && delModal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeDeleteRule();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal('modalConfirmDelete');
      return;
    }
  }

  // 2. Escape closes modals
  if (e.key === 'Escape') {
    ['modalDetail', 'modalRule', 'modalConfirmDelete'].forEach(mId => {
      const el = document.getElementById(mId);
      if (el && el.style.display === 'flex') {
        closeModal(mId);
      }
    });
    return;
  }

  // 3. Tutorial: Enter key advances tutorial like clicking "Далее"
  const tutCard = document.getElementById('tutorialCard');
  if (tutCard && tutCard.style.display !== 'none') {
    if (e.key === 'Enter' && !isEditingText) {
      e.preventDefault();
      nextTutorialStep();
      return;
    }
  }

  // 4. Delete filter: 'Delete' key on Fields tab deletes selected rule
  if (e.key === 'Delete' && !isEditingText) {
    const paneFields = document.getElementById('pane-fields');
    if (paneFields && paneFields.classList.contains('active')) {
      e.preventDefault();
      deleteSelectedRule();
      return;
    }
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── LICENSE ACTIVATION & REVOCATION ──
function copyHwid() {
  if (state.license && state.license.hwid) {
    navigator.clipboard.writeText(state.license.hwid);
    setStatus('HWID скопирован в буфер обмена');
  }
}

// v3.3.0 · Получение ключа: код ПК в буфер + Discord, сайт программы
async function copyHwidAndOpenDiscord() {
  const hwid = (state.license && state.license.hwid) || (document.getElementById('licenseHwidText') || {}).textContent || '';
  try { await navigator.clipboard.writeText(hwid); } catch (e) { copyTextFallback(hwid); }
  const nick = state.discordContact || '_pinqx';
  showToast(`Код ПК скопирован. Отправь его в Discord: ${nick}`, 'success', 6000);
  try { await window.pywebview.api.open_discord(); } catch (e) {}
}

async function openSite() {
  try { await window.pywebview.api.open_site(); } catch (e) {}
}

function copyRevokedHwid() {
  if (state.license && state.license.hwid) {
    navigator.clipboard.writeText(state.license.hwid);
    setStatus('HWID скопирован в буфер обмена');
  }
}

async function activateLicenseKey() {
  const inp = document.getElementById('licenseKeyInput');
  const err = document.getElementById('licenseError');
  const key = inp.value.trim();
  if (!key) {
    err.textContent = 'Пожалуйста, введите ключ!';
    return;
  }
  err.textContent = '';
  setStatus('Проверка ключа активации...');
  const res = await window.pywebview.api.activate_license(key);
  if (res && res.success) {
    if (state.license) state.license.is_activated = true;
    const b = document.getElementById('headerLicenseBadge');
    if (b) {
      b.className = 'status-pill p-ok';
      b.textContent = 'Лицензия активна';
    }
    closeModal('modalLicense');
    setStatus('✅ Лицензия успешно активирована!');
    showToast('Лицензия успешно активирована!', 'success');
    if (state.activeTab === 'settings') {
      showSettingsSection('appearance');
    }
    if (!state.config.disclaimer_accepted) {
      showDisclaimer(true);
    }
  } else {
    err.textContent = (res && res.error) ? res.error : 'Неверный ключ активации для данного ПК!';
    setStatus('Ошибка активации ключа');
  }
}

async function deactivateLocalLicense() {
  if (!confirm('Вы действительно хотите деактивировать и сбросить лицензию на этом ПК? Программа вернётся к окну ввода ключа.')) return;
  try {
    setStatus('Сброс лицензии на данном ПК...');
    const res = await window.pywebview.api.deactivate_license();
    if (res && res.success) {
      if (state.license) state.license.is_activated = false;
      const b = document.getElementById('headerLicenseBadge');
      if (b) {
        b.className = 'status-pill p-bad';
        b.textContent = 'Требуется ключ';
      }
      const hwEl = document.getElementById('licenseHwidText');
      if (hwEl && state.license) hwEl.textContent = state.license.hwid;
      openModal('modalLicense');
      setStatus('Лицензия деактивирована на данном ПК.');
      showToast('Лицензия успешно сброшена', 'info');
      if (state.activeTab === 'settings') {
        showSettingsSection('appearance');
      }
    }
  } catch (err) {
    console.error('Error deactivating license:', err);
  }
}

async function checkRevocationAgain() {
  setStatus('Проверка статуса блокировки...');
  const res = await window.pywebview.api.check_revocation();
  if (res && !res.is_revoked) {
    closeModal('modalRevoked');
    location.reload();
  } else {
    alert('Доступ для данного ПК по-прежнему приостановлен разработчиком.');
    setStatus('Доступ заблокирован');
  }
}

// Remote Revocation Event Triggered from Python Background Worker
window.onHwidRevoked = function(hwid) {
  if (state.license) {
    state.license.is_revoked = true;
    state.license.is_activated = false;
  }
  const b = document.getElementById('headerLicenseBadge');
  if (b) {
    b.className = 'status-pill p-bad';
    b.textContent = 'Доступ отозван';
  }
  const el = document.getElementById('revokedHwidText');
  if (el) el.textContent = hwid || (state.license ? state.license.hwid : '');
  openModal('modalRevoked');
  setStatus('⛔ Доступ для данного ПК отозван разработчиком');
  if (state.activeTab === 'settings') {
    showSettingsSection('appearance');
  }
};

// Prevent DevTools & Source viewing shortcuts
window.addEventListener('keydown', (e) => {
  // F12
  if (e.key === 'F12' || e.keyCode === 123) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c' || e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  // Ctrl+U (View Source)
  if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

// Disable context menu on modal backdrop / license modals
document.addEventListener('contextmenu', (e) => {
  const modalLic = document.getElementById('modalLicense');
  const modalRev = document.getElementById('modalRevoked');
  if ((modalLic && modalLic.style.display === 'flex') || (modalRev && modalRev.style.display === 'flex')) {
    e.preventDefault();
  }
});

window.addEventListener('resize', () => {
  const card = document.getElementById('tutorialCard');
  if (card && card.style.display !== 'none') {
    const normKey = getNormalizedGuideKey(state.currentGuide);
    const guide = state.guides[normKey] || state.guides['hero'] || {};
    const steps = guide.steps || [];
    if (steps[tutorialStepIdx]) {
      positionTutorialHand(steps[tutorialStepIdx]);
    }
  }
});


// ═════════════════════════════════════════════════════════════
// v3.1.0 · ТЕКУЩИЙ ГИД (аватар и имя для тостов и пустых экранов)
// ═════════════════════════════════════════════════════════════
const GUIDE_IDLE_SPRITES = {
  hero: 'assets/mascot_idle.png',
  fortuna: 'assets/fortuna_idle.png',
  sempitern: 'assets/sempitern_idle.png',
  silvia: 'assets/silvia_idle.png',
  skifzy: 'assets/skifzy_idle.png'
};

function getCurrentGuide() {
  const key = getNormalizedGuideKey(state.currentGuide);
  const g = state.guides[key] || state.guides['hero'] || {};
  const sprite = (g.sprites && g.sprites.idle) || GUIDE_IDLE_SPRITES[String(key).toLowerCase()] || 'assets/mascot_idle.png';
  const name = (g.short_name || key || 'hero').split('•')[0].trim();
  return { key, sprite, name, full: g.short_name || key };
}

// ═════════════════════════════════════════════════════════════
// v3.1.0 · ПАКЕТНЫЕ ДЕЙСТВИЯ: выбор карточек, «Одобрить / Отклонить выбранные»
// ═════════════════════════════════════════════════════════════
const candSelection = { passed: new Set(), failed: new Set() };
const candLastClicked = { passed: -1, failed: -1 };

function getSelection(kind) { return candSelection[kind]; }
function listOf(kind) { return kind === 'passed' ? state.passedList : state.failedList; }

function pruneSelection(kind) {
  const alive = new Set(listOf(kind));
  candSelection[kind].forEach(it => { if (!alive.has(it)) candSelection[kind].delete(it); });
}

function candCheckHtml(kind, idx, on) {
  return `<button type="button" class="cand-check${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" aria-label="Выбрать"
    onclick="onCandCheck(event, '${kind}', ${idx})"></button>`;
}

function visibleIdx(kind) {
  const list = document.getElementById(kind === 'passed' ? 'passedList' : 'failedList');
  return [...list.querySelectorAll('.candidate-card[data-idx]')].map(c => parseInt(c.dataset.idx, 10));
}

function onCandCheck(e, kind, idx) {
  e.stopPropagation();
  const items = listOf(kind);
  const sel = candSelection[kind];
  const item = items[idx];
  if (!item) return;
  const turnOn = !sel.has(item);

  // Shift+клик - выделить диапазон от прошлого клика
  if (e.shiftKey && candLastClicked[kind] >= 0) {
    const vis = visibleIdx(kind);
    const a = vis.indexOf(candLastClicked[kind]);
    const b = vis.indexOf(idx);
    if (a >= 0 && b >= 0) {
      vis.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(i => {
        if (turnOn) sel.add(items[i]); else sel.delete(items[i]);
      });
    }
  } else {
    if (turnOn) sel.add(item); else sel.delete(item);
  }
  candLastClicked[kind] = idx;
  syncCardChecks(kind);
  playUiSound('tick');
}

function syncCardChecks(kind) {
  const items = listOf(kind);
  const sel = candSelection[kind];
  const list = document.getElementById(kind === 'passed' ? 'passedList' : 'failedList');
  list.querySelectorAll('.candidate-card[data-idx]').forEach(card => {
    const on = sel.has(items[parseInt(card.dataset.idx, 10)]);
    card.classList.toggle('is-selected', on);
    const box = card.querySelector('.cand-check');
    if (box) { box.classList.toggle('on', on); box.setAttribute('aria-checked', on); }
  });
  updateBulkUI(kind);
}

function updateBulkUI(kind) {
  const K = kind === 'passed' ? 'Passed' : 'Failed';
  const bar = document.getElementById(`bulkBar${K}`);
  const cnt = document.getElementById(`bulkCount${K}`);
  const all = document.getElementById(`selAll${K}`);
  const n = candSelection[kind].size;
  if (cnt && cnt.textContent !== String(n)) {
    cnt.textContent = n;
    cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
  }
  if (bar) bar.classList.toggle('open', n > 0);
  if (all) {
    const vis = visibleIdx(kind);
    const items = listOf(kind);
    const selVis = vis.filter(i => candSelection[kind].has(items[i])).length;
    all.classList.toggle('on', vis.length > 0 && selVis === vis.length);
    all.classList.toggle('partial', selVis > 0 && selVis < vis.length);
    all.disabled = vis.length === 0;
  }
}

function toggleSelectAll(kind) {
  const items = listOf(kind);
  const vis = visibleIdx(kind);
  const sel = candSelection[kind];
  const allOn = vis.length > 0 && vis.every(i => sel.has(items[i]));
  vis.forEach(i => { if (allOn) sel.delete(items[i]); else sel.add(items[i]); });
  syncCardChecks(kind);
  playUiSound('tick');
}

function clearSelection(kind) {
  candSelection[kind].clear();
  syncCardChecks(kind);
}

function candidateText(item) {
  const post = item.post || {};
  const fields = (item.res && item.res.fields) || {};
  const lines = [`Автор: ${post.author || 'Неизвестный'}`, `Пост: #${post.post_number || '?'}`];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    lines.push(`${cleanFieldName(k)}: ${String(v).trim()}`);
  }
  return lines.join('\n');
}

function bulkCopy(kind) {
  const items = listOf(kind).filter(it => candSelection[kind].has(it));
  if (!items.length) return;
  const text = items.map(candidateText).join('\n\n');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  else copyTextFallback(text);
  showToast(`Скопировано кандидатов: ${items.length}`, 'success', 2600);
  guideReact('copy');
}

async function bulkMove(kind) {
  const from = listOf(kind);
  const moving = from.filter(it => candSelection[kind].has(it));
  if (!moving.length) return;

  const snapshot = { passed: state.passedList.slice(), failed: state.failedList.slice(), res: new Map() };
  moving.forEach(it => snapshot.res.set(it, { passed: it.res.passed, reasons: it.res.reasons ? it.res.reasons.slice() : it.res.reasons }));

  // Выбранные карточки плавно уезжают, потом списки перестраиваются
  const listEl = document.getElementById(kind === 'passed' ? 'passedList' : 'failedList');
  listEl.querySelectorAll('.candidate-card.is-selected').forEach(c => c.classList.add('leaving'));
  await new Promise(r => setTimeout(r, 220));

  const keep = from.filter(it => !candSelection[kind].has(it));
  if (kind === 'passed') {
    moving.forEach(it => {
      it.res.passed = false;
      if (!it.res.reasons || it.res.reasons.length === 0) it.res.reasons = ['Отклонён администратором вручную'];
    });
    state.passedList = keep;
    state.failedList = state.failedList.concat(moving);
  } else {
    moving.forEach(it => { it.res.passed = true; });
    state.failedList = keep;
    state.passedList = state.passedList.concat(moving);
  }
  candSelection[kind].clear();
  try { await window.pywebview.api.sync_candidates(state.passedList, state.failedList); } catch (e) {}
  renderPassedList();
  renderFailedList();
  playUiSound(kind === 'passed' ? 'reject' : 'approve');
  guideReact('bulk', { n: moving.length }, null, true);

  const verb = kind === 'passed' ? 'Отклонено' : 'Одобрено';
  setStatus(`${verb} кандидатов: ${moving.length}`);
  showToast(`${verb} кандидатов: ${moving.length}`, kind === 'passed' ? 'warning' : 'success', 6000, {
    silent: true,
    action: {
      label: '↶ Отменить',
      fn: async () => {
        moving.forEach(it => { const r = snapshot.res.get(it); it.res.passed = r.passed; it.res.reasons = r.reasons; });
        state.passedList = snapshot.passed;
        state.failedList = snapshot.failed;
        try { await window.pywebview.api.sync_candidates(state.passedList, state.failedList); } catch (e) {}
        renderPassedList();
        renderFailedList();
        setStatus('Действие отменено');
      }
    }
  });
}

// Ctrl+A - выбрать все в открытом списке, Esc - снять выбор
window.addEventListener('keydown', (e) => {
  const kind = (state.activeTab === 'passed' || state.activeTab === 'failed') ? state.activeTab : null;
  if (!kind) return;
  const tag = ((e.target && e.target.tagName) || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ([...document.querySelectorAll('.modal-overlay')].some(m => m.style.display === 'flex')) return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
    e.preventDefault();
    toggleSelectAll(kind);
  } else if (e.key === 'Escape' && candSelection[kind].size) {
    clearSelection(kind);
  }
});

// ═════════════════════════════════════════════════════════════
// v3.1.0 · ПУСТЫЕ СОСТОЯНИЯ С ГИДОМ
// ═════════════════════════════════════════════════════════════
function emptyStateHtml({ title, text, btn, onclick, mood }) {
  const g = getCurrentGuide();
  return `
    <div class="empty-state ${mood ? 'mood-' + mood : ''}">
      <div class="empty-guide">
        <div class="empty-guide-glow"></div>
        <img src="${g.sprite}" alt="">
      </div>
      <div class="empty-bubble">
        <div class="empty-name">${escapeHtml(g.full)}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-text">${text}</div>
        ${btn ? `<button class="btn btn-primary empty-btn" onclick="${onclick}">${btn}</button>` : ''}
      </div>
    </div>`;
}

function emptyStateFor(kind, query) {
  if (query) {
    const field = kind === 'passed' ? 'searchPassed' : 'searchFailed';
    const render = kind === 'passed' ? 'renderPassedList' : 'renderFailedList';
    return emptyStateHtml({
      title: 'Никого не нашлось',
      text: `По запросу «${escapeHtml(query)}» в этом списке пусто. Проверь написание ника, статика или Discord.`,
      btn: '✕ Сбросить поиск',
      onclick: `document.getElementById('${field}').value=''; ${render}()`
    });
  }
  const nothingChecked = !state.passedList.length && !state.failedList.length;
  if (kind === 'online') {
    if (!state.passedList.length) {
      return emptyStateHtml({
        title: 'Пока некого проверять',
        text: 'Онлайн проверяется только у кандидатов из вкладки «Подошли». Сначала загрузи тему и проверь заявки.',
        btn: '📥 Перейти к загрузке', onclick: "selectTab('load')"
      });
    }
    return emptyStateHtml({
      title: 'Онлайн ещё не проверяли',
      text: `В «Подошли» сейчас ${state.passedList.length}. Запусти проверку - соберу онлайн за день, неделю и месяц.`,
      btn: '▶️ Запустить проверку', onclick: 'startOnlineCheck()'
    });
  }
  if (nothingChecked) {
    return emptyStateHtml({
      title: 'Заявок ещё нет',
      text: 'Загрузи тему с заявками во вкладке «Загрузка» и нажми «Проверить все заявки» - результаты появятся здесь.',
      btn: '📥 Перейти к загрузке', onclick: "selectTab('load')"
    });
  }
  if (kind === 'passed') {
    return emptyStateHtml({
      title: 'Никто не прошёл фильтры',
      text: `Все заявки (${state.failedList.length}) отсеяны. Загляни в «Не подошли» - возможно, фильтры слишком строгие.`,
      btn: '❌ Открыть «Не подошли»', onclick: "selectTab('failed')", mood: 'sad'
    });
  }
  return emptyStateHtml({
    title: 'Отказов нет 🎉',
    text: `Все заявки (${state.passedList.length}) прошли проверку. Можно переходить к онлайну и обзвону.`,
    btn: '✅ Открыть «Подошли»', onclick: "selectTab('passed')", mood: 'happy'
  });
}

// ═════════════════════════════════════════════════════════════
// v3.1.1 · МАСШТАБ ИНТЕРФЕЙСА: настоящий зум окна + «Авто» по разрешению экрана
// ═════════════════════════════════════════════════════════════
const UI_SCALES = ['auto', 90, 100, 110, 125];
let uiZoomNow = 1;

function getUiScale() {
  return uiZoomNow;
}

// «Авто»: подбираем масштаб по ширине экрана (в пикселях с учётом масштаба Windows)
function autoUiScale() {
  // screen.availWidth - ширина экрана с учётом масштаба Windows; зум страницы на неё не влияет
  const w = (window.screen && window.screen.availWidth) ? window.screen.availWidth : window.innerWidth * uiZoomNow;
  if (w <= 1400) return 90;
  if (w <= 1760) return 100;
  if (w <= 2300) return 110;
  return 125;
}

function normScale(v) {
  if (v === 'auto' || v === undefined || v === null || v === '') return 'auto';
  const n = parseInt(v, 10);
  return [90, 100, 110, 125].includes(n) ? n : 'auto';
}

async function applyUiScale(v) {
  const mode = normScale(v);
  const pct = mode === 'auto' ? autoUiScale() : mode;
  document.documentElement.style.zoom = '';
  document.querySelectorAll('.seg-btn[data-scale]').forEach(b => b.classList.toggle('active', String(b.dataset.scale) === String(mode)));
  const autoLbl = document.getElementById('uiScaleAutoHint');
  if (autoLbl) autoLbl.textContent = mode === 'auto' ? `Сейчас: ${pct}%` : '';
  try {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.set_ui_zoom) {
      const res = await window.pywebview.api.set_ui_zoom(pct);
      if (res && res.success) uiZoomNow = pct / 100;
    }
  } catch (e) {}
  return pct;
}

async function setUiScale(v) {
  const mode = normScale(v);
  state.config.ui_scale = mode;
  await applyUiScale(mode);
  try { await saveGeneralSetting('ui_scale', mode); } catch (e) {}
}

// ═════════════════════════════════════════════════════════════
// v3.1.0 · ЗВУКИ ИНТЕРФЕЙСА (синтез WebAudio, без внешних файлов)
// ═════════════════════════════════════════════════════════════
let uiAudioCtx = null;

function uiSoundsEnabled() {
  return state.config.ui_sounds !== false;
}

// v3.5.0 · звук «Тактильный», как на сайте: глухой мягкий «тук»
function playUiSound(kind) {
  if (!uiSoundsEnabled()) return;
  try {
    uiAudioCtx = uiAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = uiAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const vol = (state.config.ui_sounds_volume != null ? state.config.ui_sounds_volume : 60) / 100;
    const out = ctx.destination;
    // низкий «тук»: синус, падающий по высоте, через фильтр
    const thump = (f0, f1, dur, gain, delay = 0, lp = 800) => {
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
      f.type = 'lowpass'; f.frequency.value = lp;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * vol + 0.0001, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(f).connect(out);
      o.start(t); o.stop(t + dur + 0.02);
    };
    // короткий мягкий щелчок поверх «тука»
    const tap = (gain, delay = 0) => {
      const t = ctx.currentTime + delay, n = Math.floor(ctx.sampleRate * 0.015);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = gain * vol;
      src.connect(f).connect(g).connect(out); src.start(t);
    };
    switch (kind) {
      case 'tab':
      case 'tick':    thump(180, 90, 0.035, 0.22, 0, 900); break;
      case 'toast':   thump(180, 90, 0.035, 0.14, 0, 900); break;
      case 'reject':  thump(150, 55, 0.06, 0.32, 0, 700); tap(0.12); break;
      case 'approve': thump(160, 70, 0.045, 0.26, 0, 800); thump(220, 100, 0.045, 0.22, 0.09, 900); break;
      case 'done':    thump(120, 50, 0.08, 0.32, 0, 600); thump(240, 120, 0.05, 0.18, 0.07, 900); break;
      default:        thump(180, 90, 0.035, 0.18, 0, 900);
    }
  } catch (e) {}
}

async function setUiSounds(on) {
  state.config.ui_sounds = !!on;
  try { await saveGeneralSetting('ui_sounds', !!on); } catch (e) {}
  if (on) playUiSound('approve');
}

async function setUiSoundsVolume(v) {
  state.config.ui_sounds_volume = parseInt(v, 10);
  const lbl = document.getElementById('uiSoundsVolLabel');
  if (lbl) lbl.textContent = `${v}%`;
  try { await saveGeneralSetting('ui_sounds_volume', parseInt(v, 10)); } catch (e) {}
}

// ═════════════════════════════════════════════════════════════
// v3.1.1 · ЖИВЫЕ ГИДЫ: характер, время суток, реакции, болтливость,
// кнопки-ответы, свои фразы, гид дня, пасхалки
// ═════════════════════════════════════════════════════════════
const GUIDE_PHRASES = {
  hero: {
    morning: ['Доброе утро. Система готова, база фильтров загружена.', 'Утро - оптимальное время для разбора свежих заявок.'],
    day: ['Добрый день. Рабочий режим активен.', 'Приветствую. Готов к проверке заявок.'],
    evening: ['Добрый вечер. Самое время закрыть оставшиеся заявки.', 'Вечерняя смена начата. Статус системы: норма.'],
    night: ['Поздний час. Рекомендую не затягивать сессию - внимательность падает.', 'Ночь. Проверка доступна, но отдых тоже часть эффективности.'],
    approve: ['Кандидат одобрен. Запись обновлена.', 'Принято. Кандидат перенесён в «Подошли».'],
    reject: ['Кандидат отклонён. Причина сохранена.', 'Отказ зафиксирован.'],
    bulk: ['Пакетная операция выполнена: {n} записей.', 'Обработано разом: {n}. Эффективно.'],
    copy: ['Данные скопированы в буфер обмена.', 'Скопировано. Готово к вставке.'],
    check: ['Проверка завершена. Одобрено: {p}, отклонено: {f}.', 'Анализ окончен: {p} прошли, {f} отсеяны.'],
    load: ['Загружено постов: {n}. Можно запускать проверку.', 'Индексация завершена: {n} постов.'],
    idle: ['Фиксирую простой. Продолжим?', 'Система в ожидании ваших действий.'],
    eggs: ['Факт: вы кликнули по мне 5 раз. Это не ускоряет проверку.', 'Обнаружена повышенная активность кликов. Протокол «пасхалка» активирован.', 'Статистика: 100% гидов не любят, когда в них тыкают.']
  },
  fortuna: {
    morning: ['Утречко, бро ☀️ Кофеёк взял? Тогда погнали 🤙', 'Йоу, доброе утро! Заявки сами себя не проверят, но мы не спешим 🍹'],
    day: ['Йоу, бро! Всё на чилле, погнали проверять 😎', 'Здарова! Сегодня всё по кайфу 🤙'],
    evening: ['Вечерочек, бро 🌆 Закинем пару заявочек и на расслабон', 'Йоу, вечер - лучшее время для чилл-проверки 🍹'],
    night: ['Бро, уже ночь 🌙 Может, чиллим завтра?', 'Ночной движ? Ну окей, только не засыпай над заявками 😴'],
    approve: ['Красава, одобрили 🤙', 'Изи, ещё один в «Подошли» 😎'],
    reject: ['Ну не судьба, бро 🤷', 'Окей, этот мимо, чиллим дальше 🍹'],
    bulk: ['Оп, сразу {n} штук - вот это вайб 🤙', '{n} за раз? Ты машина, бро 😎'],
    copy: ['Скопировал, кидай куда надо 🤙', 'Есть, в буфере 📋'],
    check: ['Всё, разложил: {p} норм, {f} мимо 🤙', 'Готово, бро! {p} подошли, {f} нет 😎'],
    load: ['Подгрузил {n} постов, жми проверку 🤙', '{n} постов на месте, погнали 🍹'],
    idle: ['Бро, ты тут? Я уже второй чай допил 🍹', 'Чилл - это хорошо, но заявки ждут 😅'],
    eggs: ['Ай, щекотно, бро 😂', 'Хей, полегче, я тут чиллю 🍹', 'Пять кликов? Держи виртуальный коктейль 🍹🤙']
  },
  sempitern: {
    morning: ['Проснулся наконец? Заявки уже заждались 😈', 'Утро. Давай без раскачки, жми кнопки.'],
    day: ['Ну что, работаем или опять в телефоне сидишь? 😤', 'О, явился. Погнали, не тормози.'],
    evening: ['Вечер, а у тебя ещё ничего не проверено? Класс 🙄', 'Давай быстрее, я тоже хочу отдохнуть 😈'],
    night: ['Ночь на дворе, а ты тут сидишь. Ну ладно, сам выбрал 😈', 'Спать иди. Хотя нет, сначала заявки допроверь.'],
    approve: ['Ну наконец-то хоть кого-то одобрил.', 'Одобрил. Надеюсь, не пожалеешь 😏'],
    reject: ['Правильно, нечего таким делать в лидерках 😈', 'Мимо. Следующий!'],
    bulk: ['{n} разом? О, ты умеешь работать, кто бы мог подумать 😏', 'Вот так бы сразу, {n} штук за клик.'],
    copy: ['Скопировал. Теперь не потеряй.', 'В буфере. Вставляй уже.'],
    check: ['Готово: {p} годных, {f} мусора 😈', 'Проверил за тебя: {p} подошли, {f} нет. Не благодари.'],
    load: ['{n} постов загрузил. Чего ждёшь? Жми проверку!', 'Загружено {n}. Проверку сам нажмёшь или мне?'],
    idle: ['Ты уснул там? 😤', 'Эй, я не для красоты тут сижу. Работай!'],
    eggs: ['Ещё раз ткнёшь - укушу 😈', 'Тебе заняться нечем? Заявки иди проверяй!', 'Пять кликов. Пять! Серьёзно? 😤']
  },
  silvia: {
    morning: ['Доброе утро 🌸 Давай спокойно и по порядку разберём заявки.', 'Утро - отличное время, пока голова свежая ✨'],
    day: ['Привет! Если что-то непонятно - я рядом 🌸', 'Добрый день! Начнём с загрузки темы?'],
    evening: ['Добрый вечер 🌙 Не забывай делать перерывы.', 'Вечер - можно спокойно доделать оставшееся ✨'],
    night: ['Уже поздно 🌙 Береги себя, остальное можно завтра.', 'Ночью легко ошибиться - проверяй спорные заявки внимательнее 🌸'],
    approve: ['Отлично, кандидат одобрен ✨', 'Хороший выбор, он в «Подошли» 🌸'],
    reject: ['Понятно, отклонили. Причина сохранена.', 'Хорошо, этот кандидат не подходит.'],
    bulk: ['Готово: обработано {n} кандидатов разом ✨', 'Аккуратно сделано - {n} за один раз 🌸'],
    copy: ['Скопировала, можно вставлять 📋', 'Готово, данные в буфере ✨'],
    check: ['Проверка готова: {p} подошли, {f} не подошли 🌸', 'Всё разобрала: {p} - подходят, {f} - нет ✨'],
    load: ['Загружено {n} постов. Теперь можно нажать «Проверить» 🌸', 'Тема загружена: {n} постов ✨'],
    idle: ['Если устал - сделай небольшой перерыв 🌸', 'Я подожду, не торопись ✨'],
    eggs: ['Ой! 🌸 Это было неожиданно', 'Хи-хи, мне приятно, но давай работать ✨', 'Ты что, проверяешь, живая ли я? 🌸']
  },
  skifzy: {
    morning: ['Эммм... Утро уже? Ааа... Ну, доброе...', 'Ммм... Я ещё не проснулся... Но ты давай, проверяй...'],
    day: ['Ааа... Привет... Я тут думал... Забыл о чём...', 'Эммм... День... Заявки... Да, точно, заявки!'],
    evening: ['Ммм... Вечер... Я ещё не всё понял с утра...', 'Эээ... Уже вечер? Время так быстро...'],
    night: ['Ааа... Ночь... Я, кажется, засыпаю... Ммм...', 'Эммм... Темно... Ты тоже не спишь?'],
    approve: ['Ааа... Одобрил... Это хорошо, да?', 'Эммм... Он прошёл! Кажется...'],
    reject: ['Ммм... Не подошёл... Жалко...', 'Эээ... Отклонил? Ну ладно...'],
    bulk: ['Эммм... {n} сразу? Я даже посчитать не успел...', 'Ааа... Сколько? {n}? Ого...'],
    copy: ['Ммм... Скопировал... Куда вставлять, я не знаю...', 'Эээ... Оно в буфере. Наверное.'],
    check: ['Эммм... Готово... {p} подошли... и {f}... не подошли... Да.', 'Ааа... Я посчитал! {p} и {f}! Ну, примерно...'],
    load: ['Ммм... Загрузил {n}... Постов, да...', 'Эээ... {n} постов... Это много?'],
    idle: ['Эммм... Ты ушёл? Ааа... Я тоже задумался...', 'Ммм... Тишина... Я почти уснул...'],
    eggs: ['Эээ... Зачем ты меня тыкаешь?.. Ааа, щекотно...', 'Ммм... Я забыл, что хотел сказать... Ты отвлёк...', 'Ааа! Я испугался... Эммм... Привет?']
  }
};

// Болтливость: как часто гид говорит сам и с какой вероятностью реагирует
const GUIDE_TALK = {
  quiet:  { label: 'Молчун', dialogEvery: 0, react: 0.0, cooldown: 0, idle: false },
  normal: { label: 'Обычный', dialogEvery: 160000, react: 0.35, cooldown: 25000, idle: true },
  chatty: { label: 'Болтун', dialogEvery: 70000, react: 0.75, cooldown: 9000, idle: true }
};

let guideLastReactAt = 0;
let guideDialogTimer = null;
let guideIdleTimer = null;
let guideBubbleTimer = null;

function guideKeyLower() {
  return String(getNormalizedGuideKey(state.currentGuide) || 'hero').toLowerCase();
}

function guideTalkLevel() {
  const v = state.config.guide_talk;
  if (v && GUIDE_TALK[v]) return v;
  return state.config.auto_jokes === false ? 'quiet' : 'normal';
}

function fillPhrase(t, vars) {
  return String(t).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}

function pickGuidePhrase(cat, vars) {
  const pack = GUIDE_PHRASES[guideKeyLower()] || GUIDE_PHRASES.hero;
  const list = pack[cat] || GUIDE_PHRASES.hero[cat] || [];
  if (!list.length) return '';
  return fillPhrase(list[Math.floor(Math.random() * list.length)], vars);
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'day';
  if (h >= 18 && h < 24) return 'evening';
  return 'night';
}

// Г6 · реакция гида на действие (с учётом болтливости и паузы между репликами)
function guideReact(cat, vars, emotion, force) {
  const lvl = GUIDE_TALK[guideTalkLevel()];
  const now = Date.now();
  if (!force) {
    if (!lvl.react || Math.random() > lvl.react) return;
    if (now - guideLastReactAt < lvl.cooldown) return;
  }
  const text = pickGuidePhrase(cat, vars);
  if (!text) return;
  guideLastReactAt = now;
  const emo = emotion || ({ approve: 'wink', reject: 'shrug', bulk: 'talk', copy: 'wink', idle: 'shrug' }[cat] || 'talk');
  triggerMascotReaction(emo, null);
  showMascotBubble(text, { replies: 'ack' });
  guidePop();
}

// Г7 · приветствие по времени суток (один раз за запуск)
function guideGreetByTime() {
  if (guideTalkLevel() === 'quiet') return;
  const text = pickGuidePhrase(timeOfDay());
  if (!text) return;
  triggerMascotReaction('talk', null);
  showMascotBubble(text, { replies: 'ack' });
}

// Г11 · свои реплики гида по таймеру (с учётом скрытых и своих фраз)
function guideDialogPool() {
  const key = getNormalizedGuideKey(state.currentGuide);
  const prof = state.guides[key] || {};
  const muted = new Set(state.config.muted_phrases || []);
  const custom = ((state.config.custom_phrases || {})[String(key).toLowerCase()] || []);
  return [...(prof.dialogs || []), ...custom].filter(t => t && !muted.has(t));
}

function restartGuideDialogLoop() {
  if (guideDialogTimer) clearInterval(guideDialogTimer);
  guideDialogTimer = null;
  const lvl = GUIDE_TALK[guideTalkLevel()];
  if (!lvl.dialogEvery) return;
  guideDialogTimer = setInterval(() => {
    if (document.getElementById('tutorialCard').style.display === 'flex') return;
    const pool = guideDialogPool();
    if (!pool.length) return;
    const t = pool[Math.floor(Math.random() * pool.length)];
    showMascotBubble(t, { replies: 'dialog', phrase: t });
  }, lvl.dialogEvery);
}

// Г6 · «скучает», если долго ничего не делаешь
function bumpGuideIdle() {
  if (guideIdleTimer) clearTimeout(guideIdleTimer);
  if (!GUIDE_TALK[guideTalkLevel()].idle) return;
  guideIdleTimer = setTimeout(() => {
    if (document.hidden) return bumpGuideIdle();
    guideReact('idle', null, 'shrug', true);
  }, 6 * 60 * 1000);
}
['mousedown', 'keydown', 'wheel'].forEach(ev => window.addEventListener(ev, () => bumpGuideIdle(), { passive: true }));

// Г10 · пузырь с кнопками-ответами
function showMascotBubble(text, opts = {}) {
  const b = document.getElementById('mascotBubble');
  if (!b) return;
  document.getElementById('bubbleText').textContent = text;
  const box = document.getElementById('bubbleReplies');
  if (box) {
    let html = '';
    if (opts.replies === 'dialog' && opts.phrase) {
      html = `<button class="bubble-reply" data-act="ok">👍 Понял</button>
              <button class="bubble-reply" data-act="later">Потом</button>
              <button class="bubble-reply bubble-reply-mute" data-act="mute">Не говори так больше</button>`;
    } else if (opts.replies === 'show' && opts.tab) {
      html = `<button class="bubble-reply bubble-reply-main" data-act="show">👉 Покажи</button>
              <button class="bubble-reply" data-act="later">Потом</button>`;
    } else if (opts.replies === 'ack') {
      html = `<button class="bubble-ack" data-act="ok" title="Понял" aria-label="Понял">
        <svg viewBox="0 0 16 16"><polyline points="3.5 8.5 6.5 11.5 12.5 4.5"></polyline></svg></button>`;
    }
    box.innerHTML = html;
    box.style.display = html ? 'flex' : 'none';
    const isAck = opts.replies === 'ack';
    box.classList.toggle('is-ack', isAck);
    b.classList.toggle('has-ack', isAck);
    box.querySelectorAll('.bubble-reply, .bubble-ack').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'mute' && opts.phrase) {
          const m = new Set(state.config.muted_phrases || []);
          m.add(opts.phrase);
          state.config.muted_phrases = [...m];
          saveGeneralSetting('muted_phrases', state.config.muted_phrases);
          showToast('Гид больше не будет так говорить. Вернуть можно в «Помощник и гиды».', 'info', 3200);
        } else if (act === 'show' && opts.tab) {
          selectTab(opts.tab);
          if (opts.section) showSettingsSection(opts.section);
        }
        closeMascotBubble();
      };
    });
  }
  b.style.display = 'block';
  b.classList.remove('bubble-in'); void b.offsetWidth; b.classList.add('bubble-in');
  if (guideBubbleTimer) clearTimeout(guideBubbleTimer);
  const ms = Math.max(7000, Math.min(16000, String(text).length * 75));
  const arm = () => { guideBubbleTimer = setTimeout(() => { b.style.display = 'none'; }, ms); };
  b.onmouseenter = () => { if (guideBubbleTimer) clearTimeout(guideBubbleTimer); };
  b.onmouseleave = arm;
  arm();
}

// Г9 · живой гид: дыхание, «моргание» и взгляд в сторону курсора
let guideLookRaf = 0;
window.addEventListener('mousemove', (e) => {
  if (guideLookRaf) return;
  guideLookRaf = requestAnimationFrame(() => {
    guideLookRaf = 0;
    const card = document.getElementById('mascotCard');
    if (!card) return;
    const r = card.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 600));
    const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 600));
    card.style.setProperty('--look-x', (dx * 3).toFixed(2) + 'px');
    card.style.setProperty('--look-y', (dy * 2).toFixed(2) + 'px');
    card.style.setProperty('--look-r', (dx * 4).toFixed(2) + 'deg');
  });
}, { passive: true });

function guideBlinkLoop() {
  const img = document.getElementById('mascotImg');
  if (img && !document.hidden) {
    img.classList.remove('blink'); void img.offsetWidth; img.classList.add('blink');
  }
  setTimeout(guideBlinkLoop, 3500 + Math.random() * 4000);
}

function guidePop() {
  const card = document.getElementById('mascotCard');
  if (!card) return;
  card.classList.remove('guide-pop'); void card.offsetWidth; card.classList.add('guide-pop');
}

// Г16 · пасхалка: 5 быстрых кликов по гиду
let guideClicks = [];
function guideEggClick() {
  const now = Date.now();
  guideClicks = guideClicks.filter(t => now - t < 1600);
  guideClicks.push(now);
  if (guideClicks.length >= 5) {
    guideClicks = [];
    closeMascotMenu();
    const card = document.getElementById('mascotCard');
    card.classList.remove('guide-egg'); void card.offsetWidth; card.classList.add('guide-egg');
    triggerMascotReaction('wink', null);
    showMascotBubble(pickGuidePhrase('eggs'), { replies: 'ack' });
    playUiSound('done');
    return true;
  }
  return false;
}

// Г13 · гид дня: при каждом запуске - случайный другой гид
async function maybeRandomGuide() {
  if (!state.config.guide_random) return;
  const keys = Object.keys(state.guides || {});
  if (keys.length < 2) return;
  const cur = getNormalizedGuideKey(state.currentGuide);
  const pool = keys.filter(k => k !== cur);
  const next = pool[Math.floor(Math.random() * pool.length)];
  updateGuideDisplay(next);
  try { await window.pywebview.api.set_guide(next); } catch (e) {}
}

// Настройки гидов (Г11, Г12, Г13)
async function setGuideTalk(level) {
  if (!GUIDE_TALK[level]) return;
  state.config.guide_talk = level;
  state.config.auto_jokes = level !== 'quiet';
  document.querySelectorAll('.seg-btn[data-talk]').forEach(b => b.classList.toggle('active', b.dataset.talk === level));
  restartGuideDialogLoop();
  bumpGuideIdle();
  try {
    await saveGeneralSetting('guide_talk', level);
    await saveGeneralSetting('auto_jokes', level !== 'quiet');
  } catch (e) {}
}

async function setGuideRandom(on) {
  state.config.guide_random = !!on;
  try { await saveGeneralSetting('guide_random', !!on); } catch (e) {}
}

async function saveCustomPhrases() {
  const ta = document.getElementById('customPhrasesInput');
  if (!ta) return;
  const key = String(getNormalizedGuideKey(state.currentGuide)).toLowerCase();
  const lines = ta.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 50);
  const all = Object.assign({}, state.config.custom_phrases || {});
  all[key] = lines;
  state.config.custom_phrases = all;
  try { await saveGeneralSetting('custom_phrases', all); } catch (e) {}
  showToast(`Сохранено своих фраз: ${lines.length}`, 'success', 2400);
}

function testCustomPhrase() {
  const ta = document.getElementById('customPhrasesInput');
  const lines = ta ? ta.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const t = lines.length ? lines[Math.floor(Math.random() * lines.length)] : pickGuidePhrase(timeOfDay());
  triggerMascotReaction('talk', null);
  showMascotBubble(t, { replies: 'ack' });
}

async function unmutePhrase(i) {
  const list = (state.config.muted_phrases || []).slice();
  list.splice(i, 1);
  state.config.muted_phrases = list;
  try { await saveGeneralSetting('muted_phrases', list); } catch (e) {}
  showSettingsSection('guides');
}

function renderGuideExtrasSettings() {
  const talk = guideTalkLevel();
  const key = String(getNormalizedGuideKey(state.currentGuide)).toLowerCase();
  const custom = ((state.config.custom_phrases || {})[key] || []).join('\n');
  const muted = state.config.muted_phrases || [];
  const g = getCurrentGuide();
  return `
    <div class="guide-extras">
      <div class="guide-extra-block">
        <div class="guide-extra-title">💬 Болтливость гида</div>
        <div class="guide-extra-desc">Как часто гид говорит сам и реагирует на твои действия.</div>
        <div class="seg-group" style="margin-top: 8px;">
          ${Object.entries(GUIDE_TALK).map(([k, v]) => `<button class="seg-btn ${talk === k ? 'active' : ''}" data-talk="${k}" onclick="setGuideTalk('${k}')">${v.label}</button>`).join('')}
        </div>
      </div>

      <label class="switch-row" style="margin-top: 12px;">
        <span class="switch-toggle">
          <input type="checkbox" ${state.config.guide_random ? 'checked' : ''} onchange="setGuideRandom(this.checked)">
          <span class="switch-slider"></span>
        </span>
        <div>
          <div style="font-weight: 600; color: #f1f5f9;">🎲 Гид дня</div>
          <div style="font-size: 11px; color: #94a3b8;">При каждом запуске программы - случайный другой гид.</div>
        </div>
      </label>

      <div class="guide-extra-block" style="margin-top: 12px;">
        <div class="guide-extra-title">✍️ Свои фразы для ${escapeHtml(g.name)}</div>
        <div class="guide-extra-desc">Одна фраза на строку. Гид будет иногда говорить их вместе со своими.</div>
        <textarea class="input-text guide-phrases-input" id="customPhrasesInput" placeholder="Например: Не забудь отписать в Discord после обзвона!">${escapeHtml(custom)}</textarea>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn btn-primary" onclick="saveCustomPhrases()">💾 Сохранить фразы</button>
          <button class="btn btn-secondary" onclick="testCustomPhrase()">▶ Проверить</button>
        </div>
      </div>

      <div class="guide-extra-block" style="margin-top: 12px;">
        <div class="guide-extra-title">🔇 Скрытые фразы (${muted.length})</div>
        <div class="guide-extra-desc">Фразы, на которые ты нажал «Не говори так больше».</div>
        ${muted.length ? `<div class="muted-list">${muted.map((t, i) => `
          <div class="muted-item"><span>${escapeHtml(t)}</span><button class="bulk-btn bulk-ghost" onclick="unmutePhrase(${i})">Вернуть</button></div>`).join('')}</div>`
        : '<div class="guide-extra-desc" style="margin-top: 6px;">Пока пусто.</div>'}
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(guideBlinkLoop, 2500);
});

// v3.2.2 · Доступ вернули (ПК убрали из блокировки) - ключ не стирался, просто перезагружаем интерфейс
window.onHwidRestored = function() {
  closeModal('modalRevoked');
  showToast('Доступ к Forum Checker восстановлен', 'success', 3000);
  setTimeout(() => location.reload(), 1200);
};
