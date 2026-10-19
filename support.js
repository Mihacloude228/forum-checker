// Поддержка на сайте: hero отвечает на частые вопросы, как чат поддержки.
// Ответы заготовлены здесь же (KB). Чего нет в базе - hero отправляет в Discord.
(() => {
  const DISCORD = '_pinqx';
  const IMG = (m) => `support/hero_${m}.webp`;

  /* ═════════ База ответов ═════════
     keys - корни слов, по которым ищется вопрос из поля ввода */
  const KB = [
    { id: 'start', name: 'Начать пользоваться', hint: 'скачать, запустить, требования', items: [
      { q: 'Как скачать и запустить программу?', keys: ['скача', 'загруз', 'запуст', 'установ', 'exe', 'начат'],
        a: `<p>Нажмите <b>«Скачать»</b> вверху страницы. Загрузится один файл <span class="mono">ForumChecker_vX.X.X.exe</span>.</p><p>Устанавливать ничего не нужно: просто запустите его. При первом запуске откроется окно активации.</p>` },
      { q: 'Что нужно для работы?', keys: ['требован', 'систем', 'windows', 'винд', 'webview', 'нужно для', 'mac', 'линукс', 'телефон'],
        a: `<p><b>Windows 10 или 11</b> и аккаунт на форуме Majestic RP. Для проверки онлайна нужен ещё доступ к админ-панели.</p><p>Программе нужен компонент Microsoft WebView2. В Windows 11 он уже есть, в Windows 10 ставится вместе с браузером Edge. На Mac и телефонах программа не работает.</p>` },
      { q: 'Программа платная?', keys: ['платн', 'цена', 'стоит', 'бесплат', 'купить', 'деньг'],
        a: `<p>Доступ выдаётся по персональному ключу. По условиям получения ключа напишите в Discord <span class="mono">${DISCORD}</span>.</p><p>Обновления для тех, у кого уже есть ключ, бесплатные.</p>`, discord: true },
    ]},
    { id: 'key', name: 'Ключ и активация', hint: 'код ПК, ключ, новый компьютер', items: [
      { q: 'Как получить ключ?', keys: ['ключ', 'активац', 'доступ', 'получит'],
        a: `<ol><li>Запустите программу, откроется окно активации.</li><li>Скопируйте <b>код ПК</b> вида <span class="mono">FC-PC-XXXX-XXXX-XXXX</span>. Там есть кнопка «Скопировать код и открыть Discord».</li><li>Отправьте код в Discord <span class="mono">${DISCORD}</span>, в ответ придёт ключ.</li><li>Вставьте ключ в окно активации.</li></ol>`, discord: true },
      { q: 'Где найти код ПК?', keys: ['код пк', 'hwid', 'код компьют', 'где код'],
        a: `<p>Код показывается в окне активации, оно открывается при первом запуске. Код выглядит так: <span class="mono">FC-PC-XXXX-XXXX-XXXX</span>.</p><p>Рядом есть кнопка, которая сразу копирует код и открывает Discord.</p>` },
      { q: 'Сменил компьютер или переустановил Windows', keys: ['смен', 'поменя', 'новый комп', 'переустан', 'другой комп', 'другом пк', 'новый пк', 'не подходит', 'не принимает', 'слетел', 'сброс'],
        a: `<p>Ключ привязан к компьютеру, поэтому после смены ПК или переустановки Windows код меняется.</p><p>Запустите программу, скопируйте <b>новый</b> код ПК и напишите в Discord, ключ перевыпустят.</p>`, discord: true },
      { q: 'Можно один ключ на два компьютера?', keys: ['два комп', 'два пк', 'несколько', 'друг', 'передать', 'поделит'],
        a: `<p>Нет, ключ работает только на том компьютере, для которого выдан. Для второго ПК нужен отдельный ключ: пришлите его код ПК в Discord.</p>`, discord: true },
    ]},
    { id: 'errors', name: 'Не запускается', hint: 'Windows ругается, ошибки, вирус', items: [
      { q: 'Windows пишет «Система Windows защитила ваш компьютер»', keys: ['защитил', 'smartscreen', 'синее окно', 'windows защ', 'не дает запуст', 'блокир'],
        a: `<p>Так Windows реагирует на любые программы без платной цифровой подписи, это не значит, что файл опасен.</p><p>Нажмите <b>«Подробнее» → «Выполнить в любом случае»</b>.</p><p>Главное: скачивайте программу только с этого сайта.</p>` },
      { q: 'Антивирус ругается на файл', keys: ['антивир', 'вирус', 'троян', 'defender', 'касперск', 'удалил файл', 'карантин'],
        a: `<p>Программа собрана в один exe-файл, и такие файлы антивирусы иногда помечают «на всякий случай». Это ложное срабатывание.</p><p>Добавьте файл в исключения антивируса и скачайте его заново с этой страницы. Если сомневаетесь, напишите в Discord.</p>`, discord: true },
      { q: 'Программа не открывается или белое окно', keys: ['не открыва', 'не запуска', 'белое окно', 'пустое окно', 'черное окно', 'вылета', 'краш', 'ошибк', 'не работает'],
        a: `<ol><li>Перезапустите программу.</li><li>Проверьте, что установлен <b>Microsoft Edge</b>: от него нужен компонент WebView2.</li><li>Скачайте последнюю версию с этого сайта.</li></ol><p>Не помогло? Сделайте скриншот ошибки и пришлите в Discord.</p>`, discord: true },
    ]},
    { id: 'work', name: 'Работа с заявками', hint: 'тема, шаблон, фильтры, ЧС', items: [
      { q: 'Как проверить тему с заявками?', keys: ['провер', 'тем', 'ссылк', 'как польз', 'заявк'],
        a: `<ol><li><b>Авторизация</b>: войдите на форум во встроенном окне.</li><li><b>Загрузка</b>: вставьте ссылку на тему и нажмите «Загрузить ВСЕ».</li><li><b>Шаблон и Фильтры</b>: проверьте поля и правила.</li><li>Нажмите <b>«Проверить все заявки»</b>, результат появится во вкладках «Подошли» и «Не подошли».</li></ol><p>В программе есть обучение с гидом, он покажет каждую кнопку.</p>` },
      { q: 'Как настроить проверку под свою фракцию?', keys: ['фракц', 'настро', 'фильтр', 'правил', 'шаблон', 'пресет', 'услов'],
        a: `<p>Поля и условия задаются под ваш шаблон заявки:</p><ul><li>во вкладке <b>Шаблон</b> поля можно вытащить из первого поста темы автоматически;</li><li>во вкладке <b>Фильтры</b> для каждого поля выбирается условие: «Не пустое», «Только цифры» и другие;</li><li>готовые наборы правил сохраняются как пресеты (Настройки → Шаблоны фильтров).</li></ul>` },
      { q: 'Как работает ЧС лидеров?', keys: ['чс', 'черн', 'blacklist', 'блэк'],
        a: `<p>В программе своя база чёрного списка (Настройки → ЧС лидеров). Если статик или Discord кандидата совпадает с записью из ЧС, заявка сама уходит в «Не подошли» с пометкой <b>ЧС лидеров</b>.</p>` },
      { q: 'Ошибся и отклонил не того', keys: ['ошибся', 'отмен', 'вернуть', 'случайно', 'не того'],
        a: `<p>Нажмите <b>«Отменить»</b> в уведомлении, которое появляется после действия. Можно и вручную: во вкладке «Не подошли» у кандидата есть кнопка «Одобрить».</p>` },
      { q: 'Как выгрузить список в Discord?', keys: ['discord', 'дискорд', 'выгруз', 'экспорт', 'пинг', 'таблиц', 'скопир'],
        a: `<p>Готовые форматы копируются одной кнопкой: <b>пинги одобренных</b>, <b>таблица кандидатов</b>, <b>отказы с причинами</b> и <b>статистика онлайна</b>.</p><p>Как именно выглядит текст, настраивается в Настройки → Быстрый экспорт.</p>` },
      { q: 'Горячие клавиши', keys: ['клавиш', 'горяч', 'hotkey', 'alt', 'ctrl', 'быстро'],
        a: `<ul><li><kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>8</kbd>: переход по разделам</li><li><kbd>Ctrl</kbd>+<kbd>K</kbd>: поиск раздела</li><li><kbd>Ctrl</kbd>+<kbd>A</kbd>: выбрать все видимые заявки</li><li><kbd>Esc</kbd>: снять выбор</li></ul>` },
    ]},
    { id: 'online', name: 'Проверка онлайна', hint: 'админ-панель, сессии', items: [
      { q: 'Как считается онлайн кандидатов?', keys: ['онлайн', 'актив', 'сесси', 'время в игре', 'час'],
        a: `<p>Программа берёт данные из админ-панели (Логи → Сессии) за последние <b>2 месяца</b>, время московское. Для каждого одобренного кандидата она считает онлайн за день, неделю, месяц и 2 месяца и показывает, кто играет прямо сейчас.</p>` },
      { q: 'Нет доступа к админ-панели', keys: ['нет доступа', 'админк', 'панел', 'админ-панел'],
        a: `<p>Без доступа к админ-панели проверка онлайна не работает. Всё остальное работает: загрузка темы, проверка по шаблону, ЧС и экспорт.</p>` },
      { q: 'Почему онлайн проверяется медленно?', keys: ['медлен', 'долго', 'кулдаун', 'задержк', 'пауза'],
        a: `<p>Между кандидатами программа делает паузу (<b>кулдаун</b>, 20–30 секунд), чтобы не перегружать админ-панель. Интервал меняется в Настройки → Проверка онлайна.</p>` },
    ]},
    { id: 'safe', name: 'Безопасность и обновления', hint: 'пароли, новые версии', items: [
      { q: 'Это безопасно? Куда уходят мои пароли?', keys: ['безопас', 'парол', 'кук', 'взлом', 'украд', 'данны', 'слив'],
        a: `<p><b>Никуда.</b> Вход на форум и в админ-панель выполняется во встроенном окне браузера на вашем компьютере, сессия хранится только у вас.</p><p>Программа не отправляет пароли, куки и списки кандидатов на сторонние серверы.</p>` },
      { q: 'Как обновиться до новой версии?', keys: ['обнов', 'верси', 'новая', 'апдейт', 'update'],
        a: `<p>Программа сама сообщит о новой версии и откроет страницу загрузки. Скачайте новый файл и запустите его.</p><p>Ключ вводить заново не нужно, настройки сохраняются.</p>` },
      { q: 'Что нового в последней версии?', keys: ['что нового', 'изменени', 'changelog', 'последн'],
        a: `<p>Список изменений есть внизу страницы, в блоке <b>«Что нового»</b>. Все версии лежат на GitHub.</p>`, action: { label: 'Показать «Что нового»', href: '#news' } },
    ]},
  ];
  // Просто для настроения: факты без выдуманных цифр
  const FACTS = [
    'Заявки сами себя не проверят... хотя стоп, Forum Checker как раз сам их и проверяет.',
    'Самая частая причина отказа - не тот формат Discord или опечатка в статике. Фильтр «Только цифры» ловит такие заявки сразу.',
    'Пропущенный обязательный пункт в шаблоне видно мгновенно: проверка по шаблону занимает меньше секунды.',
    'Тёмная тема бережёт глаза, когда читаешь форум в два часа ночи.',
    'Большую тему лучше проверять с чашкой кофе: пока программа проходит страницы, как раз успеешь.',
    'Alt+5 сразу открывает «Подошли». Мелочь, а экономит кучу кликов.',
  ];

  /* ═════════ Поиск по вопросу ═════════ */
  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const ALL = KB.flatMap(c => c.items.map(it => ({ ...it, cat: c })));
  const search = (text) => {
    const t = ' ' + norm(text) + ' ';
    const words = t.trim().split(' ').filter(w => w.length > 2);
    return ALL.map(it => {
      let s = 0;
      it.keys.forEach(k => { if (t.includes(norm(k))) s += k.includes(' ') ? 3 : 2; });
      const qn = norm(it.q);
      words.forEach(w => { if (qn.includes(w.slice(0, Math.max(4, w.length - 2)))) s += 1; });
      return { it, s };
    }).filter(x => x.s >= 2).sort((a, b) => b.s - a.s);
  };

  /* ═════════ Интерфейс ═════════ */
  const sfx = (k) => { try { if (window.FC_SFX && localStorage.getItem('fc-site-sfx') === '1') FC_SFX.play('haptic', k); } catch (e) {} };
  const root = document.createElement('div');
  root.className = 'hs';
  root.innerHTML = `
    <button class="hs-launch" type="button" aria-label="Поддержка: задать вопрос" title="Поддержка">
      <img src="${IMG('idle')}" alt=""><span class="hs-dot"></span>
    </button>
    <div class="hs-tease" role="status"><span class="hs-tease-t"></span><button class="hs-tease-x" type="button" aria-label="Скрыть">×</button></div>
    <div class="hs-panel" role="dialog" aria-label="Поддержка Forum Checker" aria-hidden="true">
      <div class="hs-head">
        <div class="hs-ava"><img src="${IMG('idle')}" alt="" id="hsAva"></div>
        <div><div class="hs-title">hero · поддержка</div><div class="hs-sub">Отвечает сразу</div></div>
        <button class="hs-close" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="hs-body" id="hsBody" aria-live="polite"></div>
      <div class="hs-foot">
        <form class="hs-form" id="hsForm" autocomplete="off">
          <input class="hs-input" id="hsInput" placeholder="Напишите вопрос, например: где взять ключ" maxlength="200">
          <button class="hs-send" type="submit" aria-label="Отправить" disabled><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </form>
        <div class="hs-note">Ответы заготовлены заранее. Не нашли нужное - поможем в Discord.</div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const body = $('#hsBody'), ava = $('#hsAva'), input = $('#hsInput'), send = $('.hs-send');
  let started = false, lastBot = false, busy = false;

  const setMood = (m) => { ava.src = IMG(m); };
  const scroll = () => requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  const el = (html, cls) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; };

  const me = (text) => {
    const r = el('', 'hs-row me'); const m = el('', 'hs-msg'); m.textContent = text; r.appendChild(m);
    body.appendChild(r); lastBot = false; scroll();
  };
  const bot = (html, mood = 'talk', delay = 450) => new Promise(res => {
    busy = true;
    const typing = el(`<img class="hs-mini" src="${IMG('idle')}" alt=""><div class="hs-msg hs-typing"><i></i><i></i><i></i></div>`, 'hs-row' + (lastBot ? ' cont' : ''));
    body.appendChild(typing); scroll();
    setTimeout(() => {
      typing.remove();
      const r = el(`<img class="hs-mini" src="${IMG(mood)}" alt=""><div class="hs-msg">${html}</div>`, 'hs-row' + (lastBot ? ' cont' : ''));
      body.appendChild(r); lastBot = true; setMood(mood); scroll(); busy = false; res(r);
    }, delay);
  });
  const chips = (list) => {
    const box = el('', 'hs-chips');
    list.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-chip' + (c.ghost ? ' ghost' : ''); b.textContent = c.label;
      b.onclick = () => { if (busy) return; box.classList.add('used'); b.classList.add('picked'); sfx('tab'); c.run(); };
      box.appendChild(b);
    });
    body.appendChild(box); lastBot = false; scroll();
  };
  const discordBtn = (msgRow) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-ds';
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.5 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.7.2 18.2a19.8 19.8 0 0 0 6 3l1.3-2a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12 0l.5.4-2 1 1.3 2a19.7 19.7 0 0 0 6-3c.5-5.2-.9-9.8-3.5-13.8zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.6 8 10.6s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>Скопировать ник ${DISCORD}`;
    b.onclick = async () => {
      sfx('copy');
      try { await navigator.clipboard.writeText(DISCORD); b.lastChild.textContent = 'Ник скопирован'; } catch (e) { b.lastChild.textContent = 'Ник: ' + DISCORD; }
    };
    msgRow.querySelector('.hs-msg').appendChild(b);
  };

  const greet = async () => {
    const h = new Date().getHours();
    const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    await bot(`<p>${hi}! Я hero, помогу разобраться с Forum Checker.</p><p>Выберите тему или просто напишите вопрос внизу.</p>`, 'wink', 350);
    showCats();
  };
  const showCats = () => {
    const box = el('', 'hs-cats');
    KB.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-cat';
      b.innerHTML = `<b>${c.name}</b><span>${c.hint}</span>`;
      b.onclick = () => { if (busy) return; box.classList.add('used'); b.classList.add('picked'); sfx('tab'); openCat(c); };
      box.appendChild(b);
    });
    body.appendChild(box); lastBot = false;
    chips([{ label: 'Расскажи что-нибудь', ghost: true, run: fact }]);
  };
  const openCat = async (c) => {
    me(c.name);
    await bot(`<p>Что именно интересует?</p>`, 'talk', 380);
    chips([...c.items.map(it => ({ label: it.q, run: () => answer(it, true) })), { label: '← Все темы', ghost: true, run: back }]);
  };
  const answer = async (it, echo) => {
    if (echo) me(it.q);
    const r = await bot(it.a, 'talk', 650);
    if (it.discord) discordBtn(r);
    if (it.action) {
      const a = document.createElement('a'); a.className = 'hs-chip'; a.href = it.action.href; a.textContent = it.action.label;
      a.style.display = 'inline-block'; a.style.marginTop = '8px'; a.style.textDecoration = 'none';
      a.onclick = () => close();
      r.querySelector('.hs-msg').appendChild(a);
    }
    chips([
      { label: 'Помогло', run: helped },
      { label: 'Не помогло', ghost: true, run: notHelped },
      { label: '← Все темы', ghost: true, run: back },
    ]);
  };
  const helped = async () => { me('Помогло'); await bot('<p>Отлично! Если появятся ещё вопросы - я тут, в углу.</p>', 'wink', 350); chips([{ label: 'Ещё вопрос', ghost: true, run: back }]); };
  const notHelped = async () => {
    me('Не помогло');
    const r = await bot(`<p>Жаль. Напишите в Discord <span class="mono">${DISCORD}</span>: опишите проблему и, если есть, приложите скриншот. Там ответит живой человек.</p>`, 'shrug', 500);
    discordBtn(r);
    chips([{ label: '← Все темы', ghost: true, run: back }]);
  };
  const back = async () => { await bot('<p>Выберите тему:</p>', 'idle', 300); showCats(); };
  let factI = Math.floor(Math.random() * FACTS.length);
  const fact = async () => {
    me('Расскажи что-нибудь');
    factI = (factI + 1) % FACTS.length;
    await bot(`<p>${FACTS[factI]}</p>`, 'wink', 550);
    chips([{ label: 'Ещё', ghost: true, run: fact }, { label: '← Все темы', ghost: true, run: back }]);
  };
  const ask = async (text) => {
    me(text);
    const found = search(text);
    if (!found.length) {
      const r = await bot(`<p>Хм, такого вопроса у меня в заготовках нет. Попробуйте сформулировать иначе или выберите тему.</p><p>Или сразу напишите в Discord <span class="mono">${DISCORD}</span>.</p>`, 'shrug', 600);
      discordBtn(r);
      chips([{ label: '← Все темы', ghost: true, run: back }]);
      return;
    }
    const best = found[0];
    if (found.length > 1 && found[1].s >= best.s - 1 && best.it !== found[1].it) {
      await bot('<p>Нашёл несколько похожих ответов. Что из этого?</p>', 'talk', 500);
      chips([...found.slice(0, 3).map(f => ({ label: f.it.q, run: () => answer(f.it, true) })), { label: '← Все темы', ghost: true, run: back }]);
    } else answer(best.it, false);
  };

  const open = () => {
    document.documentElement.classList.add('hs-open');
    $('.hs-panel').setAttribute('aria-hidden', 'false');
    hideTease(true);
    sfx('press');
    if (!started) { started = true; greet(); }
    setTimeout(() => { if (matchMedia('(hover: hover)').matches) input.focus(); }, 250);
  };
  const close = () => {
    document.documentElement.classList.remove('hs-open');
    $('.hs-panel').setAttribute('aria-hidden', 'true');
    $('.hs-launch').focus({ preventScroll: true });
  };
  $('.hs-launch').addEventListener('click', open);
  $('.hs-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.documentElement.classList.contains('hs-open')) close(); });
  input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
  $('#hsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v || busy) return;
    input.value = ''; send.disabled = true; sfx('press');
    ask(v);
  });

  // Облачко-подсказка: один раз за визит, через несколько секунд
  const tease = $('.hs-tease');
  const TEASES = ['Есть вопрос по программе? Спросите меня!', 'Не знаете, как получить ключ? Подскажу.', FACTS[0]];
  const hideTease = (forever) => { tease.classList.remove('show'); if (forever) try { sessionStorage.setItem('fc-hs-tease', '1'); } catch (e) {} };
  let seen = false;
  try { seen = sessionStorage.getItem('fc-hs-tease') === '1'; } catch (e) {}
  if (!seen) setTimeout(() => {
    if (document.documentElement.classList.contains('hs-open')) return;
    $('.hs-tease-t').textContent = TEASES[Math.floor(Math.random() * TEASES.length)];
    tease.classList.add('show');
    setTimeout(() => hideTease(false), 9000);
  }, 6000);
  tease.addEventListener('click', (e) => { if (e.target.closest('.hs-tease-x')) hideTease(true); else open(); });
})();
