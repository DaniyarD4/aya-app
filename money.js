/*
 * Денежный автопилот — решения о деньгах принимает Система, ты только вписываешь поступления и траты.
 * Методики: «сначала заплати себе» и Profit First (каждое поступление сразу раскладывается по кошелькам),
 * копилки под хотелки (sinking funds) с правилом 48 часов, «можно купить?» вместо мучительного выбора,
 * план вместо борьбы (частая хотелка получает честный недельный лимит), разбор недели (Kakeibo).
 * Режим стабилизации — пока доход нестабилен: сколько откладывать, зависит от размера поступления.
 * Кошельки виртуальные: Система помнит, где сколько; переводить ли в копилку банка — решаешь сам.
 */

const ap = () => fin().ap;
const STARTER = 50000; // подушка-старт: первая реальная цель
const DAY_MS = 864e5;

/** Сколько нужно на месяц жизни: обязательные + обычные траты за последние 60 дней. */
function monthNeed() {
  const f = fin();
  const fixed = f.fixed.reduce((a, x) => a + x.amount, 0);
  const first = Math.min(Date.now(), ...f.expenses.map((e) => e.at));
  const days = Math.min(60, Math.max(14, (Date.now() - first) / DAY_MS));
  const living = (spentBetween(Date.now() - days * DAY_MS, Date.now() + 1) / days) * 30;
  const need = Math.round((fixed + living) / 1000) * 1000;
  return need >= 30000 ? need : Math.max(need, f.expected ? Math.round(f.expected * 0.8) : 150000);
}

/** Раскладка поступления: чем оно больше относительно месячной нужды — тем больше в подушку и хотелки. */
function splitFor(amount) {
  const f = fin();
  if (!ap() || !ap().on) return { save: f.savePct, joy: f.joyPct || 0, wish: 0 };
  const r = amount / monthNeed();
  const starter = cushion() < STARTER;
  const grow = ap().mode === 'grow';
  const save = grow ? 15 : starter ? (r < 0.5 ? 10 : r < 1 ? 15 : 20) : (r < 0.5 ? 5 : r < 1 ? 10 : 15);
  const wish = grow ? 15 : r < 0.5 ? 0 : r < 1 ? 5 : 10;
  const joy = r < 0.3 ? Math.min(3, f.joyPct || 0) : f.joyPct || 0;
  return { save, joy, wish };
}

/** Доля поступления на жизнь — по раскладке, сделанной в момент поступления (старые — по текущим процентам). */
function netOf(i) {
  if (i.adjust) return i.amount;
  const s = i.split || { save: fin().savePct, joy: fin().joyPct || 0, wish: 0 };
  return Math.round(i.amount * (1 - (s.save + s.joy + s.wish) / 100));
}

const part = (i, k) => (i.adjust ? 0 : (i.amount * ((i.split ? i.split[k] : k === 'save' ? fin().savePct : k === 'joy' ? fin().joyPct || 0 : 0) || 0)) / 100);

function cushion() {
  const f = fin();
  const a = f.ap || {};
  const inflow = f.incomes.reduce((s, i) => s + (i.split ? part(i, 'save') : 0), 0); // до автопилота — не считаем: что было, впиши в «Уже отложено»
  const out = f.expenses.reduce((s, e) => s + (e.wallet === 'cushion' ? e.amount : 0), 0);
  return Math.round((a.start || 0) + inflow - out);
}

function wishPool() {
  const f = fin();
  const inflow = f.incomes.reduce((s, i) => s + part(i, 'wish'), 0);
  const out = f.expenses.reduce((s, e) => s + (e.wallet === 'wish' ? e.amount : 0), 0);
  return Math.round(inflow - out);
}

/* ---------- Стабильность ----------
   Стабилизация, пока доход не держится 3 месяца подряд выше месячной нужды и подушка меньше месяца. */

function monthIncomes(n = 3) {
  const now = new Date();
  const out = [];
  for (let k = 1; k <= n; k++) {
    const from = new Date(now.getFullYear(), now.getMonth() - k, 1).getTime();
    const to = new Date(now.getFullYear(), now.getMonth() - k + 1, 1).getTime();
    out.push(fin().incomes.reduce((a, i) => a + (!i.adjust && i.at >= from && i.at < to ? i.amount : 0), 0));
  }
  return out;
}

function stability() {
  const need = monthNeed();
  const months = monthIncomes(3);
  const stableMonths = months.filter((x) => x >= need).length;
  const c = cushion();
  const ready = stableMonths === 3 && c >= need;
  return { need, months, stableMonths, cushion: c, ready, step: c < STARTER ? 1 : c < need ? 2 : 3 };
}

/* ---------- Хотелки ----------
   Очередь: сначала то, что помогает зарабатывать, и дешёвое; большое закрыто до стабильного дохода.
   48 часов «остывания» после добавления: если хотелка прошла проверку временем — она настоящая. */

const WISH_INVEST = /петличк|микрофон|камер|свет|штатив|ноут|макбук|macbook|курс|обучен|для блог|для работ/i;
const COOL_MS = 48 * 3600000;

function wishes() {
  return ap().wishes;
}

function wishLocked(w) {
  return ap().mode !== 'grow' && w.price > monthNeed() * 2;
}

function sortWishes() {
  if (ap().manualOrder) return;
  const tiny = (w) => w.price <= Math.max(15000, monthNeed() * 0.15); // мелочь — сразу: быстрая победа держит мотивацию
  wishes().sort((a, b) => (wishLocked(a) - wishLocked(b)) || (tiny(b) - tiny(a)) || ((b.kind === 'invest') - (a.kind === 'invest')) || a.price - b.price);
}

/** Сколько из копилки приходится на каждую хотелку: заполняем по очереди, закрытые пропускаем. */
function wishAlloc() {
  let pool = Math.max(0, wishPool());
  const out = new Map();
  for (const w of wishes().filter((x) => !x.boughtAt)) {
    if (wishLocked(w)) { out.set(w.id, 0); continue; }
    const got = Math.min(pool, w.price);
    out.set(w.id, got);
    pool -= got;
  }
  return out;
}

/** Сколько в среднем приходит в копилку хотелок за месяц — для прогноза даты (за 90 дней или с включения). */
function wishInflow() {
  const from = Math.max(Date.now() - 90 * DAY_MS, ap().at || 0);
  const months = Math.max(1, (Date.now() - from) / (30 * DAY_MS));
  const sum = fin().incomes.reduce((a, i) => a + (i.at >= from ? part(i, 'wish') : 0), 0);
  return sum / months;
}

function wishEta(w, alloc) {
  const got = alloc.get(w.id) || 0;
  if (got >= w.price) return 'накоплено — можно покупать';
  if (wishLocked(w)) return 'после стабильного дохода';
  const ahead = wishes().filter((x) => !x.boughtAt && !wishLocked(x)).reduce((a, x) => (wishes().indexOf(x) < wishes().indexOf(w) ? a + (x.price - (alloc.get(x.id) || 0)) : a), 0);
  const per = wishInflow();
  if (per < 100) return 'дата появится после первых поступлений';
  const months = (ahead + w.price - got) / per;
  const d = new Date(Date.now() + months * 30 * DAY_MS);
  return `≈ ${d.toLocaleDateString('ru-RU', { month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}`;
}

function addWish(title, price) {
  const w = { id: uid(), title: title.trim().slice(0, 60) || 'Хотелка', price: Math.round(price), at: Date.now(), kind: WISH_INVEST.test(title) ? 'invest' : 'joy' };
  wishes().push(w);
  sortWishes();
  save();
  return w;
}

/* ---------- Карточка в «Деньгах» ---------- */

function apHtml() {
  const f = fin();
  if (!ap() || !ap().on) {
    return `<section class="panel pad ap-card">
        <p class="tag" style="margin-top:12px">[ АВТОПИЛОТ ]</p>
        <h3 class="ap-title">Сними с себя денежные решения</h3>
        <p class="hint" style="margin:6px 0 0">Каждое поступление Система сама разложит: подушка, копилка хотелок, радости, жизнь. Сколько — зависит от размера поступления. Плюс кнопка «Можно купить?».</p>
        <button class="btn" type="button" data-action="ap-setup">Включить автопилот</button>
      </section>`;
  }
  const st = stability();
  const alloc = wishAlloc();
  const list = wishes().filter((w) => !w.boughtAt).slice(0, 3);
  const bar = (v, max) => `<span class="fin-bar"><i data-pct="${Math.min(100, max ? (v / max) * 100 : 0).toFixed(1)}"></i></span>`;
  const goal = st.step === 1 ? STARTER : st.need;
  const allow = Object.entries(ap().allow || {});
  const sw = moneyStrengths();
  return `<section class="panel pad ap-card">
      <div class="ap-head"><p class="tag">[ АВТОПИЛОТ · ${ap().mode === 'grow' ? 'РОСТ' : 'СТАБИЛИЗАЦИЯ'} ]</p><button class="hero-link" type="button" data-action="ap-setup">настроить</button></div>
      <button class="btn" type="button" data-action="can-buy">Можно купить?</button>
      <div class="ap-wallet"><div class="fin-head"><span>🛡 Подушка${st.step === 1 ? '-старт' : ''}</span><span>${money(st.cushion)} / ${money(goal)}</span></div>${bar(st.cushion, goal)}</div>
      <div class="ap-wallet"><div class="fin-head"><span>🎁 Копилка хотелок</span><span>${money(Math.max(0, wishPool()))}</span></div></div>
      ${list.map((w) => {
        const got = alloc.get(w.id) || 0;
        return `<button class="ap-wish${wishLocked(w) ? ' locked' : ''}${got >= w.price ? ' full' : ''}" type="button" data-wish="${w.id}">
          <span class="fin-head"><span>${wishLocked(w) ? '🔒' : w.kind === 'invest' ? '📈' : '✨'} ${esc(w.title)}</span><span>${money(got)} / ${money(w.price)}</span></span>${bar(got, w.price)}
          <small>${wishEta(w, alloc)}</small></button>`;
      }).join('')}
      <div class="hero-row"><button class="btn ghost" type="button" data-action="wish-add">+ Хотелка</button>${wishes().length > 3 ? `<button class="btn ghost" type="button" data-action="wish-all">Все (${wishes().filter((w) => !w.boughtAt).length})</button>` : ''}</div>
      ${allow.length ? `<p class="hint" style="margin:12px 0 0">План вместо борьбы: ${allow.map(([cat, v]) => `${FIN_CAT[cat].name.toLowerCase()} ≤ ${money(v)}/нед`).join(' · ')}</p>` : ''}
      ${sw.good ? `<p class="ap-sw">💪 ${esc(sw.good)}</p>` : ''}${sw.bad ? `<p class="ap-sw bad">⚠️ ${esc(sw.bad)}</p>` : ''}
      ${st.ready && ap().mode !== 'grow' ? `<div class="pilot-lead" style="margin-top:12px">Доход 3 месяца подряд выше нужды, подушка на месяц есть. Пора в режим роста: больше в хотелки и накопления.<button class="btn" type="button" data-action="ap-grow">Перейти в рост</button></div>` : ''}
    </section>`;
}

/** Сильное и слабое — одной строкой каждое. */
function moneyStrengths() {
  const f = fin();
  let good = '';
  const streak = finStreak();
  if (streak >= 3) good = `${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд в лимите`;
  const noSpend = Object.keys(f.noSpend).filter((k) => Date.now() - new Date(k).getTime() < 14 * DAY_MS).length;
  if (!good && noSpend >= 2) good = `${noSpend} ${plural(noSpend, ['день', 'дня', 'дней'])} без трат за 2 недели`;
  const groceries = f.expenses.filter((e) => e.cat === 'groceries' && Date.now() - e.at < 30 * DAY_MS).length;
  if (!good && groceries >= 2) good = 'Продукты покупаешь регулярно — меньше доставки';
  if (!good && cushion() > 0) good = `Подушка растёт: ${money(cushion())}`;
  const leak = typeof spendPatterns === 'function' ? spendPatterns()[0] : null;
  const bad = leak ? `Слабое место — ${FIN_CAT[leak.cat].name.toLowerCase()}: ~${money(leak.month)} в месяц` : '';
  return { good, bad };
}

/* ---------- Настройка ---------- */

function openApSetup() {
  const f = fin();
  if (!f.ap) f.ap = { on: false, start: 0, wishes: [], allow: {}, mode: 'stab' };
  const need = monthNeed();
  const root = openSheet('Автопилот', `
    <p class="dim center">Месячная нужда по твоим тратам: <b>${money(need)}</b>. От неё Система решает, как разложить каждое поступление.</p>
    <div class="ap-rule"><b>Маленькое поступление</b> (меньше половины нужды): 10% в подушку, хотелки ждут</div>
    <div class="ap-rule"><b>Среднее</b>: 15% в подушку, 5% в хотелки</div>
    <div class="ap-rule"><b>Большое</b> (больше нужды): 20% в подушку, 10% в хотелки</div>
    <p class="hint">Фонд радостей остаётся как был (${f.joyPct || 0}%). Первая цель — подушка-старт ${money(STARTER)}, потом — месяц жизни.</p>
    <label class="field"><span>Уже отложено, ₸</span><input name="start" type="number" inputmode="numeric" min="0" step="100" value="${ap().start || 0}"></label>
    <button class="btn" type="button" data-ok>${ap().on ? 'Сохранить' : 'Включить'}</button>
    ${ap().on ? '<button class="btn ghost danger-text" type="button" data-off>Выключить автопилот</button>' : ''}
    <button class="btn ghost" type="button" data-action="close">Отмена</button>`);
  root.querySelector('[data-ok]').addEventListener('click', () => {
    const a = ap();
    a.start = Math.max(0, Math.round(Number(root.querySelector('input[name="start"]').value) || 0));
    if (!a.on) { a.on = true; a.at = Date.now(); }
    save();
    closeSheet();
    render();
    toast({ title: 'Автопилот', main: 'Включён', sub: 'Следующее поступление разложится само', kind: 'up', ms: 4000 });
  });
  const off = root.querySelector('[data-off]');
  if (off) off.addEventListener('click', () => confirmPress(off, 'Точно выключить? Нажми ещё раз', () => { ap().on = false; save(); closeSheet(); render(); }));
}

/* ---------- Хотелки: добавить, очередь, купить, передумать ---------- */

function openWishAdd(prefill = {}) {
  const root = openSheet('Хотелка', `
    <label class="field"><span>Что хочется</span><input name="title" type="text" maxlength="60" autocomplete="off" value="${esc(prefill.title || '')}" placeholder="Например: Лего"></label>
    <label class="field"><span>Цена, ₸</span><input name="price" type="number" inputmode="numeric" min="1" step="1000" value="${prefill.price || ''}"></label>
    <p class="hint">48 часов хотелка «остывает»: если через 2 дня всё ещё хочется — она настоящая. Купить можно, когда копилка дойдёт до цены.</p>
    <p class="error" data-error></p>
    <button class="btn" type="button" data-ok>Добавить в очередь</button>
    <button class="btn ghost" type="button" data-action="close">Отмена</button>`);
  root.querySelector('[data-ok]').addEventListener('click', () => {
    const title = root.querySelector('input[name="title"]').value;
    const price = Number(root.querySelector('input[name="price"]').value);
    if (!title.trim() || !(price > 0)) return sheetError(root, 'Впиши, что и сколько стоит.');
    const w = addWish(title, price);
    closeSheet();
    render();
    const alloc = wishAlloc();
    toast({ title: 'Хотелка', main: w.title, sub: `${wishLocked(w) ? 'Закрыта до стабильного дохода' : `Место в очереди: ${wishes().filter((x) => !x.boughtAt).indexOf(w) + 1} · ${wishEta(w, alloc)}`}`, kind: 'up', ms: 5000 });
  });
}

function openWish(id) {
  const w = wishes().find((x) => x.id === id);
  if (!w) return;
  const alloc = wishAlloc();
  const got = alloc.get(w.id) || 0;
  const cooling = Date.now() - w.at < COOL_MS;
  const ready = got >= w.price && !cooling;
  const root = openSheet(w.title, `
    <p class="lead">${money(got)} из ${money(w.price)}</p>
    <p class="dim center">${wishLocked(w) ? 'Большая покупка — откроется, когда доход станет стабильным. Так она не съест подушку.' : cooling ? `Остывает до ${whenText(w.at + COOL_MS)}. Если потом всё ещё хочется — она настоящая.` : wishEta(w, alloc)}</p>
    ${ready ? '<button class="btn gold" type="button" data-buy>Купил — без вины</button>' : ''}
    <div class="hero-row"><button class="btn ghost" type="button" data-up>Выше в очереди</button><button class="btn ghost" type="button" data-down>Ниже</button></div>
    <button class="btn ghost" type="button" data-kind>${w.kind === 'invest' ? 'Это для дела ✓' : 'Это для дела?'}</button>
    <button class="btn ghost danger-text" type="button" data-drop>Передумал</button>
    <button class="btn ghost" type="button" data-action="close">Закрыть</button>`);
  const move = (d) => {
    const list = wishes();
    const i = list.indexOf(w);
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    ap().manualOrder = true;
    save();
    closeSheet();
    render();
  };
  root.querySelector('[data-up]').addEventListener('click', () => move(-1));
  root.querySelector('[data-down]').addEventListener('click', () => move(1));
  root.querySelector('[data-kind]').addEventListener('click', () => { w.kind = w.kind === 'invest' ? 'joy' : 'invest'; sortWishes(); save(); closeSheet(); render(); });
  root.querySelector('[data-drop]').addEventListener('click', () => {
    ap().wishes = wishes().filter((x) => x !== w);
    const { state } = session;
    const xp = state.settings.xp.chore;
    state.log.push({ id: uid(), questId: null, title: `Передумал: ${w.title}`, type: 'chore', xp, stats: {}, period: null, at: Date.now(), source: 'wish' });
    feedPart('warrior', 15, 'Передумал покупать');
    save();
    closeSheet();
    render();
    toast({ title: 'Передумал', main: `+${xp} XP`, sub: `Не потрачено ${money(w.price)} — копилка пойдёт на следующую`, kind: 'up', ms: 4500 });
  });
  const buy = root.querySelector('[data-buy]');
  if (buy) buy.addEventListener('click', () => {
    const cat = guessCategory(w.title) || 'shopping';
    fin().expenses.push({ id: uid(), at: Date.now(), amount: w.price, text: w.title, cat, cls: w.kind === 'invest' ? 'invest' : 'want', planned: true, fixed: false, overLimit: false, asked: { cat: true, planned: true }, wallet: 'wish' });
    w.boughtAt = Date.now();
    save();
    closeSheet();
    render();
    Sound.play('achievement');
    toast({ title: 'Хотелка сбылась', main: w.title, sub: 'Из копилки — дневной лимит не тронут', kind: 'up', ms: 5000 });
  });
}

function openWishAll() {
  const alloc = wishAlloc();
  openSheet('Хотелки', `<div class="ap-list">${wishes().filter((w) => !w.boughtAt).map((w) => {
    const got = alloc.get(w.id) || 0;
    return `<button class="ap-wish${wishLocked(w) ? ' locked' : ''}" type="button" data-wish="${w.id}"><span class="fin-head"><span>${wishLocked(w) ? '🔒' : w.kind === 'invest' ? '📈' : '✨'} ${esc(w.title)}</span><span>${money(w.price)}</span></span><small>${money(got)} · ${wishEta(w, alloc)}</small></button>`;
  }).join('')}</div><button class="btn ghost" type="button" data-action="close">Закрыть</button>`).addEventListener('click', (e) => {
    const b = e.target.closest('[data-wish]');
    if (b) { closeSheet(); openWish(b.dataset.wish); }
  });
}

/* ---------- «Можно купить?» ---------- */

function canBuyVerdict(price, what) {
  const lim = limitsNow();
  if (!lim) return { v: 'wait', title: 'Пока не знаю', text: 'Впиши поступление или текущий остаток — тогда посчитаю.' };
  const now = new Date();
  const daysLeft = daysInMonth(now) - now.getDate() + 1;
  const todayLeft = lim.today.limit - lim.today.spent;
  const free = lim.free;
  const pool = Math.max(0, wishPool());
  const cat = guessCategory(what || '');
  const leak = cat && typeof spendPatterns === 'function' && spendPatterns().find((p) => p.cat === cat);
  const note = leak ? ` Кстати, «${FIN_CAT[cat].name}» — твоё слабое место (~${money(leak.month)}/мес).` : '';
  if (price <= todayLeft) return { v: 'yes', title: 'Да', text: `Влезает в сегодняшний лимит, останется ${money(todayLeft - price)}.${note}` };
  if (price <= pool) return { v: 'yes', title: 'Да — из копилки хотелок', text: `В копилке ${money(pool)}. Очередь хотелок сдвинется.${note}`, wallet: 'wish' };
  if (price <= free) {
    const newDay = Math.max(0, Math.round((free - price) / daysLeft));
    const days = Math.ceil(price / Math.max(1, lim.today.limit));
    if (price <= todayLeft + lim.today.limit * 2) return { v: 'maybe', title: 'Можно, но осторожно', text: `Лимит на остаток месяца станет ~${money(newDay)} в день вместо ${money(lim.today.limit)}.${note}` };
    return { v: 'wait', title: 'Лучше подожди', text: `Это съест ~${days} ${plural(days, ['день', 'дня', 'дней'])} лимита: дальше ~${money(newDay)} в день. Положи в хотелки — накопишь без ущерба.${note}` };
  }
  return { v: 'no', title: 'Нет', text: `Свободных денег до конца месяца ${money(Math.max(0, free))} — не хватает ${money(price - Math.max(0, free))}, и обязательное под угрозой.${note}` };
}

function openCanBuy(prefill = {}) {
  const root = openSheet('Можно купить?', `
    <label class="field"><span>Что</span><input name="what" type="text" maxlength="60" autocomplete="off" value="${esc(prefill.what || '')}" placeholder="Например: кроссовки"></label>
    <label class="field"><span>Сколько, ₸</span><input name="price" type="number" inputmode="numeric" min="1" step="100" value="${prefill.price || ''}"></label>
    <div data-out></div>
    <button class="btn" type="button" data-ask>Спросить</button>
    <button class="btn ghost" type="button" data-action="close">Закрыть</button>`);
  const out = root.querySelector('[data-out]');
  const ask = () => {
    const what = root.querySelector('input[name="what"]').value.trim();
    const price = Math.round(Number(root.querySelector('input[name="price"]').value));
    if (!(price > 0)) return;
    const r = canBuyVerdict(price, what);
    const icon = { yes: '✅', maybe: '🟡', wait: '⏳', no: '❌' }[r.v];
    out.innerHTML = `<div class="can-verdict v-${r.v}"><b>${icon} ${r.title}</b><p>${esc(r.text)}</p></div>
      ${r.v !== 'yes' ? `<button class="btn" type="button" data-towish>В хотелки${what ? ` — ${esc(what)}` : ''}</button>` : ''}
      <button class="btn ghost" type="button" data-bought>${r.v === 'yes' ? 'Покупаю — записать' : 'Всё равно куплю — записать'}</button>
      <button class="btn ghost" type="button" data-skip>Не покупаю</button>`;
    const tw = out.querySelector('[data-towish]');
    if (tw) tw.addEventListener('click', () => { closeSheet(); openWishAdd({ title: what, price }); });
    out.querySelector('[data-bought]').addEventListener('click', () => {
      closeSheet();
      if (r.wallet === 'wish') {
        const cat = guessCategory(what) || 'shopping';
        fin().expenses.push({ id: uid(), at: Date.now(), amount: price, text: what || 'Покупка', cat, cls: 'want', planned: true, fixed: false, overLimit: false, asked: { cat: true, planned: true }, wallet: 'wish' });
        save();
        render();
        return toast({ title: 'Из копилки', main: `−${money(price)}`, sub: 'Дневной лимит не тронут', kind: 'up', ms: 4000 });
      }
      addExpense(`${what || 'покупка'} ${price}`);
    });
    out.querySelector('[data-skip]').addEventListener('click', () => {
      const { state } = session;
      if (r.v !== 'yes') {
        const xp = state.settings.xp.chore;
        state.log.push({ id: uid(), questId: null, title: `Не купил: ${what || money(price)}`, type: 'chore', xp, stats: {}, period: null, at: Date.now(), source: 'wish' });
        feedPart('warrior', 10, 'Удержался от покупки');
        save();
        toast({ title: 'Удержался', main: `+${xp} XP`, sub: `${money(price)} остались с тобой`, kind: 'up', ms: 4000 });
      }
      closeSheet();
      render();
    });
  };
  root.querySelector('[data-ask]').addEventListener('click', ask);
  if (prefill.price) ask();
}

/* ---------- План вместо борьбы ---------- */

function allowFor(cat) {
  return ap() && ap().allow ? ap().allow[cat] : null;
}

function makeAllow(cat) {
  if (!fin().ap) fin().ap = { on: false, start: 0, wishes: [], allow: {}, mode: 'stab' };
  const v = Math.max(1000, Math.round((weeklyUsual(cat) * 0.8) / 500) * 500);
  ap().allow[cat] = v;
  save();
  closeSheet();
  render();
  toast({ title: 'План вместо борьбы', main: `${FIN_CAT[cat].name}: до ${money(v)} в неделю`, sub: 'В пределах плана — это не слив, а честная часть жизни', kind: 'up', ms: 5000 });
}

/** В пределах недельного плана хотелка — не спорная. */
function withinAllow(e) {
  const v = allowFor(e.cat);
  if (!v || e.cls !== 'want') return false;
  const now = new Date(e.at);
  const weekFrom = dayStart(addDays(now, -((now.getDay() + 6) % 7)));
  const spent = fin().expenses.filter((x) => x.cat === e.cat && !x.fixed && !x.wallet && x.at >= weekFrom && x.at <= e.at).reduce((a, x) => a + x.amount, 0);
  return spent <= v;
}

/* ---------- Поступление: раскладка и подсказка ---------- */

function splitToast(inc) {
  const s = inc.split;
  const parts = [];
  const sv = Math.round((inc.amount * s.save) / 100);
  const ws = Math.round((inc.amount * s.wish) / 100);
  const jy = Math.round((inc.amount * s.joy) / 100);
  if (sv) parts.push(`🛡 ${money(sv)}`);
  if (ws) parts.push(`🎁 ${money(ws)}`);
  if (jy) parts.push(`✨ ${money(jy)}`);
  parts.push(`на жизнь ${money(netOf(inc))}`);
  toast({ title: '[Автопилот] Разложено', main: `+${money(inc.amount)}`, sub: `${parts.join(' · ')}${sv + ws >= 1000 ? ` — переведи ${money(sv + ws)} в копилку банка, чтобы не потратить случайно` : ''}`, kind: 'up', ms: 8000 });
}

/* ---------- Разбор недели: деньги ---------- */

function weekMoneyHtml() {
  const f = fin();
  const from = Date.now() - 7 * DAY_MS;
  const inc = f.incomes.filter((i) => i.at >= from && !i.adjust);
  const got = inc.reduce((a, i) => a + i.amount, 0);
  const spent = f.expenses.reduce((a, e) => a + (!e.fixed && e.at >= from ? e.amount : 0), 0);
  if (!got && !spent && !f.ap.on) return '';
  const toCushion = inc.reduce((a, i) => a + (i.split ? part(i, 'save') : 0), 0);
  const toWish = inc.reduce((a, i) => a + part(i, 'wish'), 0);
  const next = f.ap.on && wishes().find((w) => !w.boughtAt && !wishLocked(w));
  const alloc = next && wishAlloc();
  return `<div class="pilot-lbl">Деньги за неделю</div>
      <div class="stat-row"><span>Пришло / ушло</span><span class="mono">${money(got)} / ${money(spent)}</span></div>
      ${f.ap.on ? `<div class="stat-row"><span>🛡 В подушку · 🎁 в хотелки</span><span class="mono">${money(Math.round(toCushion))} · ${money(Math.round(toWish))}</span></div>
      <div class="stat-row"><span>Подушка всего</span><span class="mono">${money(cushion())}</span></div>
      ${next ? `<div class="stat-row"><span>Ближайшая хотелка</span><span>${esc(next.title)} · ${Math.round(((alloc.get(next.id) || 0) / next.price) * 100)}%</span></div>` : ''}` : ''}`;
}
