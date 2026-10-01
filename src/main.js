import "./style.css";
import { GAMES, gameById, RTP_TARGET } from "./games.js";
import { spin as runSpin, newSession, prepare, randomGrid, randomReel } from "./engine.js";

const CATEGORIES = [["all", "Все"], ["bar", "Бар"], ["club", "Клуб"], ["casino", "Казино"], ["space", "Косморынок"]];
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20];
const POPULAR = 6;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};

const state = {
  screen: "lobby",
  category: "all",
  balance: store.get("88s.balance", 1000),
  betIdx: Math.min(BETS.length - 1, store.get("88s.betIdx", 2)),
  muted: store.get("88s.muted", false),
  auto: false,
  busy: false,
  gameId: null,
  sessions: {},
  boards: {},
  lastWin: 0
};

const app = document.querySelector("#app");
const round2 = x => Math.round(x * 100) / 100;
const bet = () => BETS[state.betIdx];
const session = id => (state.sessions[id] ||= newSession());
const $ = id => document.getElementById(id);

function money(n) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
}

function saveBalance() { store.set("88s.balance", state.balance); }

// ---------- sound (tiny WebAudio synth) ----------

let audio;
function tone(freq, dur = 0.12, type = "sine", vol = 0.05, delay = 0) {
  if (state.muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + dur);
  } catch { /* audio unavailable */ }
}
const sfx = {
  spin() { tone(180, 0.18, "triangle", 0.04); tone(240, 0.18, "triangle", 0.04, 0.08); },
  stop() { tone(120, 0.07, "square", 0.03); },
  win(n = 1) { for (let i = 0; i < Math.min(n + 2, 6); i++) tone(520 * Math.pow(1.122, i * 2), 0.14, "sine", 0.05, i * 0.07); },
  big() { for (let i = 0; i < 8; i++) tone(392 * Math.pow(1.122, i * 2), 0.22, "triangle", 0.06, i * 0.09); },
  feature() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "sawtooth", 0.04, i * 0.12)); }
};

// ---------- shell / navigation ----------

function renderShell(content) {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo" data-nav="lobby"><span>♛</span>88<span>SLOTS</span></div>
        <nav>
          <button class="${state.screen === "lobby" ? "active" : ""}" data-nav="lobby">⌂ <span>Главная</span></button>
          <button class="${state.screen === "slots" ? "active" : ""}" data-nav="slots">▦ <span>Слоты</span></button>
          <button data-nav="live">♤ <span>Live Казино</span></button>
          <button data-nav="casino">♚ <span>Казино</span></button>
          <button data-nav="club">♣ <span>Клуб</span></button>
          <button data-nav="space">◉ <span>Косморынок</span></button>
          <button data-nav="bonus">★ <span>Акции</span></button>
          <button data-nav="vip">♛ <span>VIP</span></button>
        </nav>
        <div class="bonus-card">
          <div class="bonus-icon">${emojiImg("🎁", "bonus-img")}</div>
          <b>БОНУС</b>
          <small>при первом депозите</small>
          <button>Получить</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="search">⌕ <input id="search" placeholder="Найти игру..." /></div>
          <div class="top-actions">
            <div class="balance">▣ <small>Баланс</small><strong id="balTop">${money(state.balance)}</strong></div>
            <button class="deposit" id="deposit" title="Демо: добавить 1000 виртуальных €">Пополнить</button>
            <button class="icon-btn">◉</button>
          </div>
        </header>
        ${content}
      </main>
    </div>`;
  bindCommon();
}

function bindCommon() {
  document.querySelectorAll("[data-nav]").forEach(b => b.onclick = () => {
    const n = b.dataset.nav;
    if (n === "lobby") { state.screen = "lobby"; renderLobby(); }
    else if (n === "slots" || ["bar", "club", "casino", "space"].includes(n)) {
      state.category = n === "slots" ? "all" : n;
      state.screen = "slots"; renderSlots();
    } else {
      alert("Раздел прототипа пока демонстрационный.");
    }
  });
  $("deposit").onclick = () => {
    state.balance = round2(state.balance + 1000);
    saveBalance(); updateHud();
  };
  const search = $("search");
  search.oninput = () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll(".game-card").forEach(card => {
      card.style.display = card.dataset.title.includes(q) ? "" : "none";
    });
  };
}

// ---------- lobby / catalog ----------

function categoryTile(cat, icon, title) {
  return `<button class="category-tile" data-cat="${cat}"><span>${icon}</span><b>${title}</b></button>`;
}

function gameCard(g) {
  return `<article class="game-card" data-title="${g.title.toLowerCase()}" data-category="${g.category}">
    <div class="game-art themed ${g.accent}" style="--a:${g.theme.a};--b:${g.theme.b}">${emojiImg(g.icon, "card-icon")}<b>${g.title}</b><small>${g.tag}</small></div>
    <div class="game-meta"><b>${g.title}</b><button data-game="${g.id}">ИГРАТЬ</button></div>
  </article>`;
}

function bindGameCards() {
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = () => openGame(b.dataset.game));
  document.querySelectorAll(".game-art").forEach(a => {
    a.style.cursor = "pointer";
    a.onclick = () => openGame(a.closest(".game-card").querySelector("[data-game]").dataset.game);
  });
}

function renderLobby() {
  renderShell(`
    <section class="hero">
      <div>
        <div class="eyebrow">ПРЕМИАЛЬНОЕ ОНЛАЙН-КАЗИНО</div>
        <h1>ТВОЙ ПУТЬ<br><em>К БОЛЬШИМ ВЫИГРЫШАМ</em></h1>
        <p>${GAMES.length} демо-слотов с разными механиками: линии, ways, кластеры, каскады и бонусные раунды.</p>
        <button class="gold-btn" id="playHero">Играть сейчас</button>
      </div>
      <div class="hero-art"><div class="crown">♛</div><div class="seven">777</div><div class="coins">✦ ✧ ✦</div></div>
    </section>
    <section class="categories">
      ${categoryTile("all", "♛", "Все игры")}
      ${categoryTile("bar", "🍸", "Бар")}
      ${categoryTile("club", "♠", "Клуб")}
      ${categoryTile("casino", "♚", "Казино")}
      ${categoryTile("space", "◉", "Косморынок")}
    </section>
    <section class="section-head"><h2>Популярные игры</h2><button id="allGames">Все игры →</button></section>
    <section class="game-grid">${GAMES.slice(0, POPULAR).map(gameCard).join("")}</section>
    <section class="section-head" style="margin-top:26px"><h2>Новинки</h2></section>
    <section class="game-grid">${GAMES.slice(POPULAR).map(gameCard).join("")}</section>
  `);
  $("playHero").onclick = () => openGame("gold");
  $("allGames").onclick = () => { state.screen = "slots"; state.category = "all"; renderSlots(); };
  document.querySelectorAll(".category-tile").forEach(x => x.onclick = () => {
    state.category = x.dataset.cat; state.screen = "slots"; renderSlots();
  });
  bindGameCards();
}

function renderSlots() {
  const filtered = state.category === "all" ? GAMES : GAMES.filter(g => g.category === state.category);
  renderShell(`
    <div class="page-title"><div><span class="back" id="back">←</span><div><small>КАТАЛОГ</small><h1>Слоты</h1></div></div><select id="sort"><option>По популярности</option><option>Новые</option></select></div>
    <div class="filters">
      ${CATEGORIES.map(([c, t]) => `<button class="${state.category === c ? "active" : ""}" data-filter="${c}">${t}</button>`).join("")}
    </div>
    <section class="game-grid large">${filtered.map(gameCard).join("")}</section>
  `);
  $("back").onclick = () => { state.screen = "lobby"; renderLobby(); };
  document.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { state.category = b.dataset.filter; renderSlots(); });
  bindGameCards();
}

// ---------- game screen ----------

let viewToken = 0;           // bumped whenever the game screen is (re)built; stale animations abort
const ABORT = Symbol("abort");

const BASE = import.meta.env.BASE_URL;
const emojiURL = e => BASE + "sym/" + [...e].map(c => c.codePointAt(0).toString(16)).filter(c => c !== "fe0f").join("-") + ".webp";
const emojiImg = (e, cls = "") => `<img class="${cls}" src="${emojiURL(e)}" alt="" draggable="false">`;

function preloadArt() {
  const seen = new Set();
  for (const g of GAMES) for (const s of [{ glyph: g.icon }, ...g.symbols]) {
    if (!s.glyph || s.text || s.gem || seen.has(s.glyph)) continue;
    seen.add(s.glyph);
    new Image().src = emojiURL(s.glyph);
  }
}

function symbolHTML(g, id, mult = 1, cls = "", row = 0) {
  const s = prepare(g).sym[id];
  const kind = s.kind ? `t-${s.kind}` : `t-${s.tier || "l"}`;
  const color = s.color ? `--c:${s.color};` : "";
  let art;
  if (s.gem) art = `<span class="gem-wrap"><span class="gem" style="--g:${s.gem}"></span></span>`;
  else if (s.text) art = `<span class="txt">${s.glyph}</span>`;
  else art = emojiImg(s.glyph, "art");
  const label = s.label || (s.kind === "wild" || s.kind === "both" ? "WILD" : s.kind === "scatter" ? "SCATTER" : "");
  return `<div class="symbol ${kind} ${cls}" style="${color}--d:${row}">${art}${label ? `<b class="tag ${s.kind === "scatter" ? "sm" : ""}">${label}</b>` : ""}${mult > 1 ? `<i class="mult">×${mult}</i>` : ""}</div>`;
}

const reelsEl = () => $("reels");

function setReel(g, c, ids, mults, clsFn) {
  const el = reelsEl() && reelsEl().children[c];
  if (!el) return;
  el.style.gridTemplateRows = `repeat(${ids.length},1fr)`;
  el.innerHTML = ids.map((id, r) => symbolHTML(g, id, mults ? mults[r] : 1, clsFn ? clsFn(r) : "", r)).join("");
}

function drawBoard(g, grid, mult, { drop = false, locked = [] } = {}) {
  const lk = new Set(locked.map(([c, r]) => c + "," + r));
  grid.forEach((col, c) => setReel(g, c, col, mult && mult[c], r => (drop ? "drop " : "") + (lk.has(c + "," + r) ? "locked" : "")));
}

function markCells(cells) {
  const R = reelsEl();
  if (!R) return;
  R.classList.add("showing");
  for (const [c, r] of cells) {
    const cell = R.children[c] && R.children[c].children[r];
    if (cell) cell.classList.add("win");
  }
}

function clearMarks() {
  const R = reelsEl();
  if (!R) return;
  R.classList.remove("showing");
  R.querySelectorAll(".win").forEach(x => x.classList.remove("win"));
}

function overlay(html, ms = 0, cls = "") {
  return new Promise(resolve => {
    const o = document.createElement("div");
    o.className = "overlay " + cls;
    o.innerHTML = `<div class="ov-card">${html}</div>`;
    document.body.appendChild(o);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      o.classList.add("out");
      setTimeout(() => o.remove(), 220);
      resolve();
    };
    o.addEventListener("click", close);
    if (ms) setTimeout(close, ms);
  });
}

function premiumGlyph(g) {
  const s = g.symbols.find(x => x.tier === "x" && !x.kind && !x.text && !x.gem);
  return s ? s.glyph : g.icon;
}

function renderGame() {
  const g = gameById(state.gameId);
  viewToken++;
  const modeLabel = g.mode === "lines" ? ["ЛИНИИ", g.paylines.length] : g.mode === "ways"
    ? ["ВЫПЛАТЫ", g.varRows ? "до 7776" : Math.pow(g.rows, g.cols)] : ["ВЫПЛАТЫ", "КЛАСТЕР"];
  renderShell(`
    <section class="game-screen" style="--a:${g.theme.a};--b:${g.theme.b}">
      <div class="game-head">
        <button class="back-btn" id="backLobby">← Слоты</button>
        <b>${g.title.toUpperCase()} <span class="muted">DEMO</span></b>
        <div class="head-tools">
          <span class="game-balance">Баланс: <strong id="balGame">${money(state.balance)}</strong></span>
          <button class="tool-btn" id="info" title="Правила и таблица выплат">ⓘ</button>
          <button class="tool-btn" id="sound" title="Звук">${state.muted ? "🔇" : "🔊"}</button>
        </div>
      </div>
      <div class="slot-stage" id="stage" style="--artL:url(${emojiURL(g.icon)});--artR:url(${emojiURL(premiumGlyph(g))})">
        <div class="machine-top">${emojiImg(g.icon)}<span class="logo-text">${g.title}</span>${emojiImg(g.icon)}</div>
        <div class="fs-banner" id="fsBanner" hidden></div>
        <div class="reels-wrap"><div class="reels" id="reels" style="--cols:${g.cols};--rows:${g.rows}">${Array.from({ length: g.cols }, () => `<div class="reel"></div>`).join("")}</div></div>
      </div>
      <div class="win-line" id="winLine"></div>
      <div class="controls">
        <div class="control"><small>${modeLabel[0]}</small><b>${modeLabel[1]}</b></div>
        <div class="stepper"><small>СТАВКА</small><button id="betDown">−</button><b id="betVal"></b><button id="betUp">+</button></div>
        <div class="total"><small>ОБЩАЯ СТАВКА</small><b id="totalBet"></b></div>
        <button class="spin" id="spin">↻</button>
        <button class="control-btn" id="auto">AUTO</button>
        <button class="control-btn" id="maxBet">MAX BET</button>
      </div>
      <div class="notice">ВИРТУАЛЬНЫЙ БАЛАНС · ДЕМО-РЕЖИМ · БЕЗ РЕАЛЬНЫХ СТАВОК</div>
    </section>
  `);

  const saved = state.boards[g.id];
  if (saved) drawBoard(g, saved.grid, saved.mult, { locked: [] });
  else drawBoard(g, randomGrid(g), null);

  $("backLobby").onclick = () => { state.auto = false; state.screen = "slots"; renderSlots(); };
  $("betDown").onclick = () => { if (!locked()) { state.betIdx = Math.max(0, state.betIdx - 1); store.set("88s.betIdx", state.betIdx); updateHud(); } };
  $("betUp").onclick = () => { if (!locked()) { state.betIdx = Math.min(BETS.length - 1, state.betIdx + 1); store.set("88s.betIdx", state.betIdx); updateHud(); } };
  $("maxBet").onclick = () => { if (!locked()) { state.betIdx = BETS.length - 1; store.set("88s.betIdx", state.betIdx); updateHud(); } };
  $("spin").onclick = doSpin;
  $("auto").onclick = () => { state.auto = !state.auto; updateHud(); if (state.auto && !state.busy) doSpin(); };
  $("info").onclick = () => openInfo(g);
  $("sound").onclick = () => { state.muted = !state.muted; store.set("88s.muted", state.muted); $("sound").textContent = state.muted ? "🔇" : "🔊"; };

  setWinLine(state.lastWin ? `Последний выигрыш: <b>${money(state.lastWin)}</b>` : "Сделайте ставку и нажмите ↻");
  updateHud();
  // resume an unfinished bonus after leaving the game
  const token = viewToken;
  if (session(g.id).fsLeft > 0 && !state.busy) setTimeout(() => { if (token === viewToken && state.screen === "game") doSpin(); }, 900);
}

function locked() { return state.busy || session(state.gameId).fsLeft > 0; }

function setWinLine(html) { const el = $("winLine"); if (el) el.innerHTML = html; }

function updateHud() {
  if ($("balTop")) $("balTop").textContent = money(state.balance);
  if ($("balGame")) $("balGame").textContent = money(state.balance);
  if (state.screen !== "game") return;
  const ses = session(state.gameId);
  const g = gameById(state.gameId);
  const inFS = ses.fsLeft > 0;
  if ($("betVal")) {
    $("betVal").textContent = bet().toFixed(2);
    $("totalBet").textContent = money(bet());
    $("spin").disabled = state.busy;
    $("auto").classList.toggle("on", state.auto);
    for (const id of ["betDown", "betUp", "maxBet"]) $(id).disabled = locked();
  }
  const banner = $("fsBanner");
  if (banner) {
    banner.hidden = !inFS;
    $("stage").classList.toggle("fs-mode", inFS);
    if (inFS) {
      const f = g.features || {};
      const parts = [`🎁 <b>FREE SPINS</b> ${ses.fsTotal - ses.fsLeft}/${ses.fsTotal}`];
      if (f.fsProgress || f.fsPersistMult) parts.push(`Множитель <b>×${ses.fsMult}</b>`);
      if (ses.special) parts.push(`Особый символ ${symbolHTML(g, ses.special).replace("symbol", "symbol mini")}`);
      banner.innerHTML = parts.map(p => `<span>${p}</span>`).join("");
    }
  }
}

// ---------- spin flow ----------

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function doSpin() {
  if (state.busy || state.screen !== "game") return;
  const g = gameById(state.gameId);
  const ses = session(g.id);
  const stake = bet();
  const inFS = ses.fsLeft > 0;
  const cost = inFS ? 0 : stake;
  if (cost > state.balance + 1e-9) {
    state.auto = false;
    setWinLine("Недостаточно виртуального баланса — нажмите «Пополнить».");
    updateHud();
    return;
  }

  const token = viewToken;
  const wait = async ms => { await sleep(ms); if (token !== viewToken) throw ABORT; };

  state.busy = true;
  state.balance = round2(state.balance - cost);
  saveBalance();
  updateHud();
  const res = runSpin(g, stake, ses);

  let aborted = false;
  try {
    await animate(g, res, stake, wait);
  } catch (e) {
    if (e === ABORT) aborted = true; else console.error(e);
  } finally {
    state.balance = round2(state.balance + res.total);
    state.lastWin = res.total;
    saveBalance();
    state.busy = false;
  }
  if (aborted) return;

  const last = res.steps[res.steps.length - 1];
  state.boards[g.id] = { grid: last.grid, mult: last.mult };
  setWinLine(res.total > 0 ? `Последний выигрыш: <b>${money(res.total)}</b>` : "Без выигрыша");
  updateHud();

  const again = state.screen === "game" && state.gameId === g.id && token === viewToken;
  if (!again) return;
  if (ses.fsLeft > 0) setTimeout(doSpin, 700);
  else if (state.auto) {
    if (state.balance >= bet()) setTimeout(doSpin, 600);
    else { state.auto = false; updateHud(); }
  }
}

async function animate(g, res, stake, wait) {
  const R = reelsEl();
  clearMarks();
  setWinLine(res.inFS ? "Free Spins…" : "Удачи!");
  sfx.spin();

  // reels spin, then stop one by one
  const spinning = new Set(Array.from({ length: g.cols }, (_, c) => c));
  const rowsNow = Array.from(R.children, el => el.children.length || g.rows);
  for (const el of R.children) el.classList.add("spinning");
  const flicker = setInterval(() => {
    spinning.forEach(c => setReel(g, c, randomReel(g, c, rowsNow[c]), null));
  }, 85);
  try {
    await wait(480);
    const first = res.preGrid || res.steps[0].grid;
    for (let c = 0; c < g.cols; c++) {
      spinning.delete(c);
      setReel(g, c, first[c], res.steps[0].mult[c], r => (res.steps[0].locked.some(l => l[0] === c && l[1] === r) ? "locked" : ""));
      R.children[c].classList.remove("spinning");
      R.children[c].classList.add("land");
      sfx.stop();
      await wait(g.cols > 5 ? 110 : 150);
    }
  } finally {
    clearInterval(flicker);
    for (const el of R.children) el.classList.remove("spinning");
  }
  await wait(120);
  for (const el of R.children) el.classList.remove("land");

  // special symbol expands over its reels
  if (res.preGrid) {
    const sp = prepare(g).sym[res.special] || null;
    markCells(res.preGrid.flatMap((col, c) => col.map((id, r) => (id === res.special ? [c, r] : [])).filter(x => x.length)));
    sfx.feature();
    await wait(650);
    clearMarks();
    drawBoard(g, res.steps[0].grid, res.steps[0].mult);
    res.expandReels.forEach(c => R.children[c].classList.add("expand"));
    if (sp) setWinLine(`Раскрывается ${symbolHTML(g, res.special).replace("symbol", "symbol mini")}${res.bookWin ? ` — <b>${money(res.bookWin)}</b>` : ""}`);
    await wait(700);
    res.expandReels.forEach(c => R.children[c].classList.remove("expand"));
  }

  // evaluate each step: highlight, count up, tumble / respin
  let running = res.bookWin;
  for (let i = 0; i < res.steps.length; i++) {
    const st = res.steps[i];
    if (i > 0) {
      if (st.kind === "respin") {
        const lockedReels = new Set(st.locked.filter(([c, r]) => st.grid[c].every((_, rr) => st.locked.some(l => l[0] === c && l[1] === rr))).map(l => l[0]));
        setWinLine("Re-spin!");
        sfx.feature();
        for (let c = 0; c < g.cols; c++) if (!lockedReels.has(c)) R.children[c].classList.add("spinning");
        await wait(550);
        for (const el of R.children) el.classList.remove("spinning");
      }
      drawBoard(g, st.grid, st.mult, { drop: st.kind === "tumble", locked: st.locked });
      await wait(st.kind === "tumble" ? 520 : 150);
    } else if (st.locked.length) {
      drawBoard(g, st.grid, st.mult, { locked: st.locked });
      const lockedReels = new Set(st.locked.map(l => l[0]));
      lockedReels.forEach(c => R.children[c].classList.add("expand"));
      await wait(450);
      for (const el of R.children) el.classList.remove("expand");
    }
    if (!st.wins.length) continue;
    const cells = st.wins.flatMap(w => w.cells);
    markCells(cells);
    running = round2(running + st.amount);
    const mtxt = st.stepMult > 1 ? ` <span class="muted">×${st.stepMult}</span>` : "";
    setWinLine(`Выигрыш: <b>${money(running)}</b>${mtxt}`);
    sfx.win(i + 1);
    await wait(res.steps.length > 1 ? 750 : 950);
    if (g.features && g.features.tumble) {
      R.querySelectorAll(".win").forEach(x => x.classList.add("pop"));
      await wait(380);
    }
    clearMarks();
  }

  if (res.scatterWin > 0 || res.scatterCount >= 3) {
    markCells(res.scatterCells);
    if (res.scatterWin > 0) { running = round2(running + res.scatterWin); setWinLine(`Scatter: <b>${money(res.scatterWin)}</b>`); sfx.win(3); }
    await wait(900);
    clearMarks();
  }

  const ratio = res.total / stake;
  if (res.total > 0) setWinLine(`Выигрыш: <b>${money(res.total)}</b>`);
  const big = ratio >= 100 ? "ЭПИЧНЫЙ ВЫИГРЫШ" : ratio >= 50 ? "МЕГА ВЫИГРЫШ" : ratio >= 20 ? "БОЛЬШОЙ ВЫИГРЫШ" : ratio >= 10 && !res.inFS ? "ОТЛИЧНЫЙ ВЫИГРЫШ" : "";
  if (big) { await bigWin(big, res.total, wait); }

  if (res.fsAwarded) {
    sfx.feature();
    const f = g.features || {};
    const extra = !res.inFS && res.special ? `<div class="ov-sub">Особый символ: ${symbolHTML(g, res.special).replace("symbol", "symbol mini big")}</div>` : "";
    const sticky = !res.inFS && f.stickyWilds ? `<div class="ov-sub">Wild остаются на местах</div>` : "";
    await overlay(`<div class="ov-title">FREE SPINS</div><div class="ov-num">${res.inFS ? "+" : ""}${res.fsAwarded}</div><div class="ov-sub">${res.inFS ? "дополнительных вращений" : "бесплатных вращений"}</div>${extra}${sticky}`, 2600, "feature");
    await wait(0);
  }
  if (res.fsEnded) {
    sfx.big();
    await overlay(`<div class="ov-title">FREE SPINS ЗАВЕРШЕНЫ</div><div class="ov-sub">Общий выигрыш в бонусе</div><div class="ov-num">${money(res.fsTotalWin)}</div>`, 3200, "feature");
    await wait(0);
  }
}

async function bigWin(title, amount, wait) {
  sfx.big();
  const p = overlay(`<div class="ov-title big">${title}</div><div class="ov-num" id="bigNum">${money(0)}</div>`, 3400, "feature bigwin");
  const t0 = performance.now();
  const tick = now => {
    const el = $("bigNum");
    if (!el) return;
    const k = Math.min(1, (now - t0) / 1600);
    el.textContent = money(round2(amount * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await p;
  await wait(0);
}

// ---------- paytable / rules ----------

function fmtX(v) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }

function openInfo(g) {
  const p = prepare(g);
  const rows = p.payers.map(s => {
    const pays = Object.keys(s.pay).map(Number).sort((a, b) => b - a)
      .map(k => `<span><b>${k}${g.mode === "cluster" ? "+" : ""}</b> ${fmtX(s.pay[k] * g.scale / g.unit)}×</span>`).join("");
    return `<div class="pt-row">${symbolHTML(g, s.id).replace("symbol", "symbol mini")}<div class="pt-pays">${pays}</div></div>`;
  }).join("");
  const specials = g.symbols.filter(s => s.kind).map(s => {
    const label = s.kind === "both" ? "Wild + Scatter" : s.kind === "wild" ? "Wild" : "Scatter";
    return `<div class="pt-row">${symbolHTML(g, s.id).replace("symbol", "symbol mini")}<div class="pt-pays"><span><b>${label}</b></span></div></div>`;
  }).join("");
  const unitNote = g.mode === "lines" ? "за линию" : g.mode === "ways" ? "за способ" : "за кластер";
  overlay(`
    <div class="ov-title" style="font-size:22px">${g.icon} ${g.title}</div>
    <div class="ov-sub" style="margin-bottom:12px">Расчётный RTP ≈ ${(RTP_TARGET * 100).toFixed(0)}% · макс. выигрыш ${g.maxWin || 5000}× · множители от общей ставки (${unitNote})</div>
    <ul class="rules">${g.rules.map(r => `<li>${r}</li>`).join("")}</ul>
    <div class="pt">${specials}${rows}</div>
    <div class="ov-sub" style="margin-top:12px">Нажмите, чтобы закрыть</div>`, 0, "info");
}

function openGame(id) {
  state.gameId = id;
  state.screen = "game";
  renderGame();
}

preloadArt();
renderLobby();
