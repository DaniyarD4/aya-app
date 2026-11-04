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
  if (typeof recordEstimate === 'function') recordEstimate(q, f);
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
