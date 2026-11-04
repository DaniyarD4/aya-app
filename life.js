/*
 * Жизнь без трения — функции поверх «Системы», всё офлайн и на телефоне:
 * быстрый вброс одной строкой, авторазбивка квестов на шаги (и запоминание твоих шагов),
 * «просто начни» на 5 минут. Подключается после основного скрипта и board.js.
 */

const life = () => session.state.life;

/* ---------- Шаги: авторазбивка квеста ----------
   Тип задачи угадывается по словам; первый шаг — всегда на 5 минут.
   Если поправишь шаги, Система запомнит их для этого типа и в следующий раз разобьёт по-твоему. */

const STEP_TYPES = [
  { id: 'docs', name: 'документы', kw: /документ|справк|цон|паспорт|виз|внж|загран|налог|нотари|заявлен|госуслуг|egov|акимат|регистрац|прописк|удостовер|подать|получить .*(справк|документ)/i,
    steps: ['Найти, какие документы нужны (5 мин)', 'Собрать их в одну папку', 'Записаться или проверить часы работы', 'Съездить и подать', 'Проверить, что всё выдали'] },
  { id: 'content', name: 'контент', kw: /ролик|видео|reels|рилс|пост|сторис|блог|контент|съёмк|съемк|монтаж|сценар|тикток|tiktok|ютуб|youtube/i,
    steps: ['Записать 3 идеи хука (5 мин)', 'Написать короткий сценарий', 'Подготовить свет и место', 'Снять', 'Смонтировать', 'Опубликовать'] },
  { id: 'dev', name: 'сайт или код', kw: /сайт|лендинг|приложен|код|баг|верстк|фронт|бэкенд|api|деплой|дизайн/i,
    steps: ['Открыть проект и записать, что именно сделать (5 мин)', 'Разбить на 2–3 куска', 'Сделать первый кусок', 'Сделать остальное', 'Проверить и выложить'] },
  { id: 'call', name: 'звонок', kw: /позвонить|созвон|звонок|набрать|позвони/i,
    steps: ['Найти номер и записать, что спросить (5 мин)', 'Позвонить', 'Записать, о чём договорились'] },
  { id: 'write', name: 'сообщение', kw: /написать|ответить|письм|сообщени|email|почт|отправить/i,
    steps: ['Открыть переписку и набросать одну строку (5 мин)', 'Дописать', 'Отправить'] },
  { id: 'buy', name: 'покупка', kw: /купить|заказать|выбрать .*(подар|одежд)|подарок/i,
    steps: ['Записать, что именно нужно (5 мин)', 'Сравнить 2–3 варианта', 'Купить или заказать'] },
  { id: 'meet', name: 'встреча', kw: /встреч|собеседов|переговор|интервью|презентац/i,
    steps: ['Записать цель встречи (5 мин)', 'Подготовить 3 главных пункта', 'Проверить время и дорогу', 'Сходить', 'Записать итоги'] },
  { id: 'clean', name: 'уборка', kw: /убрать|уборк|помыть|разобрать|стирк|навести порядок|выбросить/i,
    steps: ['Убрать одну поверхность (5 мин)', 'Пройтись по комнате', 'Вынести лишнее'] },
  { id: 'study', name: 'учёба', kw: /учить|выучить|курс|урок|прочитать|изучить|книг|лекци/i,
    steps: ['Открыть материал и прочитать первую страницу (5 мин)', 'Пройти первую часть', 'Пройти остальное', 'Записать 3 главные мысли'] },
  { id: 'money', name: 'оплата', kw: /оплатить|заплатить|перевести|счёт|счет|кредит|долг|выставить счёт/i,
    steps: ['Найти реквизиты или сумму (5 мин)', 'Оплатить', 'Сохранить чек'] },
  { id: 'health', name: 'здоровье', kw: /врач|стоматолог|анализ|больниц|клиник|записаться к|обследов/i,
    steps: ['Найти клинику и время (5 мин)', 'Записаться', 'Сходить', 'Записать, что сказали'] },
  { id: 'trip', name: 'поездка', kw: /поездк|съездить|билет|отпуск|путешеств|переезд/i,
    steps: ['Выбрать дату (5 мин)', 'Купить билеты или проверить дорогу', 'Собрать вещи', 'Поехать'] },
];
const STEP_GENERIC = { id: 'generic', name: 'дело', steps: ['Открыть или найти то, с чем работать (5 мин)', 'Сделать самую маленькую часть', 'Сделать основную часть', 'Проверить и закрыть'] };

function stepType(q) {
  const text = `${q.title} ${q.note || ''}`;
  return STEP_TYPES.find((x) => x.kw.test(text)) || STEP_GENERIC;
}

/** Шаги для квеста: сначала твои заготовки для этого типа, иначе встроенные. */
function stepsFor(q) {
  const type = stepType(q);
  const mine = life().learned[type.id];
  return (mine && mine.length ? mine : type.steps).map((t) => ({ id: uid(), t, done: false }));
}

function breakQuest(q, silent) {
  q.steps = stepsFor(q);
  save();
  if (!silent) toast({ title: 'Разбил на шаги', main: `${q.steps.length} ${plural(q.steps.length, ['шаг', 'шага', 'шагов'])} · первый на 5 минут`, sub: q.steps[0].t, action: { label: 'Шаги', run: () => openSteps(q) }, ms: 5000 });
}

/** Тяжёлые квесты Система разбивает сама — когда они становятся «сейчас» или висят 2+ дня. */
function autoBreak(q) {
  if (!q || q.steps || q.noSteps || q.area === 'state' || q.system) return false;
  if (questLoad(q) < 3 && Date.now() - q.createdAt < 2 * 864e5) return false;
  breakQuest(q, true);
  return true;
}

const stepNext = (q) => (q.steps || []).find((s) => !s.done);
const stepCount = (q) => ({ done: (q.steps || []).filter((s) => s.done).length, all: (q.steps || []).length });

/** Шаг сделан. Последний шаг закрывает весь квест — с опытом и ачивками. */
function doStep(q, stepId) {
  const s = q.steps.find((x) => x.id === stepId) || stepNext(q);
  if (!s) return;
  s.done = true;
  s.at = Date.now();
  const next = stepNext(q);
  save();
  if (!next) {
    completeQuest(q);
    pilotAfterQuest(q);
    return render();
  }
  Sound.play('quest');
  haptic(15);
  const c = stepCount(q);
  toast({ title: `Шаг ${c.done} из ${c.all} ✓`, main: `Дальше: ${next.t}`, sub: q.title, kind: 'up', ms: 4500 });
  render();
}

/** Шаги квеста: отметить, поправить, добавить. Правки запоминаются как твоя заготовка. */
function openSteps(q) {
  const type = stepType(q);
  const ebb = session.state.settings.pilot && pilotState() && pilotState().mode === 'ebb';
  const first = q.steps.findIndex((s) => !s.done);
  const row = (s, i) => `<div class="step-row${s.done ? ' done' : ''}${ebb && i > first && !s.done ? ' hide-ebb' : ''}">
      <input type="checkbox" data-sdone="${s.id}"${s.done ? ' checked' : ''} aria-label="Сделано">
      <input type="text" data-stext="${s.id}" maxlength="120" value="${esc(s.t)}">
      <button type="button" data-sdel="${s.id}" aria-label="Удалить шаг">×</button>
    </div>`;
  const root = openSheet('Шаги', `
    <p class="lead">${esc(q.title)}</p>
    <p class="dim center">Тип: ${type.name}. ${ebb ? 'Откат — видно только ближайший шаг.' : 'Поправь шаги — Система запомнит их для таких задач.'}</p>
    <div class="steps" data-steps>${q.steps.map(row).join('')}</div>
    ${ebb && q.steps.length - first > 1 ? '<button class="btn ghost" type="button" data-showall>Показать все шаги</button>' : ''}
    <button class="btn ghost" type="button" data-add>+ Шаг</button>
    <button class="btn" type="button" data-ok>Сохранить</button>
    <button class="btn ghost" type="button" data-rebuild>Разбить заново</button>
    <button class="btn ghost danger-text" type="button" data-nosteps>Без шагов</button>`);
  const box = root.querySelector('[data-steps]');
  const before = q.steps.map((s) => s.t).join('\n');
  const showAll = root.querySelector('[data-showall]');
  if (showAll) showAll.addEventListener('click', () => { box.querySelectorAll('.hide-ebb').forEach((r) => r.classList.remove('hide-ebb')); showAll.remove(); });
  box.addEventListener('click', (e) => {
    const del = e.target.closest('[data-sdel]');
    if (del) del.closest('.step-row').remove();
  });
  root.querySelector('[data-add]').addEventListener('click', () => {
    box.insertAdjacentHTML('beforeend', row({ id: uid(), t: '', done: false }, 0));
    box.lastElementChild.querySelector('[data-stext]').focus();
  });
  root.querySelector('[data-ok]').addEventListener('click', () => {
    const steps = [...box.querySelectorAll('.step-row')].map((r) => {
      const id = r.querySelector('[data-stext]').dataset.stext;
      const old = q.steps.find((s) => s.id === id);
      return { id, t: r.querySelector('[data-stext]').value.trim(), done: r.querySelector('[data-sdone]').checked, at: old && old.at };
    }).filter((s) => s.t);
    const changed = steps.map((s) => s.t).join('\n') !== before;
    q.steps = steps;
    if (changed && steps.length) {
      life().learned[type.id] = steps.map((s) => s.t);
      toast({ title: 'Запомнил', main: `Так буду разбивать: ${type.name}`, ms: 3000 });
    }
    save();
    closeSheet();
    if (steps.length && steps.every((s) => s.done)) {
      completeQuest(q);
      pilotAfterQuest(q);
    }
    render();
  });
  root.querySelector('[data-rebuild]').addEventListener('click', () => {
    delete life().learned[type.id];
    breakQuest(q, true);
    openSteps(q);
  });
  root.querySelector('[data-nosteps]').addEventListener('click', () => {
    delete q.steps;
    q.noSteps = true;
    save();
    closeSheet();
    render();
  });
}

/* ---------- «Просто начни»: 5 минут ---------- */

function startFocus(q, minutes = 5) {
  markStarted(q);
  const step = stepNext(q);
  life().focus = { qid: q.id, step: step ? step.id : null, title: step ? step.t : q.title, startedAt: Date.now(), until: Date.now() + minutes * 60000, asked: false };
  save();
  Sound.play('quest');
  haptic(15);
  render();
}

function focusHtml() {
  const f = life().focus;
  if (!f) return '';
  return `<div class="panel active-item focus-item" data-focus>
      <div><small>Просто начни · ⏱ <span data-ftimer></span></small><b>${esc(f.title)}</b></div>
      <button class="btn" type="button" data-action="focus-done">Готово</button>
      <button class="btn ghost" type="button" data-action="focus-stop" aria-label="Стоп">×</button>
    </div>`;
}

/** Раз в секунду: таймер и вопрос, когда время вышло. */
function tickFocus() {
  if (!session) return;
  tickLeave();
  const f = life().focus;
  const el = app.querySelector('[data-ftimer]');
  if (!f) return;
  const left = f.until - Date.now();
  if (el) el.textContent = left > 0 ? `${Math.floor(left / 60000)}:${pad(Math.floor((left % 60000) / 1000))}` : 'время вышло';
  if (left <= 0 && !f.asked && !sheet && !fxOverlay) {
    f.asked = true;
    save();
    Sound.play('quest');
    haptic([20, 40, 20]);
    const q = findQuest(f.qid);
    const root = openSheet('Время вышло', `
      <p class="lead">${esc(f.title)}</p>
      <p class="dim center">Ты начал — это главное. Дальше как хочется.</p>
      <button class="btn" type="button" data-f="more">Ещё 15 минут</button>
      <button class="btn" type="button" data-f="done">${f.step ? 'Шаг сделан' : 'Сделано'}</button>
      <button class="btn ghost" type="button" data-f="stop">Хватит на сейчас</button>`);
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      closeSheet();
      if (b.dataset.f === 'more' && q) return startFocus(q, 15);
      if (b.dataset.f === 'done') return focusDone();
      life().focus = null;
      save();
      render();
      toast({ title: 'Ок', main: 'Начать — уже победа', sub: 'Продолжишь, когда будет волна', ms: 3500 });
    }));
  }
}

function focusDone() {
  const f = life().focus;
  life().focus = null;
  const q = f && findQuest(f.qid);
  if (!q) return render();
  if (f.step && q.steps) return doStep(q, f.step);
  if (!completionIndex().has(q.id)) {
    completeQuest(q);
    pilotAfterQuest(q);
  }
  render();
}

/* ---------- Быстрый вброс ----------
   Одна строка — Система сама решает, что это: трата, поступление, тревога, идея или квест.
   Если ошиблась — «Изменить», и она запомнит по первому слову. */

const CAPTURE_KINDS = { quest: 'Квест', expense: 'Трата', income: 'Поступление', worry: 'Тревога', idea: 'Идея на доску' };
const WORRY_RE = /тревож|боюсь|страшно|переживаю|волнуюсь|загоняюсь|бесит|накрывает|не успева|паник|стрем|не могу перестать/i;
const IDEA_RE = /^\s*(идея|мысль|💡|idea)(?=[\s:—-]|$)[:\s—-]*/i; // \b не работает с кириллицей

const captureKey = (text) => text.toLowerCase().replace(/[^a-zа-яё\s]/gi, ' ').split(/\s+/).filter((w) => w.length > 2)[0] || '';

function captureKind(text) {
  const learned = life().capture[captureKey(text)];
  if (learned) return learned;
  if (/^\s*\+/.test(text) && parseExpense(text.replace(/^\s*\+/, ''))) return 'income';
  if (IDEA_RE.test(text)) return 'idea';
  if (WORRY_RE.test(text)) return 'worry';
  const p = parseExpense(text);
  if (p && (p.amount >= 300 || /(^|\s)(к|тг|тенге|₸)(\s|$)|\dк\b/i.test(text)) && (guessCategory(p.text) || p.amount >= 1000)) return 'expense';
  return 'quest';
}

function wireCapture(view) {
  const form = view.querySelector('[data-capture]');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.blur();
    capture(text);
  });
}

function captureHtml() {
  return `<form class="panel capture" data-capture novalidate>
      <input type="text" autocomplete="off" enterkeyhint="send" placeholder="Вбросить: дело, трата, тревога, идея…" aria-label="Быстрый вброс">
      <button class="btn" type="submit" aria-label="Вбросить">+</button>
    </form>`;
}

/** Создаёт запись нужного вида и возвращает, как её отменить. */
function captureAs(kind, text) {
  const { state } = session;
  if (kind === 'income') {
    addIncome(text.replace(/^\s*\+/, ''));
    const inc = fin().incomes.at(-1);
    return () => { fin().incomes = fin().incomes.filter((x) => x !== inc); };
  }
  if (kind === 'expense') {
    const before = fin().expenses.length;
    addExpense(text);
    const e = fin().expenses.length > before ? fin().expenses.at(-1) : null;
    return () => { if (e) fin().expenses = fin().expenses.filter((x) => x !== e); closeSheet(); };
  }
  if (kind === 'worry') {
    const reviewAt = nextReview();
    const w = { id: uid(), at: Date.now(), text, reviewAt, status: null };
    state.worries.push(w);
    feedPart('anxious', 30, 'Выгрузка тревоги');
    return () => { state.worries = state.worries.filter((x) => x !== w); };
  }
  if (kind === 'idea') {
    const t = text.replace(IDEA_RE, '').trim() || text;
    let board = state.boards.find((b) => /иде/i.test(b.title));
    if (!board) {
      board = { id: uid(), title: 'Идеи', createdAt: Date.now(), updatedAt: Date.now(), part: 'dreamer', goalId: null, view: null, items: [], links: [] };
      state.boards.push(board);
    }
    const n = board.items.filter((x) => x.kind === 'note').length;
    const it = { id: uid(), kind: 'note', x: (n % 4) * 180, y: Math.floor(n / 4) * 140, w: 160, h: 120, text: t, color: BD_COLORS[n % BD_COLORS.length] };
    board.items.push(it);
    board.updatedAt = Date.now();
    return () => { board.items = board.items.filter((x) => x !== it); };
  }
  const q = { id: uid(), createdAt: Date.now(), title: text.slice(0, 120), note: '', type: 'normal', stats: state.stats.length ? [state.stats[0].id] : [], repeat: 'none' };
  if (/^(купить|позвонить|написать|ответить|оплатить|выбросить|забрать|отправить)\b/i.test(text) && text.length < 40) q.type = 'chore';
  state.quests.push(q);
  // большие узнаваемые дела разбиваются сразу — не надо ждать, пока они станут «сейчас»
  if (questLoad(q) >= 3 || ['docs', 'content', 'dev', 'meet', 'study', 'health', 'trip'].includes(stepType(q).id)) breakQuest(q, true);
  return () => { state.quests = state.quests.filter((x) => x !== q); };
}

function capture(text, forced) {
  const leave = !forced && parseLeave(text);
  if (leave) {
    life().leave = leave;
    save();
    render();
    Sound.play('quest');
    return toast({ title: 'Отсчёт', main: `Выйти в ${new Date(leave.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`, sub: 'Напомню за 20 и за 5 минут', kind: 'up', ms: 4000 });
  }
  const kind = forced || captureKind(text);
  const undo = captureAs(kind, text);
  save();
  render();
  if (kind === 'expense' || kind === 'income') return; // у трат свой отклик и вопросы
  Sound.play('quest');
  const made = kind === 'quest' && session.state.quests.at(-1);
  const sub = made && made.steps
    ? `Разбил на ${made.steps.length} ${plural(made.steps.length, ['шаг', 'шага', 'шагов'])} · первый на 5 минут`
    : { quest: 'В квестах — пилот поставит по силам', worry: `Вернёмся ${whenText(nextReview())}`, idea: 'На доске «Идеи»' }[kind];
  toast({ title: `→ ${CAPTURE_KINDS[kind]}`, main: text.length > 60 ? text.slice(0, 57) + '…' : text, sub, action: { label: 'Изменить', run: () => recapture(text, kind, undo) }, ms: 6000 });
}

/** «Не то» — выбрать вид; Система запомнит по первому слову. */
function recapture(text, was, undo) {
  const root = openSheet('Что это?', `
    <p class="lead">${esc(text)}</p>
    <div class="q-options">${Object.entries(CAPTURE_KINDS).filter(([k]) => k !== was).map(([k, name]) => `<button class="btn" type="button" data-k="${k}">${name}</button>`).join('')}</div>
    <button class="btn ghost" type="button" data-action="close">Оставить как есть</button>`);
  root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    undo();
    const key = captureKey(text);
    if (key) life().capture[key] = b.dataset.k;
    closeSheet();
    capture(text, b.dataset.k);
  }));
}

/* ---------- Полоска дня: время тает видимо ----------
   От подъёма до вечера и от вечера до сна — без цифр на часах, просто видно, сколько осталось. */

const dayTimes = () => ({ wake: life().wake ?? 8 * 60, evening: session.state.evening.start, sleep: life().sleep ?? 23 * 60 + 30 });

function dayBarHtml() {
  const { wake, evening, sleep } = dayTimes();
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  if (now < wake - 60 || now > sleep + 60) return '';
  const span = sleep - wake;
  const pct = (m) => Math.max(0, Math.min(100, ((m - wake) / span) * 100));
  const left = (m) => hoursText(Math.max(0, m - now));
  const text = now < evening ? `до вечера ${left(evening)} · до сна ${left(sleep)}` : now < sleep ? `вечер · до сна ${left(sleep)}` : 'пора спать';
  return `<div class="daybar" aria-label="${text}">
      <span class="daybar-track"><i class="day" style="width:${pct(evening)}%"></i><i class="eve" style="left:${pct(evening)}%;width:${pct(sleep) - pct(evening)}%"></i><b style="left:${pct(now)}%"></b></span>
      <small>${text}</small>
    </div>`;
}

/* ---------- «Через N минут выходить» ----------
   Пишешь во вброс «выйти в 18:30» — Система ведёт отсчёт: за 20 минут «собирайся», за 5 — «выходи». */

const LEAVE_RE = /^\s*(выйти|выхожу|выход|выезд|выехать|выезжаю|выходить)\s*(в|к)?\s*(\d{1,2})[:.](\d{2})\s*(.*)$/i;

function parseLeave(text) {
  const m = text.match(LEAVE_RE);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[3]), Number(m[4]), 0, 0);
  if (d.getTime() < Date.now() - 5 * 60000) d.setDate(d.getDate() + 1);
  return { at: d.getTime(), what: m[5].trim(), warned: {} };
}

function leaveHtml() {
  const l = life().leave;
  if (!l) return '';
  const min = Math.round((l.at - Date.now()) / 60000);
  const time = new Date(l.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `<div class="panel active-item leave-item${min <= 5 ? ' hot' : min <= 20 ? ' warm' : ''}" data-leave>
      <div><small>Выйти в ${time}${l.what ? ` · ${esc(l.what)}` : ''}</small><b data-ltimer>${min > 0 ? `через ${hoursText(min)}` : 'пора выходить!'}</b></div>
      <button class="btn ghost" type="button" data-action="leave-stop" aria-label="Убрать">×</button>
    </div>`;
}

function tickLeave() {
  const l = life().leave;
  if (!l) return;
  const min = Math.round((l.at - Date.now()) / 60000);
  const el = app.querySelector('[data-ltimer]');
  if (el) {
    el.textContent = min > 0 ? `через ${hoursText(min)}` : 'пора выходить!';
    const box = el.closest('[data-leave]');
    box.classList.toggle('warm', min <= 20 && min > 5);
    box.classList.toggle('hot', min <= 5);
  }
  const warn = (key, title, main) => {
    if (l.warned[key]) return;
    l.warned[key] = true;
    save();
    Sound.play('quest');
    haptic([30, 60, 30]);
    toast({ title, main, sub: l.what || '', kind: 'up', ms: 9000 });
  };
  if (min <= 20 && min > 5) warn('20', 'Через 20 минут выходить', 'Начинай собираться: телефон, ключи, кошелёк');
  if (min <= 5 && min > -10) warn('5', 'Выходи', 'Через 5 минут — пора');
  if (min < -15) {
    life().leave = null;
    save();
    render();
  }
}

/* ---------- Оценка времени ----------
   В квесте можно указать «сколько займёт». Когда начинаешь (5 мин или «Беру») и закрываешь —
   Система сравнивает с фактом и узнаёт твою поправку: «ты обычно ошибаешься в 1,8 раза». */

function estFactor() {
  const list = life().est.slice(-20).map((x) => x.actual / x.est).filter((r) => r > 0.1 && r < 10).sort((a, b) => a - b);
  if (list.length < 3) return null;
  return list[Math.floor(list.length / 2)]; // медиана: одна странная задача не ломает поправку
}

function estText(q) {
  if (!q.est) return '';
  const k = estFactor();
  return k && Math.abs(k - 1) > 0.15 ? `≈${Math.round(q.est * k)} мин (ты пишешь ${q.est})` : `≈${q.est} мин`;
}

function markStarted(q) {
  if (q && !q.startedAt) {
    q.startedAt = Date.now();
    save();
  }
}

function recordEstimate(q) {
  if (!q || !q.est || !q.startedAt || q.estDone) return;
  const actual = Math.round((Date.now() - q.startedAt) / 60000);
  if (actual < 1 || actual > 600) return;
  q.estDone = true;
  life().est.push({ at: Date.now(), est: q.est, actual });
  if (life().est.length > 100) life().est.shift();
  save();
  const k = estFactor();
  if (k) toast({ title: 'Оценка времени', main: `Думал ${q.est} мин — вышло ${actual}`, sub: `Обычно ты ${k > 1 ? `недооцениваешь в ${k.toFixed(1).replace('.', ',')} раза` : 'оцениваешь точно'}`, ms: 5000 });
}

/* ---------- Напоминания через «Команды» ---------- */

function openReminderGuide() {
  openSheet('Напоминания', `
    <p class="dim center">Приложение без сервера не может само прислать уведомление. Это сделает айфон: «Команды» → вкладка «Автоматизация» → «+» → «Время суток».</p>
    <div class="guide">
      <b>1. Утро · 9:30, ежедневно</b>
      <p>Действие «Показать уведомление»: «Как ты сейчас? Открой Систему». Выключи «Подтверждать запуск» — сработает само.</p>
      <b>2. Вечер · ${minToTime(session.state.evening.start)}, ежедневно</b>
      <p>Уведомление: «Посадочная полоса — открой вечер в Системе».</p>
      <b>3. Разбор недели · воскресенье, 19:00</b>
      <p>Уведомление: «5 минут на разбор недели». В Системе он ждёт на экране «Сейчас».</p>
    </div>
    <p class="hint">Нажатие на уведомление откроет «Команды», а не Систему, — открой её с главного экрана. Само напоминание и есть смысл: вспомнить вовремя.</p>
    <button class="btn" type="button" data-action="close">Понятно</button>`);
}

/* =====================================================================
   УМНЕЕ ЗА СЧЁТ ТВОИХ ДАННЫХ — всё считается на телефоне
   ===================================================================== */

const DAY = 864e5;

/** Сводка дня: энергия, опоры, сливы, траты, работа — основа для находок, прогноза и разбора недели. */
function dayFacts(d, doneByDay = supportDoneByDay()) {
  const key = dayKey(d);
  const from = dayStart(d);
  const to = from + DAY;
  const checks = flow().checkins.filter((c) => c.at >= from && c.at < to).map((c) => c.energy);
  const energy = checks.length ? checks.reduce((a, b) => a + b, 0) / checks.length : dayData(key).energy || null;
  const exp = fin().expenses.filter((e) => e.at >= from && e.at < to && !e.fixed);
  const work = session.state.log.filter((e) => e.questId && e.at >= from && e.at < to && !isSupportQuest(e.questId));
  const heavy = work.filter((e) => { const q = findQuest(e.questId); return q && questLoad(q) === 3; }).length;
  const score = supports().length ? dayScore(d, doneByDay) : null;
  return {
    key, d, energy,
    sup: doneByDay.get(key) || new Set(),
    drains: dayData(key).drains,
    cafe: exp.filter((e) => e.cat === 'cafe').length,
    impulse: exp.filter((e) => e.cls === 'want' && e.planned === false).reduce((a, e) => a + e.amount, 0),
    want: exp.filter((e) => e.cls === 'want').reduce((a, e) => a + e.amount, 0),
    work: work.length,
    heavy,
    score: score ? score.score : null,
    logged: checks.length > 0 || work.length > 0 || exp.length > 0 || !!dayData(key).energy,
  };
}

function lastDays(n, offset = 0) {
  const doneByDay = supportDoneByDay();
  const out = [];
  for (let i = n - 1 + offset; i >= offset; i--) out.push(dayFacts(addDays(new Date(), -i), doneByDay));
  return out;
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const num1 = (x) => x.toFixed(1).replace('.', ',');

/** Находки: что делает тебя бодрее на следующий день и что толкает к тратам. Только подтверждённое днями. */
function findInsights() {
  const days = lastDays(60).filter((x) => x.logged);
  if (days.length < 10) return [];
  const out = [];
  const next = new Map(days.map((x) => [x.key, x]));
  const tomorrow = (x) => next.get(dayKey(addDays(x.d, 1)));
  const compare = (has, label, kind) => {
    const yes = [];
    const no = [];
    for (const x of days) {
      const t = tomorrow(x);
      if (!t || !t.energy) continue;
      (has(x) ? yes : no).push(t.energy);
    }
    if (yes.length < 3 || no.length < 3) return;
    const diff = avg(yes) - avg(no);
    if (Math.abs(diff) < 0.5) return;
    out.push({ s: Math.abs(diff), text: kind === 'drain'
      ? `После «${label}» энергия на следующий день ${diff < 0 ? 'ниже' : 'выше'} на ${num1(Math.abs(diff))}`
      : `В дни с «${label}» назавтра энергия ${diff > 0 ? 'выше' : 'ниже'} на ${num1(Math.abs(diff))}` });
  };
  for (const q of supports()) compare((x) => x.sup.has(q.id), q.title.split(':')[0], 'sup');
  for (const dr of session.state.drains) compare((x) => x.drains.includes(dr.id), dr.title, 'drain');
  // опора ↔ доставка
  for (const q of supports()) {
    const yes = days.filter((x) => x.sup.has(q.id));
    const no = days.filter((x) => !x.sup.has(q.id));
    if (yes.length < 4 || no.length < 4) continue;
    const py = yes.filter((x) => x.cafe).length / yes.length;
    const pn = no.filter((x) => x.cafe).length / no.length;
    if (pn - py >= 0.2 && pn > 0) out.push({ s: (pn - py) * 3, text: `Без «${q.title.split(':')[0]}» кафе и доставка случаются в ${Math.round(pn * 100)}% дней, с ней — в ${Math.round(py * 100)}%` });
  }
  // нагрузка → откат
  const heavyDays = days.filter((x) => x.heavy >= 2 && tomorrow(x) && tomorrow(x).energy);
  if (heavyDays.length >= 3) {
    const after = avg(heavyDays.map((x) => tomorrow(x).energy));
    const base = avg(days.filter((x) => x.energy).map((x) => x.energy));
    if (base - after >= 0.6) out.push({ s: base - after, text: `После дня с 2+ тяжёлыми квестами энергия назавтра в среднем ${num1(after)} — ниже обычной (${num1(base)})` });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, 5);
}

function insightsHtml() {
  const list = findInsights();
  if (!list.length) return '';
  return fold('finds', `Находки <span class="count">${list.length}</span>`, `<div class="panel pad">${list.map((x) => `<p class="find">🔎 ${esc(x.text)}</p>`).join('')}
    <p class="hint" style="margin:8px 0 0">Это связи из твоих же дней, не правила. Проверяй экспериментами в разборе недели.</p></div>`);
}

/** Прогноз отката на завтра: признаки за последние два дня. */
function predictEbb() {
  if (!session.state.settings.pilot) return null;
  const [y, t] = lastDays(2);
  const reasons = [];
  if (y.heavy + t.heavy >= 3) reasons.push('много тяжёлого два дня подряд');
  const sleep = supports().find((q) => /сон|спать|sleep/i.test(q.title));
  if (sleep && !t.sup.has(sleep.id) && !y.sup.has(sleep.id)) reasons.push('сон без отметки два дня');
  if (y.drains.length + t.drains.length >= 3) reasons.push('сливы энергии');
  if (t.score !== null && t.score < 40) reasons.push('шарик проседает');
  const recent = lastDays(10).map((x) => (x.energy ? (x.energy >= 3.7 ? 'w' : x.energy <= 2.3 ? 'e' : 'n') : '-'));
  let run = 0;
  for (let i = recent.length - 1; i >= 0 && recent[i] === 'w'; i--) run++;
  if (run >= 3) reasons.push(`волна уже ${run} ${plural(run, ['день', 'дня', 'дней'])}`);
  return reasons.length >= 2 ? reasons : null;
}

/** Облегчить завтра: тяжёлое, которое не начато, — «подождёт волны». */
function easeTomorrow() {
  const done = completionIndex();
  const heavy = session.state.quests.filter((q) => q.area !== 'state' && !done.has(q.id) && questLoad(q) === 3 && !q.wait && !q.startedAt);
  heavy.forEach((q) => { q.wait = true; });
  life().eased = dayKey(new Date());
  save();
  render();
  toast({ title: 'Завтра полегче', main: heavy.length ? `${heavy.length} ${plural(heavy.length, ['тяжёлый квест подождёт', 'тяжёлых квеста подождут', 'тяжёлых квестов подождут'])} волны` : 'Тяжёлого в плане и так нет', sub: 'Вернутся сами, когда придёт волна', kind: 'up', ms: 5000 });
}

/* ---------- Реальный эффект блюд меню ----------
   Не только твоё «помогло?», но и энергия: оценка в течение 4 часов после блюда против оценки до него. */

function recordTake(item) {
  life().takes = life().takes || [];
  life().takes.push({ at: Date.now(), id: item.id });
  if (life().takes.length > 400) life().takes.shift();
}

function realEffect(it) {
  const takes = (life().takes || []).filter((x) => x.id === it.id);
  const deltas = [];
  for (const t of takes) {
    const before = flow().checkins.filter((c) => c.at < t.at && t.at - c.at < 4 * 3600000).at(-1);
    const after = flow().checkins.find((c) => c.at > t.at && c.at - t.at < 4 * 3600000);
    if (before && after) deltas.push(after.energy - before.energy);
  }
  return deltas.length >= 2 ? avg(deltas) : null;
}

/** Итог для подбора: оценки «помогло?» плюс замеренная энергия. */
function itemScore(it) {
  const real = realEffect(it);
  return itemEffect(it) + (real === null ? 0 : real * 0.6);
}

/* ---------- Твоё время для вопросов ---------- */

function askHourStat(hour) {
  const s = (life().ask || {})[hour] || [0, 0];
  return { shown: s[0], answered: s[1] };
}

function noteAsk(answered) {
  life().ask = life().ask || {};
  const h = new Date().getHours();
  const s = life().ask[h] || [0, 0];
  if (answered) s[1]++;
  else s[0]++;
  life().ask[h] = s;
}

/** Спрашивать ли сейчас: в часы, когда ты обычно отмахиваешься, Система молчит. */
function goodAskHour() {
  const { shown, answered } = askHourStat(new Date().getHours());
  return shown < 3 || answered / shown >= 0.34;
}

/* ---------- Разбор недели ---------- */

const weekId = (d = new Date()) => weekKey(d);

function reviewDue() {
  const d = new Date();
  const last = (life().reviews || []).at(-1);
  if (last && last.week === weekId(addDays(d, d.getDay() === 0 ? 0 : -1))) return false;
  if (last && Date.now() - last.at < 5 * DAY) return false;
  const sunday = d.getDay() === 0 && d.getHours() >= 15;
  const monday = d.getDay() === 1;
  return (sunday || monday) && lastDays(7).filter((x) => x.logged).length >= 3;
}

function weekSummary() {
  const days = lastDays(7);
  const logged = days.filter((x) => x.logged);
  const withE = days.filter((x) => x.energy);
  const best = withE.slice().sort((a, b) => b.energy - a.energy)[0];
  const worst = withE.slice().sort((a, b) => a.energy - b.energy)[0];
  const drainCount = new Map();
  for (const x of days) for (const id of x.drains) drainCount.set(id, (drainCount.get(id) || 0) + 1);
  const topDrain = [...drainCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const supCount = new Map();
  for (const x of days) for (const id of x.sup) supCount.set(id, (supCount.get(id) || 0) + 1);
  const daily = supports().filter((q) => q.repeat === 'daily');
  const weakest = daily.slice().sort((a, b) => (supCount.get(a.id) || 0) - (supCount.get(b.id) || 0))[0];
  const why = (x) => {
    const parts = [];
    const n = x.sup.size;
    if (n) parts.push(`опор ${n}`);
    if (x.drains.length) parts.push(`сливов ${x.drains.length}`);
    if (x.work) parts.push(`квестов ${x.work}`);
    return parts.join(', ') || 'мало записей';
  };
  return {
    days, logged,
    modes: days.map((x) => (x.energy ? (x.energy >= 3.7 ? 'wave' : x.energy <= 2.3 ? 'ebb' : 'even') : '')),
    quests: days.reduce((a, x) => a + x.work, 0),
    impulse: days.reduce((a, x) => a + x.impulse, 0),
    best, worst,
    bestWhy: best ? why(best) : '', worstWhy: worst ? why(worst) : '',
    topDrain: topDrain ? { title: (session.state.drains.find((d) => d.id === topDrain[0]) || { title: 'слив' }).title, n: topDrain[1] } : null,
    weakest: weakest ? { q: weakest, n: supCount.get(weakest.id) || 0 } : null,
  };
}

/** Эксперименты недели: что попробовать — из самых слабых мест. */
function reviewExperiments(sum) {
  const list = [];
  if (sum.weakest && sum.weakest.n < 5) list.push({ id: 'sup', text: `«${sum.weakest.q.title.split(':')[0]}» каждый день`, target: sum.weakest.q.id });
  if (sum.topDrain && sum.topDrain.n >= 2) list.push({ id: 'drain', text: `Без «${sum.topDrain.title}» хотя бы 4 дня из 7`, target: sum.topDrain.title });
  list.push({ id: 'five', text: 'Каждое утро 5 минут на самое тяжёлое' });
  if (sum.impulse > 0) list.push({ id: 'pause', text: 'Пауза 10 минут перед каждой импульсной покупкой' });
  return list.slice(0, 3);
}

/** Как прошёл прошлый эксперимент — по данным недели. */
function experimentResult(exp, sum) {
  if (!exp) return null;
  if (exp.id === 'sup') {
    const n = sum.days.filter((x) => x.sup.has(exp.target)).length;
    return { ok: n >= 6, text: `${exp.text}: ${n} из 7 дней` };
  }
  if (exp.id === 'drain') {
    const dr = session.state.drains.find((d) => d.title === exp.target);
    const n = dr ? sum.days.filter((x) => !x.drains.includes(dr.id)).length : 0;
    return { ok: n >= 4, text: `${exp.text}: чистых дней ${n}` };
  }
  return { ok: null, text: `${exp.text} — как ощущается? Отметь честно` };
}

function openReview() {
  const sum = weekSummary();
  const prev = (life().reviews || []).at(-1);
  const res = prev && experimentResult(prev.exp, sum);
  const finds = findInsights();
  const lesson = finds[0] ? finds[0].text
    : sum.topDrain ? `Главный слив недели — «${sum.topDrain.title}» (${sum.topDrain.n} ${plural(sum.topDrain.n, ['раз', 'раза', 'раз'])})`
      : sum.best ? `Лучший день — ${dayTitle(sum.best.d)}: ${sum.bestWhy}` : 'Неделя без больших перекосов';
  const exps = reviewExperiments(sum);
  const label = { wave: '🌊', even: '〰️', ebb: '🌙', '': '·' };
  const root = openSheet('Разбор недели', `
    <div class="review">
      <div class="waves" style="grid-template-columns:repeat(7,1fr)">${sum.days.map((x, i) => `<i class="${sum.modes[i]}" title="${dayTitle(x.d)}"></i>`).join('')}</div>
      <p class="dim center" style="margin-top:6px">${sum.modes.map((m) => label[m]).join(' ')}</p>
      <div class="stat-row"><span>Закрыто квестов</span><span class="mono">${sum.quests}</span></div>
      ${sum.best ? `<div class="stat-row"><span>Лучший день</span><span>${dayTitle(sum.best.d)} · ⚡${num1(sum.best.energy)}</span></div><p class="hint" style="margin:0">${esc(sum.bestWhy)}</p>` : ''}
      ${sum.worst && sum.worst !== sum.best ? `<div class="stat-row"><span>Тяжёлый день</span><span>${dayTitle(sum.worst.d)} · ⚡${num1(sum.worst.energy)}</span></div><p class="hint" style="margin:0">${esc(sum.worstWhy)}</p>` : ''}
      ${sum.topDrain ? `<div class="stat-row"><span>Главный слив</span><span>${esc(sum.topDrain.title)} · ${sum.topDrain.n}×</span></div>` : ''}
      ${sum.impulse ? `<div class="stat-row"><span>Импульсные траты</span><span class="mono">${money(sum.impulse)}</span></div>` : ''}
      ${res ? `<div class="pilot-lead" style="margin-top:12px">${res.ok === true ? '✅' : res.ok === false ? '↻' : '🧪'} Прошлый эксперимент: ${esc(res.text)}</div>` : ''}
      <div class="pilot-lbl">Вывод</div>
      <p class="find">🔎 ${esc(lesson)}</p>
      <div class="pilot-lbl">Эксперимент на неделю — выбери один</div>
      <div class="feed-list" style="--pc:var(--accent)">${exps.map((x, i) => `<button type="button" data-exp="${i}">${esc(x.text)}</button>`).join('')}</div>
    </div>
    <button class="btn ghost" type="button" data-skipexp style="margin-top:12px">Без эксперимента</button>`);
  const finish = (exp) => {
    life().reviews = life().reviews || [];
    life().reviews.push({ at: Date.now(), week: weekId(addDays(new Date(), new Date().getDay() === 0 ? 0 : -1)), exp, lesson });
    const { state } = session;
    const xp = state.settings.xp.normal;
    const discipline = state.stats.find((st) => st.name === 'Дисциплина');
    state.log.push({ id: uid(), questId: null, title: 'Разбор недели', type: 'normal', xp, stats: discipline ? { [discipline.id]: xp } : {}, period: 'r:' + weekId(), at: Date.now(), source: 'review' });
    feedPart('deep', 35, 'Разбор недели');
    save();
    closeSheet();
    render();
    Sound.play('quest');
    toast({ title: 'Разбор недели', main: `+${xp} XP`, sub: exp ? `Эксперимент: ${exp.text}` : 'Увидимся через неделю', kind: 'up', ms: 5000 });
  };
  root.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', () => finish(exps[Number(b.dataset.exp)])));
  root.querySelector('[data-skipexp]').addEventListener('click', () => finish(null));
}

/** Строки для «Сейчас»: разбор недели, прогноз отката, эксперимент недели. */
function lifeLines(line) {
  const out = [];
  if (reviewDue()) out.push(line('📊', 'Разбор недели — 5 минут', 'review'));
  const h = new Date().getHours();
  if (h >= 15 && life().eased !== dayKey(new Date())) {
    const ebb = predictEbb();
    if (ebb) out.push(line('🔮', `Завтра, похоже, откат: ${esc(ebb.slice(0, 2).join(', '))}. Облегчить?`, 'ease-tomorrow', ' warn'));
  }
  const last = (life().reviews || []).at(-1);
  if (last && last.exp && Date.now() - last.at < 7 * DAY) out.push(line('🧪', `Эксперимент недели: ${esc(last.exp.text)}`, 'review-exp'));
  return out;
}

/* ---------- Голоса личностей ----------
   В плане говорит тот, кто у руля (или тот, кому нужен заряд). Фразы — по одной в строке, правятся в карточке. */

const PART_VOICES = {
  smm: ['Одна идея, упакованная хорошо, лучше десяти в голове.', 'Сначала смысл, потом красота.'],
  dreamer: ['Посмотри дальше сегодняшнего дня — ради чего это всё?', 'Можно делать медленно. Главное — в свою сторону.'],
  image: ['Ты выглядишь так, как к себе относишься.', 'Пять минут на себя — и мир видит другого человека.'],
  love: ['Напиши тому, с кем можно быть собой.', 'Близость начинается с одного тёплого сообщения.'],
  body: ['Вода, еда, движение. Остальное потом.', 'Тело везёт тебя весь день — дай ему топливо.'],
  deep: ['Что ты на самом деле чувствуешь сейчас?', 'Честный ответ себе стоит больше идеального плана.'],
  anxious: ['Запиши, что тревожит, — на бумаге оно меньше.', 'Ты в безопасности. Сделаем один маленький шаг.'],
  fun: ['Серьёзность — не обязательный пункт.', 'Три трека — и мир снова цветной.'],
  tired: ['Можно ничего не решать сегодня.', 'Отдых — тоже работа. Самая честная.'],
  warrior: ['Одно дело — и ты уже победил.', 'Сильный — это тот, кто вовремя останавливается.'],
};

function partVoice(id) {
  const own = (partsState().voices || {})[id];
  const lines = own && own.length ? own : PART_VOICES[id] || [];
  return lines.length ? lines[new Date().getHours() % lines.length] : '';
}

function voiceHtml() {
  if (!mod('parts')) return '';
  const lead = leadNow();
  const id = lead ? lead.id : partWanted(partCharges());
  const text = partVoice(id);
  return text ? `<p class="pilot-voice" style="--pc:${PART[id].color}">«${esc(text)}» <small>— ${esc(PART[id].short)}</small></p>` : '';
}

/* ---------- Прогноз до конца месяца ----------
   Темп трат за последние две недели против свободных денег: хватит ли до конца месяца. */

function monthForecast() {
  const lim = limitsNow();
  if (!lim) return null;
  const f = fin();
  const now = new Date();
  const firstAt = Math.min(f.since || Date.now(), ...f.expenses.map((e) => e.at));
  const days = Math.min(14, Math.floor((dayStart(now) - dayStart(new Date(firstAt))) / DAY) + 1);
  if (days < 5) return null;
  const pace = spentBetween(dayStart(addDays(now, -(days - 1))), Date.now() + 1) / days;
  if (pace <= 0) return null;
  const left = daysInMonth(now) - now.getDate(); // дней после сегодняшнего
  const remain = lim.free - pace * left;
  if (remain >= 0) return { ok: true, pace, text: `При таком темпе (~${money(pace)} в день) к концу месяца останется ~${money(Math.round(remain / 100) * 100)}` };
  const lastDay = now.getDate() + Math.max(0, Math.floor(lim.free / pace));
  return { ok: false, pace, text: `При таком темпе (~${money(pace)} в день) денег хватит примерно до ${lastDay}-го. Чтобы дотянуть, нужно ~${money(Math.max(0, lim.free) / Math.max(1, left))} в день` };
}

function forecastHtml() {
  const fc = monthForecast();
  return fc ? `<p class="forecast${fc.ok ? '' : ' bad'}">${fc.ok ? '📈' : '⚠️'} ${fc.text}</p>` : '';
}

/* ---------- Быт по ритму ----------
   Стирка, уборка, мусор, связь, стрижка: квест появляется сам, когда подходит срок.
   Ритм подстраивается: если делаешь чаще или реже, интервал сдвигается к твоему настоящему. */

const ROUTINE_PRESET = [
  { title: 'Стирка', every: 4 },
  { title: 'Уборка', every: 7 },
  { title: 'Вынести мусор', every: 2 },
  { title: 'Сменить постельное', every: 14 },
  { title: 'Оплатить связь', every: 30 },
  { title: 'Стрижка', every: 28 },
];

function routines() {
  if (!life().routines) life().routines = ROUTINE_PRESET.map((r) => ({ id: uid(), ...r, on: true, last: Date.now() }));
  return life().routines;
}

/** Ставит бытовые квесты, срок которых подошёл. */
function ensureRoutines() {
  if (!mod('routines')) return;
  const { state } = session;
  const done = completionIndex();
  let added = 0;
  for (const r of routines()) {
    if (!r.on || Date.now() - r.last < r.every * DAY - 6 * 3600000) continue;
    if (state.quests.some((q) => q.routineId === r.id && !done.has(q.id))) continue;
    state.quests.push({ id: uid(), createdAt: Date.now(), title: r.title, note: `Быт · раз в ${r.every} ${plural(r.every, ['день', 'дня', 'дней'])}`, type: 'chore', stats: state.stats.length ? [state.stats[0].id] : [], repeat: 'none', routineId: r.id, parts: ['body'] });
    added++;
  }
  if (added) {
    save();
    toast({ title: 'Быт', main: added === 1 ? 'Подошёл срок бытового дела' : `Подошли сроки: ${added}`, sub: 'Они в квестах — лёгкие, на откат', ms: 4000 });
  }
}

/** Бытовой квест закрыт: запоминаем дату и подстраиваем ритм к настоящему. */
function routineDone(q) {
  const r = routines().find((x) => x.id === q.routineId);
  if (!r) return;
  const real = (Date.now() - r.last) / DAY;
  if (real >= 1 && real < r.every * 3) r.every = Math.max(1, Math.round(r.every * 0.75 + real * 0.25));
  r.last = Date.now();
}

function routinesSettingsHtml() {
  return `<div class="section-h">Быт по ритму</div>
    <div class="panel pad" data-routines>
      ${routines().map((r) => `<div class="routine-row" data-r="${r.id}">
          <input type="checkbox" data-ron${r.on ? ' checked' : ''} aria-label="Включено">
          <input type="text" data-rtitle maxlength="40" value="${esc(r.title)}">
          <span class="xp-input">раз в <input type="number" data-revery min="1" max="365" value="${r.every}"> дн.</span>
        </div>`).join('')}
      <button class="btn ghost" type="button" data-radd>+ Своё дело</button>
      <p class="hint" style="margin:8px 0 0">Квест появится сам, когда подойдёт срок. Если делаешь чаще или реже — ритм подстроится.</p>
    </div>`;
}

function wireRoutines(view) {
  const box = view.querySelector('[data-routines]');
  if (!box) return;
  box.addEventListener('change', (e) => {
    const row = e.target.closest('[data-r]');
    if (!row) return;
    const r = routines().find((x) => x.id === row.dataset.r);
    r.on = row.querySelector('[data-ron]').checked;
    r.title = row.querySelector('[data-rtitle]').value.trim() || r.title;
    r.every = Math.max(1, Math.min(365, Number(row.querySelector('[data-revery]').value) || r.every));
    save();
  });
  box.querySelector('[data-radd]').addEventListener('click', () => {
    routines().push({ id: uid(), title: 'Новое дело', every: 7, on: true, last: Date.now() });
    save();
    render();
  });
}
