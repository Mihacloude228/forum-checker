// Живая демка Forum Checker для сайта.
// Подменяет Python-часть программы: всё работает на заранее подготовленных
// выдуманных данных (demo-data.js), никуда не ходит и ничего не отправляет.
(() => {
  const D = window.__DEMO_DATA__;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const toast = (t, type) => { try { showToast(t, type || 'info'); } catch (e) {} };

  const demoWindow = (cmd) => {
    if (window.parent !== window) { window.parent.postMessage({ fcDemo: cmd }, '*'); return; }
    if (cmd === 'close') { location.href = '../index.html#try'; return; }
    try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {}
  };

  const M = {
    auth: { forum: false, panel: false },
    loaded: false,
    passed: [], failed: [],
    rules: clone(D.rules), blacklist: clone(D.blacklist), template: D.template,
    online: [], onlineTimer: null,
  };

  const ping = (it) => {
    const ds = (it.res.fields || {})['Discord ID'] || '';
    return /^\d{17,21}$/.test(ds) ? `<@${ds}>` : it.post.author;
  };

  const API = {
    async get_initial_data() {
      return {
        config: {
          disclaimer_accepted: true, selected_guide: 'hero', guide_talk: 'normal', auto_jokes: false, guide_of_day: false,
          menu_layout: 'dock', ui_scale: 'auto', tutorial_completed: true, ui_sounds: true, ui_sounds_volume: 60,
          template: D.template, check_dups: true, background_mode: true,
        },
        rules: clone(M.rules), blacklist: clone(M.blacklist), guides: D.guides, auth: { ...M.auth },
        passed_candidates: [], failed_candidates: [], online_candidates: [], presets: {},
        text_color_presets: D.text_color_presets, app_version: D.version.replace(/^v/, ''), build_name: D.version,
        site_url: 'https://mihacloude228.github.io/forum-checker/', discord_contact: '_pinqx',
        license: { hwid: 'FC-PC-DEMO-0000-0000', is_activated: true, is_revoked: false },
      };
    },

    // Вход только для вида: окна браузера с паролем в демо нет
    async login_forum() {
      await wait(700);
      M.auth.forum = true;
      toast('Это демо: вход на форум не нужен, тема уже подготовлена', 'info');
      return { ...M.auth };
    },
    async login_panel() {
      await wait(700);
      M.auth.panel = true;
      toast('Это демо: вход в админ-панель не нужен, онлайн подставится сам', 'info');
      return { ...M.auth };
    },
    async clear_session() { M.auth = { forum: false, panel: false }; return { success: true }; },

    // Загрузка «темы»: ссылка ненастоящая, посты берутся из демо-набора
    async load_forum(url, page) {
      const steps = page ? [`p:${page}`] : ['nav', 'p:1/2', 'p:2/2'];
      for (const s of steps) { window.onLoadProgress && window.onLoadProgress(s); await wait(520); }
      M.loaded = true;
      return { page_count: page ? 1 : D.pages, post_count: D.posts };
    },
    async clear_posts() { M.loaded = false; M.passed = []; M.failed = []; return { success: true }; },

    async check_all() {
      if (!M.loaded) return { error: 'Нет загруженных постов! Сначала загрузите тему форума.' };
      await wait(350);
      M.passed = clone(D.passed); M.failed = clone(D.failed);
      return { passed: clone(M.passed), failed: clone(M.failed) };
    },
    async sync_candidates(passed, failed) { M.passed = passed || []; M.failed = failed || []; return { success: true }; },

    // Онлайн: без панели и без 25-секундных пауз, готовые часы подставляются по очереди
    async start_online_check() {
      const known = new Map(D.online.map(o => [o.author, o]));
      const queue = M.passed.map(it => known.get(it.post.author) || {
        author: it.post.author, post_number: it.post.post_number, static_id: (it.res.fields || {})['Static ID'] || '',
        ok: true, day: '1:12', week: '11:40', month: '44:05', two_months: '83:30', sessions: 24, pages: 1, online_now: false, last_seen: '20.10.2026 19:40',
      });
      if (!queue.length) return { error: 'Не найдены кандидаты со Static ID в списке «Подошли»!' };
      clearInterval(M.onlineTimer);
      M.online = [];
      let i = 0;
      const tick = () => {
        if (i >= queue.length) {
          clearInterval(M.onlineTimer);
          window.onOnlineProgress({ text: `Проверка завершена! Проверено: ${M.online.length} чел.`, progress: 1, results: clone(M.online), done: true });
          return;
        }
        const c = queue[i++];
        M.online.push(clone(c));
        window.onOnlineProgress({ text: `[${i}/${queue.length}] ${c.author}: считаем сессии за 2 месяца (демо)...`, progress: i / queue.length, results: clone(M.online) });
      };
      window.onOnlineProgress({ text: 'Демо: панель не открывается, онлайн берётся из подготовленных данных', progress: 0, results: [] });
      M.onlineTimer = setInterval(tick, 650);
      return { success: true, count: queue.length };
    },
    async cancel_online_check() {
      clearInterval(M.onlineTimer);
      window.onOnlineProgress({ text: 'Проверка отменена пользователем.', progress: 1, results: clone(M.online), done: true });
      return { success: true };
    },
    async clear_online_results() { M.online = []; return { success: true }; },

    // Поля из шаблона: тот же принцип, что в программе
    async auto_fields(text) {
      const rules = [];
      for (const raw of String(text || '').split('\n')) {
        const line = raw.trim();
        if (/^(?:примечание|внимание|p\.?\s*s)/i.test(line)) break;
        const m = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)?(.+?)\s*[:：]\s*(.*)$/);
        if (m && m[1].length >= 2 && m[1].length <= 80) {
          const fl = m[1].toLowerCase();
          rules.push({ name: m[1], keyword: m[1], ftype: /(id|ид|айди|номер)/.test(fl) ? 'digits' : 'not_empty', fval: '' });
        }
      }
      M.rules = rules;
      return { success: true, rules: clone(rules) };
    },
    async save_rules(rules) { M.rules = rules || M.rules; return { success: true }; },
    async save_template(t) { M.template = t; return { success: true }; },
    async save_blacklist(b) { M.blacklist = b || []; return { success: true }; },

    // Экспорт: такой же текст, как в программе, из демо-кандидатов
    async export_discord_pings() {
      if (!M.passed.length) return { success: false, error: 'Список «Подошли» пока пуст! Сначала проведите проверку заявок.' };
      return { success: true, text: `✅ Прошли отбор на пост лидера:\n${M.passed.map(ping).join('\n')}\n\nОжидайте обзвон в Discord.` };
    },
    async export_discord_raw_pings() {
      if (!M.passed.length) return { success: false, error: 'Список «Подошли» пока пуст!' };
      return { success: true, text: M.passed.map(ping).join(' ') };
    },
    async export_passed_summary() {
      if (!M.passed.length) return { success: false, error: 'Список «Подошли» пока пуст!' };
      return { success: true, text: M.passed.map((it, k) => `${k + 1}. ${it.post.author} | Static ${(it.res.fields || {})['Static ID'] || '-'} | ${(it.res.fields || {})['Возраст'] || '-'} лет`).join('\n') };
    },
    async export_failed_summary() {
      if (!M.failed.length) return { success: false, error: 'Список «Не подошли» пока пуст!' };
      return { success: true, text: M.failed.map((it, k) => `${k + 1}. ${it.post.author} - ${(it.res.reasons || []).join('; ')}`).join('\n') };
    },

    // Ссылки на форум выдуманные - никуда не ведём
    async open_browser_url() { toast('Это демо: ссылки ведут на выдуманную тему форума', 'info'); return { success: true }; },
    async open_site() { try { window.top.location.hash = '#top'; } catch (e) {} return { success: true }; },
    async open_discord() { toast('Ник в Discord: _pinqx', 'info'); return { success: true }; },

    async check_for_updates() { return { success: true, update: false }; },
    async check_revocation() { return { is_revoked: false }; },
    async activate_license() { return { success: true }; },
    async deactivate_license() { toast('В демо ключ не нужен', 'info'); return { success: false }; },
    // Кнопки окна: свернуть и закрыть выходят из демки, развернуть - на весь экран
    async win_toggle_maximize() { demoWindow('fullscreen'); return { maximized: false }; },
    async win_start_drag() { return { success: false }; },
    async win_start_resize() { return { success: false }; },
    async win_minimize() { demoWindow('close'); return {}; },
    async win_close() { demoWindow('close'); return {}; },
    async set_ui_zoom() { return { success: false }; },
  };

  window.pywebview = { api: new Proxy(API, { get: (t, k) => (k in t ? t[k] : async () => ({ success: true })) }) };
})();
