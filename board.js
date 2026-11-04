/*
 * Доски — бесконечное поле для идей внутри «Системы».
 * Стикеры, текст, фигуры, рамки, картинки и стрелки-связи. Стикер одним нажатием становится квестом:
 * квест попадает в план пилота, а когда он закрыт — стикер на доске получает галочку.
 * Доску можно привязать к цели (квесты с неё станут её этапами) и к личности (время на доске её заряжает).
 * Данные — в том же зашифрованном хранилище, что и всё остальное. Подключается после основного скрипта
 * и пользуется его функциями: session, save, openSheet, esc, uid, completeQuest и т. д.
 */

const BD_COLORS = ['#ffe66b', '#ff9bd2', '#66d0ff', '#6dffc0', '#b99bff', '#ff9f6b'];
const BD_KINDS = {
  note: { name: 'Стикер', w: 160, h: 120 },
  text: { name: 'Текст', w: 220, h: 50 },
  rect: { name: 'Фигура', w: 180, h: 110 },
  ellipse: { name: 'Круг', w: 150, h: 150 },
  frame: { name: 'Рамка', w: 520, h: 380 },
  image: { name: 'Картинка', w: 240, h: 180 },
};
const BD_TEMPLATES = {
  empty: { name: 'Пустая', hint: 'Чистое поле', part: null, build: () => [] },
  content: {
    name: 'Контент-план',
    hint: 'Идеи → съёмка → монтаж → опубликовано',
    part: 'smm',
    build: () => ['Идеи', 'Съёмка', 'Монтаж', 'Опубликовано'].map((t, i) => ({ kind: 'frame', x: i * 300, y: 0, w: 280, h: 520, text: t, color: BD_COLORS[[2, 0, 4, 3][i]] })),
  },
  goal: {
    name: 'Цель',
    hint: 'Цель в центре, вокруг шаги, ресурсы и риски',
    part: 'warrior',
    build: () => [
      { kind: 'ellipse', x: 230, y: 0, w: 220, h: 140, text: 'Цель', color: BD_COLORS[5] },
      { kind: 'frame', x: 0, y: 200, w: 300, h: 360, text: 'Шаги', color: BD_COLORS[3] },
      { kind: 'frame', x: 330, y: 200, w: 300, h: 360, text: 'Ресурсы', color: BD_COLORS[2] },
      { kind: 'frame', x: 660, y: 200, w: 300, h: 360, text: 'Риски', color: BD_COLORS[0] },
    ],
  },
  dream: {
    name: 'Мечта',
    hint: 'Образ будущего: через год, через 5 лет, как живу, что чувствую',
    part: 'dreamer',
    build: () => ['Через год', 'Через 5 лет', 'Как я живу', 'Что чувствую'].map((t, i) => ({ kind: 'frame', x: (i % 2) * 340, y: Math.floor(i / 2) * 340, w: 320, h: 320, text: t, color: BD_COLORS[[4, 1, 2, 3][i]] })),
  },
  mind: {
    name: 'Карта мыслей',
    hint: 'Тема в центре, мысли — вокруг, связи — стрелками',
    part: 'deep',
    build: () => [{ kind: 'ellipse', x: 0, y: 0, w: 200, h: 130, text: 'Тема', color: BD_COLORS[4] }],
  },
};

const bd = { board: null, root: null, stage: null, world: null, svg: null, bar: null, sel: null, linkFrom: null, history: [], ptrs: new Map(), gesture: null, pinch: null, lastTap: null, saveTimer: 0, openedAt: 0, press: 0 };
const boards = () => session.state.boards;
const bdItem = (id) => bd.board.items.find((x) => x.id === id);

/* ---------- Список досок (вкладка) ---------- */

function boardsView() {
  const list = boards().slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const done = completionIndex();
  const vault = (localStorage.getItem('system.vault.v1') || '').length;
  const cards = list.map((b) => {
    const quests = b.items.filter((x) => x.questId && findQuest(x.questId));
    const closed = quests.filter((x) => done.has(x.questId)).length;
    const goal = b.goalId && findGoal(b.goalId);
    return `<button class="panel bd-card" type="button" data-board="${b.id}">
        ${boardThumb(b)}
        <span class="bd-card-t"><b>${esc(b.title)}</b>
          <small>${b.items.length} ${plural(b.items.length, ['элемент', 'элемента', 'элементов'])}${quests.length ? ` · квесты ${closed}/${quests.length}` : ''}${goal ? ` · 🎯 ${esc(goal.title)}` : ''}${b.part ? ` · ${esc(PART[b.part].short)}` : ''}</small></span>
      </button>`;
  }).join('');
  return `<button class="btn add" type="button" data-action="board-new">+ Новая доска</button>
    <div class="section-h">Доски <span class="count">${list.length}</span></div>
    ${cards || '<div class="panel empty"><b>Досок пока нет</b>Доска — бесконечное поле для идей, планов и мечт. Стикер с доски одним нажатием становится квестом.</div>'}
    <p class="hint">Хранилище: ${vault < 1048576 ? `${Math.max(1, Math.round(vault / 1024))} КБ` : `${(vault / 1048576).toFixed(1)} МБ`} из ~5 МБ. Картинки сжимаются, но занимают больше всего места.</p>`;
}

/** Миниатюра: прямоугольники элементов, вписанные в карточку. */
function boardThumb(b) {
  if (!b.items.length) return '<svg class="bd-thumb" viewBox="0 0 100 60"></svg>';
  const box = bdBounds(b.items);
  const pad = 20;
  const vb = `${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}`;
  const shapes = b.items.slice().sort((a, c) => (a.kind === 'frame' ? -1 : 0) - (c.kind === 'frame' ? -1 : 0)).map((x) => {
    if (x.kind === 'ellipse') return `<ellipse cx="${x.x + x.w / 2}" cy="${x.y + x.h / 2}" rx="${x.w / 2}" ry="${x.h / 2}" fill="none" stroke="${x.color}" stroke-width="6"/>`;
    if (x.kind === 'frame') return `<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="none" stroke="${x.color}" stroke-width="5" stroke-dasharray="14 10" rx="10"/>`;
    if (x.kind === 'text') return `<rect x="${x.x}" y="${x.y + x.h / 3}" width="${x.w}" height="${x.h / 3}" fill="#a9e6ff" opacity=".5" rx="4"/>`;
    if (x.kind === 'image') return `<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="#56738a" rx="6"/>`;
    if (x.kind === 'rect') return `<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="none" stroke="${x.color}" stroke-width="6" rx="10"/>`;
    return `<rect x="${x.x}" y="${x.y}" width="${x.w}" height="${x.h}" fill="${x.color}" rx="6"/>`;
  }).join('');
  return `<svg class="bd-thumb" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${shapes}</svg>`;
}

function bdBounds(items) {
  const xs = items.flatMap((x) => [x.x, x.x + x.w]);
  const ys = items.flatMap((x) => [x.y, x.y + x.h]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function newBoardSheet() {
  const root = openSheet('Новая доска', `
    <label class="field"><span>Название</span><input name="title" type="text" maxlength="60" autocomplete="off" placeholder="Например: Блог"></label>
    <div class="field"><span>Шаблон</span>
      <div class="q-options">${Object.entries(BD_TEMPLATES).map(([id, t]) => `<button class="btn${id === 'empty' ? '' : ' ghost'}" type="button" data-tpl="${id}"><b>${t.name}</b><small style="display:block;font-weight:400;letter-spacing:0;text-transform:none;opacity:.75">${t.hint}</small></button>`).join('')}</div>
    </div>
    <button class="btn ghost" type="button" data-action="close">Отмена</button>`);
  root.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => {
    const t = BD_TEMPLATES[b.dataset.tpl];
    const title = root.querySelector('input').value.trim() || (b.dataset.tpl === 'empty' ? 'Доска' : t.name);
    const now = Date.now();
    const board = {
      id: uid(),
      title,
      createdAt: now,
      updatedAt: now,
      part: t.part,
      goalId: null,
      view: null,
      items: t.build().map((x) => ({ id: uid(), color: BD_COLORS[0], text: '', ...x })),
      links: [],
    };
    boards().push(board);
    save();
    closeSheet();
    openBoard(board.id);
  }));
}

/* ---------- Редактор ---------- */

function openBoard(id) {
  const board = boards().find((b) => b.id === id);
  if (!board) return;
  boardClose(true);
  bd.board = board;
  bd.sel = null;
  bd.linkFrom = null;
  bd.history = [];
  bd.openedAt = Date.now();
  const root = document.createElement('div');
  root.className = 'bd-screen';
  root.innerHTML = `
    <header class="bd-head">
      <button type="button" data-bd="back" aria-label="Назад">‹</button>
      <button type="button" class="bd-title" data-bd="settings"></button>
      <button type="button" data-bd="fit" aria-label="Показать всё">⤢</button>
      <button type="button" data-bd="undo" aria-label="Отменить">↶</button>
    </header>
    <div class="bd-stage" data-stage>
      <div class="bd-world" data-world><svg class="bd-links" data-links aria-hidden="true"><defs>
        <marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#a9e6ff"/></marker></defs><g></g></svg></div>
      <p class="bd-tip" data-tip></p>
    </div>
    <div class="bd-selbar" data-selbar hidden></div>
    <nav class="bd-tools">
      ${['note', 'text', 'rect', 'ellipse', 'frame'].map((k) => `<button type="button" data-add="${k}"><i class="bd-ic bd-ic-${k}"></i><span>${BD_KINDS[k].name}</span></button>`).join('')}
      <label class="bd-img"><input type="file" accept="image/*" hidden data-file><i class="bd-ic bd-ic-image"></i><span>Фото</span></label>
    </nav>`;
  document.body.append(root);
  document.documentElement.classList.add('noscroll');
  bd.root = root;
  bd.stage = root.querySelector('[data-stage]');
  bd.world = root.querySelector('[data-world]');
  bd.svg = root.querySelector('[data-links] g');
  bd.bar = root.querySelector('[data-selbar]');
  root.querySelector('.bd-title').textContent = board.title;
  if (!board.view) bdFit(); else bdApplyView();
  bdRenderAll();
  bdTip(board.items.length ? '' : 'Двойное касание по пустому месту — новый стикер');

  root.querySelector('.bd-head').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bd]');
    if (!b) return;
    if (b.dataset.bd === 'back') boardClose();
    if (b.dataset.bd === 'fit') bdFit();
    if (b.dataset.bd === 'undo') bdUndo();
    if (b.dataset.bd === 'settings') bdSettings();
  });
  root.querySelector('.bd-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const r = bd.stage.getBoundingClientRect();
    const c = bdToWorld(r.left + r.width / 2, r.top + r.height / 2);
    const k = BD_KINDS[b.dataset.add];
    const it = bdAdd({ kind: b.dataset.add, x: c.x - k.w / 2 + (Math.random() - 0.5) * 40, y: c.y - k.h / 2 + (Math.random() - 0.5) * 40 });
    if (it.kind !== 'frame') bdEditText(it);
  });
  root.querySelector('[data-file]').addEventListener('change', bdImage);
  bd.bar.addEventListener('click', bdBarClick);
  const st = bd.stage;
  st.addEventListener('pointerdown', bdDown);
  st.addEventListener('pointermove', bdMove);
  st.addEventListener('pointerup', bdUp);
  st.addEventListener('pointercancel', bdUp);
  st.addEventListener('wheel', bdWheel, { passive: false });
  addEventListener('keydown', bdKey);
}

/** Закрыть доску. silent — при блокировке: только сохранить, без зарядки и перерисовки. */
function boardClose(silent) {
  if (!bd.root) return;
  clearTimeout(bd.saveTimer);
  const board = bd.board;
  board.updatedAt = Date.now();
  removeEventListener('keydown', bdKey);
  bd.root.remove();
  bd.root = null;
  bd.board = null;
  document.documentElement.classList.remove('noscroll');
  if (!session) return;
  const minutes = Math.round((Date.now() - bd.openedAt) / 60000);
  if (!silent && board.part && minutes >= 3) {
    const pts = Math.min(40, minutes * 2);
    feedPart(board.part, pts, `Доска «${board.title}»`);
    toast({ title: PART[board.part].name, main: `+ заряд: ${minutes} мин на доске`, sub: board.title, kind: 'up', ms: 3500 });
  }
  save();
  if (!silent) render();
}

function bdApplyView() {
  const v = bd.board.view;
  bd.world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
  bd.stage.style.setProperty('--z', v.z);
  // сетка точек едет и масштабируется вместе с полем
  bd.stage.style.backgroundPosition = `${v.x}px ${v.y}px`;
  bd.stage.style.backgroundSize = `${24 * v.z}px ${24 * v.z}px`;
}

function bdToWorld(cx, cy) {
  const r = bd.stage.getBoundingClientRect();
  const v = bd.board.view;
  return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
}

function bdFit() {
  const r = bd.stage.getBoundingClientRect();
  const items = bd.board.items;
  if (!items.length) {
    bd.board.view = { x: r.width / 2, y: r.height / 2, z: 1 };
  } else {
    const b = bdBounds(items);
    const z = Math.max(0.15, Math.min(1.2, (r.width - 40) / b.w, (r.height - 40) / b.h));
    bd.board.view = { x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z, z };
  }
  bdApplyView();
}

function bdTip(text) {
  const el = bd.root && bd.root.querySelector('[data-tip]');
  if (el) {
    el.textContent = text;
    el.hidden = !text;
  }
}

/* ---------- Отрисовка ---------- */

function bdRenderAll() {
  bd.world.querySelectorAll('.bd-item').forEach((el) => el.remove());
  const frames = bd.board.items.filter((x) => x.kind === 'frame');
  const rest = bd.board.items.filter((x) => x.kind !== 'frame');
  for (const it of frames.concat(rest)) bd.world.append(bdEl(it));
  bdLinks();
  bdSelBar();
}

function bdEl(it) {
  const el = document.createElement('div');
  el.className = `bd-item k-${it.kind}`;
  el.dataset.id = it.id;
  bdPlace(el, it);
  bdFill(el, it);
  return el;
}

function bdPlace(el, it) {
  el.style.left = it.x + 'px';
  el.style.top = it.y + 'px';
  el.style.width = it.w + 'px';
  el.style.height = it.h + 'px';
  el.style.setProperty('--c', it.color);
}

function bdFill(el, it) {
  const q = it.questId && findQuest(it.questId);
  const done = q && completionIndex().has(q.id);
  el.classList.toggle('sel', bd.sel === it.id);
  el.classList.toggle('link-from', bd.linkFrom === it.id);
  el.classList.toggle('q-done', !!done);
  const badge = q ? `<span class="bd-q">${done ? '✓ сделано' : `${LOADS[questLoad(q)].icon} квест`}</span>` : '';
  if (it.kind === 'image') el.innerHTML = `<img src="${it.src}" alt="" draggable="false">${badge}`;
  else if (it.kind === 'frame') el.innerHTML = `<span class="bd-frame-t">${esc(it.text || 'Рамка')}</span>`;
  else el.innerHTML = `<div class="bd-txt">${esc(it.text || '')}</div>${badge}`;
  if (bd.sel === it.id) el.insertAdjacentHTML('beforeend', '<i class="bd-handle" data-handle></i>');
}

function bdRefresh(it) {
  const el = bd.world.querySelector(`.bd-item[data-id="${it.id}"]`);
  if (!el) return;
  bdPlace(el, it);
  bdFill(el, it);
}

/** Стрелка от края одного элемента к краю другого. */
function bdLinks() {
  const edge = (a, tx, ty) => {
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    if (a.kind === 'ellipse') {
      const t = 1 / Math.sqrt((dx * dx) / ((a.w / 2) ** 2) + (dy * dy) / ((a.h / 2) ** 2));
      return [cx + dx * t, cy + dy * t];
    }
    const t = Math.min(Math.abs(a.w / 2 / (dx || 1e-9)), Math.abs(a.h / 2 / (dy || 1e-9)));
    return [cx + dx * t, cy + dy * t];
  };
  bd.board.links = bd.board.links.filter((l) => bdItem(l.from) && bdItem(l.to));
  bd.svg.innerHTML = bd.board.links.map((l) => {
    const a = bdItem(l.from);
    const b = bdItem(l.to);
    const [x1, y1] = edge(a, b.x + b.w / 2, b.y + b.h / 2);
    const [x2, y2] = edge(b, a.x + a.w / 2, a.y + a.h / 2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#bd-arrow)"/>`;
  }).join('');
}

/* ---------- Изменения, отмена, сохранение ---------- */

function bdSnap() {
  bd.history.push(JSON.stringify({ items: bd.board.items, links: bd.board.links }));
  if (bd.history.length > 40) bd.history.shift();
}

function bdUndo() {
  const prev = bd.history.pop();
  if (!prev) return toast({ title: 'Доска', main: 'Отменять нечего', ms: 1500 });
  Object.assign(bd.board, JSON.parse(prev));
  if (bd.sel && !bdItem(bd.sel)) bd.sel = null;
  bdRenderAll();
  bdSave();
}

function bdSave() {
  bd.board.updatedAt = Date.now();
  clearTimeout(bd.saveTimer);
  bd.saveTimer = setTimeout(() => save(), 700);
}

function bdAdd(data) {
  bdSnap();
  const k = BD_KINDS[data.kind];
  const color = data.kind === 'text' ? '#a9e6ff' : BD_COLORS[bd.board.items.length % BD_COLORS.length];
  const it = { id: uid(), w: k.w, h: k.h, text: data.kind === 'frame' ? 'Рамка' : '', color, ...data };
  bd.board.items.push(it);
  bd.sel = it.id;
  bdRenderAll();
  bdSave();
  bdTip('');
  haptic(10);
  return it;
}

function bdDelete(it) {
  bdSnap();
  bd.board.items = bd.board.items.filter((x) => x.id !== it.id);
  bd.board.links = bd.board.links.filter((l) => l.from !== it.id && l.to !== it.id);
  bd.sel = null;
  bdRenderAll();
  bdSave();
}

function bdSelect(id) {
  const prev = bd.sel;
  bd.sel = id;
  if (prev && bdItem(prev)) bdRefresh(bdItem(prev));
  if (id) bdRefresh(bdItem(id));
  bdSelBar();
}

/* ---------- Панель выбранного элемента ---------- */

function bdSelBar() {
  const it = bd.sel && bdItem(bd.sel);
  bd.bar.hidden = !it;
  if (!it) return;
  const q = it.questId && findQuest(it.questId);
  const colors = it.kind === 'image' ? '' : BD_COLORS.map((c) => `<button type="button" class="sw${it.color === c ? ' on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Цвет"></button>`).join('');
  bd.bar.innerHTML = `${colors}
    ${it.kind === 'image' ? '' : '<button type="button" data-act="edit">Текст</button>'}
    <button type="button" data-act="link">Связь</button>
    ${it.kind === 'frame' || it.kind === 'image' ? '' : `<button type="button" data-act="quest">${q ? 'Квест ›' : 'В квест'}</button>`}
    <button type="button" data-act="copy">Копия</button>
    <button type="button" data-act="del" class="danger-text">Удалить</button>`;
}

function bdBarClick(e) {
  const it = bd.sel && bdItem(bd.sel);
  if (!it) return;
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.color) {
    bdSnap();
    it.color = b.dataset.color;
    bdRefresh(it);
    bdSelBar();
    return bdSave();
  }
  const act = b.dataset.act;
  if (act === 'edit') bdEditText(it);
  if (act === 'del') bdDelete(it);
  if (act === 'copy') {
    const { id, questId, ...rest } = it;
    bdAdd({ ...rest, x: it.x + 30, y: it.y + 30 });
  }
  if (act === 'link') {
    bd.linkFrom = it.id;
    bdRefresh(it);
    bdTip('Нажми на элемент, к которому провести стрелку');
  }
  if (act === 'quest') bdQuest(it);
}

/** Текст элемента — в окне: на айфоне клавиатура надёжно открывается только по нажатию на поле. */
function bdEditText(it) {
  const root = openSheet(it.kind === 'frame' ? 'Название рамки' : BD_KINDS[it.kind].name, `
    <label class="field"><span>Текст</span><textarea name="t" rows="${it.kind === 'frame' ? 1 : 4}" maxlength="600" placeholder="${it.kind === 'note' ? 'Идея, задача, мысль…' : ''}">${esc(it.text || '')}</textarea></label>
    <button class="btn" type="button" data-ok>Готово</button>
    <button class="btn ghost" type="button" data-action="close">Отмена</button>`);
  const ta = root.querySelector('textarea');
  ta.focus();
  root.querySelector('[data-ok]').addEventListener('click', () => {
    const v = ta.value.trim();
    if (v !== (it.text || '')) {
      bdSnap();
      it.text = v;
      if (it.kind === 'note' || it.kind === 'rect' || it.kind === 'ellipse' || it.kind === 'text') bdGrow(it);
      bdRefresh(it);
      bdLinks();
      bdSave();
      if (it.questId) {
        const q = findQuest(it.questId);
        if (q && v) {
          q.title = v.split('\n')[0].slice(0, 120);
          save();
        }
      }
    }
    closeSheet();
  });
}

/** Длинный текст — стикер растёт вниз, чтобы всё было видно. */
function bdGrow(it) {
  const lines = (it.text || '').split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / Math.max(8, it.w / 9))), 0);
  const need = Math.max(BD_KINDS[it.kind].h, lines * 19 + 30);
  if (need > it.h) it.h = Math.min(600, need);
}

/** Стикер → квест: попадает в план пилота, к цели доски и заряжает её личность. */
function bdQuest(it) {
  const existing = it.questId && findQuest(it.questId);
  if (existing) return openQuestEditor(existing);
  const text = (it.text || '').trim();
  if (!text) return toast({ title: 'Доска', main: 'Сначала напиши текст', sub: 'Он станет названием квеста', ms: 2500 });
  const { state } = session;
  const [title, ...rest] = text.split('\n');
  const q = {
    id: uid(),
    createdAt: Date.now(),
    title: title.slice(0, 120),
    note: [rest.join(' ').trim(), `Доска «${bd.board.title}»`].filter(Boolean).join(' · '),
    type: 'normal',
    stats: state.stats.length ? [state.stats[0].id] : [],
    repeat: 'none',
    goalId: bd.board.goalId || undefined,
  };
  if (bd.board.part && !questParts(q).includes(bd.board.part)) q.parts = questParts(q).concat(bd.board.part);
  state.quests.push(q);
  it.questId = q.id;
  save();
  bdRefresh(it);
  bdSelBar();
  Sound.play('quest');
  toast({ title: 'Новый квест', main: q.title, sub: 'Он в плане пилота. Поправь вес и характеристики', kind: 'up', ms: 3500 });
  openQuestEditor(q);
}

function bdSettings() {
  const b = bd.board;
  const goals = session.state.goals.filter((g) => !g.doneAt);
  const root = openSheet('Доска', `
    <label class="field"><span>Название</span><input name="title" type="text" maxlength="60" value="${esc(b.title)}"></label>
    <div class="field"><span>Цель — квесты с доски станут её этапами</span>
      <div class="choices"><label class="choice"><input type="radio" name="goal" value=""${!b.goalId ? ' checked' : ''}><span>Без цели</span></label>
      ${goals.map((g) => `<label class="choice"><input type="radio" name="goal" value="${g.id}"${b.goalId === g.id ? ' checked' : ''}><span>${esc(g.title)}</span></label>`).join('')}</div>
    </div>
    <div class="field"><span>Личность — время на доске её заряжает</span>
      <div class="choices"><label class="choice"><input type="radio" name="part" value=""${!b.part ? ' checked' : ''}><span>Никто</span></label>
      ${PARTS.map((x) => `<label class="choice"><input type="radio" name="part" value="${x.id}"${b.part === x.id ? ' checked' : ''}><span>${esc(x.short)}</span></label>`).join('')}</div>
    </div>
    <button class="btn" type="button" data-ok>Сохранить</button>
    <button class="btn ghost danger-text" type="button" data-del>Удалить доску</button>
    <button class="btn ghost" type="button" data-action="close">Закрыть</button>`);
  root.querySelector('[data-ok]').addEventListener('click', () => {
    b.title = root.querySelector('input[name="title"]').value.trim() || b.title;
    b.goalId = root.querySelector('input[name="goal"]:checked').value || null;
    b.part = root.querySelector('input[name="part"]:checked').value || null;
    bd.root.querySelector('.bd-title').textContent = b.title;
    save();
    closeSheet();
  });
  const del = root.querySelector('[data-del]');
  del.addEventListener('click', () => confirmPress(del, 'Точно удалить доску? Нажми ещё раз', () => {
    // квесты, созданные с доски, остаются
    session.state.boards = boards().filter((x) => x.id !== b.id);
    closeSheet();
    boardClose(true);
    render();
  }));
}

/** Фото: сжимаем до 900 px и JPEG, чтобы не забить хранилище. */
function bdImage(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let src = c.toDataURL('image/jpeg', 0.72);
      if (src.length > 350000) src = c.toDataURL('image/jpeg', 0.5);
      const vault = (localStorage.getItem('system.vault.v1') || '').length;
      if (vault + src.length * 1.4 > 4.6e6) return toast({ title: 'Доска', main: 'Хранилище почти заполнено', sub: 'Удали старые картинки или доски', kind: 'minus', ms: 4000 });
      const r = bd.stage.getBoundingClientRect();
      const ctr = bdToWorld(r.left + r.width / 2, r.top + r.height / 2);
      const w = 260;
      const h = Math.round((w * c.height) / c.width);
      bdAdd({ kind: 'image', src, x: ctr.x - w / 2, y: ctr.y - h / 2, w, h });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Жесты: перемещение, масштаб, перетаскивание ---------- */

function bdDown(e) {
  if (e.button > 0) return;
  try { bd.stage.setPointerCapture(e.pointerId); } catch { /* синтетический или уже отпущенный указатель */ }
  bd.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  clearTimeout(bd.press);
  if (bd.ptrs.size === 2) {
    const [a, b] = [...bd.ptrs.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    bd.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: bd.board.view.z, w: bdToWorld(mid.x, mid.y) };
    bd.gesture = null;
    return;
  }
  if (bd.ptrs.size > 2) return;
  const el = e.target.closest('.bd-item');
  const it = el && bdItem(el.dataset.id);
  const v = bd.board.view;
  if (it && e.target.closest('[data-handle]')) {
    bd.gesture = { type: 'resize', it, sx: e.clientX, sy: e.clientY, w0: it.w, h0: it.h, moved: false };
    return;
  }
  bd.gesture = it
    ? { type: 'item', it, sx: e.clientX, sy: e.clientY, x0: it.x, y0: it.y, moved: false, kids: it.kind === 'frame' ? bdInside(it) : [] }
    : { type: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false };
  if (it) {
    bd.press = setTimeout(() => {
      if (bd.gesture && !bd.gesture.moved) {
        haptic(15);
        bdSelect(it.id);
        if (it.kind !== 'image') bdEditText(it);
        bd.gesture = null;
      }
    }, 600);
  }
}

/** Элементы, лежащие внутри рамки, едут вместе с ней. */
function bdInside(fr) {
  return bd.board.items
    .filter((x) => x !== fr && x.kind !== 'frame' && x.x + x.w / 2 > fr.x && x.x + x.w / 2 < fr.x + fr.w && x.y + x.h / 2 > fr.y && x.y + x.h / 2 < fr.y + fr.h)
    .map((x) => ({ x, x0: x.x, y0: x.y }));
}

function bdMove(e) {
  if (!bd.ptrs.has(e.pointerId)) return;
  bd.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const v = bd.board.view;
  if (bd.pinch && bd.ptrs.size >= 2) {
    const [a, b] = [...bd.ptrs.values()];
    const z = Math.max(0.15, Math.min(3, (bd.pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / bd.pinch.d0));
    const r = bd.stage.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
    bd.board.view = { x: mid.x - bd.pinch.w.x * z, y: mid.y - bd.pinch.w.y * z, z };
    return bdApplyView();
  }
  const g = bd.gesture;
  if (!g) return;
  const dx = e.clientX - g.sx;
  const dy = e.clientY - g.sy;
  if (!g.moved && Math.hypot(dx, dy) < 6) return;
  if (!g.moved) {
    g.moved = true;
    clearTimeout(bd.press);
    if (g.type !== 'pan') bdSnap();
  }
  if (g.type === 'pan') {
    v.x = g.vx + dx;
    v.y = g.vy + dy;
    return bdApplyView();
  }
  if (g.type === 'resize') {
    g.it.w = Math.max(60, g.w0 + dx / v.z);
    g.it.h = Math.max(40, g.h0 + dy / v.z);
    if (g.it.kind === 'image' && g.it.src) g.it.h = Math.max(40, (g.it.w * g.h0) / g.w0);
    bdRefresh(g.it);
    return bdLinks();
  }
  g.it.x = g.x0 + dx / v.z;
  g.it.y = g.y0 + dy / v.z;
  bdRefresh(g.it);
  for (const k of g.kids) {
    k.x.x = k.x0 + dx / v.z;
    k.x.y = k.y0 + dy / v.z;
    bdRefresh(k.x);
  }
  bdLinks();
}

function bdUp(e) {
  bd.ptrs.delete(e.pointerId);
  clearTimeout(bd.press);
  if (bd.pinch) {
    if (bd.ptrs.size < 2) bd.pinch = null;
    bdSave();
    return;
  }
  const g = bd.gesture;
  bd.gesture = null;
  if (!g) return;
  if (g.moved) return bdSave();
  const now = Date.now();
  const tap = { t: now, x: e.clientX, y: e.clientY, id: g.it ? g.it.id : null };
  const dbl = bd.lastTap && now - bd.lastTap.t < 320 && Math.hypot(tap.x - bd.lastTap.x, tap.y - bd.lastTap.y) < 24 && bd.lastTap.id === tap.id;
  bd.lastTap = dbl ? null : tap;
  if (g.type === 'pan') {
    if (bd.linkFrom) {
      const from = bdItem(bd.linkFrom);
      bd.linkFrom = null;
      if (from) bdRefresh(from);
      bdTip('');
    }
    if (dbl) {
      const w = bdToWorld(e.clientX, e.clientY);
      const it = bdAdd({ kind: 'note', x: w.x - 80, y: w.y - 60 });
      return bdEditText(it);
    }
    return bdSelect(null);
  }
  if (g.type === 'item') {
    if (bd.linkFrom && bd.linkFrom !== g.it.id) {
      bdSnap();
      bd.board.links.push({ id: uid(), from: bd.linkFrom, to: g.it.id });
      bd.lastTap = null; // касание для связи — не половина двойного
      const from = bdItem(bd.linkFrom);
      bd.linkFrom = null;
      if (from) bdRefresh(from);
      bdLinks();
      bdSave();
      bdTip('');
      haptic(10);
      return;
    }
    if (dbl && g.it.kind !== 'image') return bdEditText(g.it);
    bdSelect(g.it.id);
  }
}

function bdWheel(e) {
  e.preventDefault();
  const v = bd.board.view;
  if (e.ctrlKey || e.metaKey) {
    const w = bdToWorld(e.clientX, e.clientY);
    const z = Math.max(0.15, Math.min(3, v.z * Math.exp(-e.deltaY * 0.01)));
    const r = bd.stage.getBoundingClientRect();
    bd.board.view = { x: e.clientX - r.left - w.x * z, y: e.clientY - r.top - w.y * z, z };
  } else {
    v.x -= e.deltaX;
    v.y -= e.deltaY;
  }
  bdApplyView();
  bdSave();
}

function bdKey(e) {
  if (!bd.root || sheet || e.target.closest('input, textarea')) return;
  const it = bd.sel && bdItem(bd.sel);
  if ((e.key === 'Delete' || e.key === 'Backspace') && it) {
    e.preventDefault();
    bdDelete(it);
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    bdUndo();
  } else if (e.key === 'Escape') {
    bd.linkFrom = null;
    bdSelect(null);
    bdTip('');
  }
}

VIEWS.boards = boardsView;
