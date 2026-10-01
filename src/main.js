import "./style.css";

const games = [
  { id: "gold", title: "Book of Gold", category: "casino", icon: "👑", accent: "gold" },
  { id: "sweet", title: "Sweet Bonanza", category: "club", icon: "🍭", accent: "pink" },
  { id: "olympus", title: "Olympus", category: "casino", icon: "⚡", accent: "blue" },
  { id: "bass", title: "Big Bass", category: "bar", icon: "🐟", accent: "cyan" },
  { id: "piggy", title: "Lucky Piggy", category: "bar", icon: "🐷", accent: "rose" },
  { id: "dog", title: "The Dog House", category: "club", icon: "🐶", accent: "orange" },
  { id: "star", title: "Starburst", category: "space", icon: "🌌", accent: "purple" },
  { id: "shark", title: "Razor Shark", category: "space", icon: "🦈", accent: "teal" }
];

const symbols = [
  { id:"A", label:"A", cls:"a", weight: 14, mult: 1.1 },
  { id:"K", label:"K", cls:"k", weight: 15, mult: 1.2 },
  { id:"Q", label:"Q", cls:"q", weight: 16, mult: 1.3 },
  { id:"J", label:"J", cls:"j", weight: 17, mult: 1.5 },
  { id:"10", label:"10", cls:"ten", weight: 17, mult: 1.8 },
  { id:"W", label:"WILD", cls:"wild", weight: 7, mult: 3.0 },
  { id:"S", label:"SCATTER", cls:"scatter", weight: 4, mult: 5.0 }
];

const state = {
  screen: "lobby",
  category: "all",
  balance: 1000,
  bet: 1,
  auto: false,
  spinning: false,
  freeSpins: 0,
  lastWin: 0,
  grid: []
};

const app = document.querySelector("#app");

function money(n) {
  return new Intl.NumberFormat("ru-RU", { style:"currency", currency:"EUR", minimumFractionDigits:2 }).format(n);
}

function weightedSymbol() {
  const total = symbols.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of symbols) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return symbols[0];
}

function makeGrid() {
  return Array.from({length: 5}, () => Array.from({length: 3}, weightedSymbol));
}

function countWins(grid) {
  let win = 0;
  const lines = [
    [0,0,0,0,0],
    [1,1,1,1,1],
    [2,2,2,2,2],
    [0,1,2,1,0],
    [2,1,0,1,2]
  ];
  for (const line of lines) {
    const cells = line.map((row, col) => grid[col][row]);
    const first = cells[0];
    const base = first.id === "W" ? cells.find(x => x.id !== "W" && x.id !== "S") : first;
    if (!base || base.id === "S") continue;
    let run = 0;
    for (const cell of cells) {
      if (cell.id === "S") break;
      if (cell.id === base.id || cell.id === "W") run++;
      else break;
    }
    if (run >= 3) win += state.bet * (run - 2) * base.mult;
  }
  const scatters = grid.flat().filter(x => x.id === "S").length;
  if (scatters >= 3) {
    win += state.bet * (scatters - 2) * 4;
    state.freeSpins += scatters === 3 ? 5 : scatters === 4 ? 8 : 12;
  }
  return Math.round(win * 100) / 100;
}

function symbolHTML(s) {
  return `<div class="symbol ${s.cls}"><span>${s.label}</span></div>`;
}

function renderShell(content) {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="logo" data-nav="lobby"><span>♛</span>88<span>SLOTS</span></div>
        <nav>
          <button class="${state.screen==='lobby'?'active':''}" data-nav="lobby">⌂ <span>Главная</span></button>
          <button class="${state.screen==='slots'?'active':''}" data-nav="slots">▦ <span>Слоты</span></button>
          <button data-nav="live">♤ <span>Live Казино</span></button>
          <button data-nav="casino">♚ <span>Казино</span></button>
          <button data-nav="club">♣ <span>Клуб</span></button>
          <button data-nav="space">◉ <span>Косморынок</span></button>
          <button data-nav="bonus">★ <span>Акции</span></button>
          <button data-nav="vip">♛ <span>VIP</span></button>
        </nav>
        <div class="bonus-card">
          <div class="bonus-icon">🎁</div>
          <b>БОНУС</b>
          <small>при первом депозите</small>
          <button>Получить</button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="search">⌕ <input id="search" placeholder="Найти игру..." /></div>
          <div class="top-actions">
            <div class="balance">▣ <small>Баланс</small><strong>${money(state.balance)}</strong></div>
            <button class="deposit">Пополнить</button>
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
    if (n === "lobby") { state.screen="lobby"; renderLobby(); }
    else if (n === "slots" || ["bar","club","casino","space"].includes(n)) {
      state.category = n === "slots" ? "all" : n;
      state.screen="slots"; renderSlots();
    } else {
      alert("Раздел прототипа пока демонстрационный.");
    }
  });
  const search = document.querySelector("#search");
  if (search) search.oninput = () => {
    const q = search.value.toLowerCase();
    document.querySelectorAll(".game-card").forEach(card => {
      card.style.display = card.dataset.title.includes(q) ? "" : "none";
    });
  };
}

function renderLobby() {
  const cards = games.slice(0,6).map(gameCard).join("");
  renderShell(`
    <section class="hero">
      <div>
        <div class="eyebrow">ПРЕМИАЛЬНОЕ ОНЛАЙН-КАЗИНО</div>
        <h1>ТВОЙ ПУТЬ<br><em>К БОЛЬШИМ ВЫИГРЫШАМ</em></h1>
        <p>Играй в демо-режиме и тестируй механику 88Slots.</p>
        <button class="gold-btn" id="playHero">Играть сейчас</button>
      </div>
      <div class="hero-art"><div class="crown">♛</div><div class="seven">777</div><div class="coins">✦ ✧ ✦</div></div>
    </section>
    <section class="categories">
      ${categoryTile("all","♛","Все игры")}
      ${categoryTile("bar","🍸","Бар")}
      ${categoryTile("club","♠","Клуб")}
      ${categoryTile("casino","♚","Казино")}
      ${categoryTile("space","◉","Косморынок")}
    </section>
    <section class="section-head"><h2>Популярные игры</h2><button id="allGames">Все игры →</button></section>
    <section class="game-grid">${cards}</section>
  `);
  document.querySelector("#playHero").onclick = openGame;
  document.querySelector("#allGames").onclick = () => { state.screen="slots"; state.category="all"; renderSlots(); };
  document.querySelectorAll(".category-tile").forEach(x => x.onclick = () => {
    state.category = x.dataset.cat; state.screen="slots"; renderSlots();
  });
  bindGameCards();
}

function categoryTile(cat, icon, title) {
  return `<button class="category-tile" data-cat="${cat}"><span>${icon}</span><b>${title}</b></button>`;
}

function gameCard(g) {
  return `<article class="game-card" data-title="${g.title.toLowerCase()}" data-category="${g.category}">
    <div class="game-art ${g.accent}"><span>${g.icon}</span><b>${g.title}</b><small>88Slots Demo</small></div>
    <div class="game-meta"><b>${g.title}</b><button data-game="${g.id}">ИГРАТЬ</button></div>
  </article>`;
}

function bindGameCards() {
  document.querySelectorAll("[data-game]").forEach(b => b.onclick = openGame);
}

function renderSlots() {
  const filtered = state.category === "all" ? games : games.filter(g => g.category === state.category);
  renderShell(`
    <div class="page-title"><div><span class="back" id="back">←</span><div><small>КАТАЛОГ</small><h1>Слоты</h1></div></div><select id="sort"><option>По популярности</option><option>Новые</option></select></div>
    <div class="filters">
      ${["all","bar","club","casino","space"].map(c => `<button class="${state.category===c?'active':''}" data-filter="${c}">${c==="all"?"Все":c==="bar"?"Бар":c==="club"?"Клуб":c==="casino"?"Казино":"Косморынок"}</button>`).join("")}
    </div>
    <section class="game-grid large">${filtered.map(gameCard).join("")}</section>
  `);
  document.querySelector("#back").onclick = () => {state.screen="lobby";renderLobby();};
  document.querySelectorAll("[data-filter]").forEach(b => b.onclick = () => { state.category=b.dataset.filter; renderSlots(); });
  bindGameCards();
}

function renderGame() {
  renderShell(`
    <section class="game-screen">
      <div class="game-head">
        <button class="back-btn" id="backLobby">← Слоты</button>
        <b>BOOK OF GOLD <span class="muted">DEMO</span></b>
        <div class="game-balance">Баланс: <strong>${money(state.balance)}</strong></div>
      </div>
      <div class="slot-stage">
        <div class="machine-top"><span>♛</span> BOOK OF GOLD <span>♛</span></div>
        <div class="reels" id="reels">${state.grid.length ? state.grid.map(col => `<div class="reel">${col.map(symbolHTML).join("")}</div>`).join("") : Array.from({length:5},()=>`<div class="reel">${Array.from({length:3},()=>symbolHTML(weightedSymbol())).join("")}</div>`).join("")}</div>
        <div class="payline-glow"></div>
      </div>
      <div class="win-line">Последний выигрыш: <b>${money(state.lastWin)}</b> ${state.freeSpins ? `· 🎁 Free Spins: ${state.freeSpins}` : ""}</div>
      <div class="controls">
        <div class="control"><small>ЛИНИИ</small><b>5</b></div>
        <div class="stepper"><small>СТАВКА</small><button id="betDown">−</button><b>${state.bet.toFixed(2)}</b><button id="betUp">+</button></div>
        <div class="total"><small>ОБЩАЯ СТАВКА</small><b>${money(state.bet)}</b></div>
        <button class="spin" id="spin" ${state.spinning?'disabled':''}>↻</button>
        <button class="control-btn ${state.auto?'on':''}" id="auto">AUTO</button>
        <button class="control-btn" id="maxBet">MAX BET</button>
      </div>
      <div class="notice">ВИРТУАЛЬНЫЙ БАЛАНС · ДЕМО-РЕЖИМ · БЕЗ РЕАЛЬНЫХ СТАВОК</div>
    </section>
  `);
  document.querySelector("#backLobby").onclick = () => { state.screen="slots"; renderSlots(); };
  document.querySelector("#betDown").onclick = () => { state.bet = Math.max(.2, +(state.bet-.2).toFixed(2)); renderGame(); };
  document.querySelector("#betUp").onclick = () => { state.bet = Math.min(20, +(state.bet+.2).toFixed(2)); renderGame(); };
  document.querySelector("#maxBet").onclick = () => { state.bet = 20; renderGame(); };
  document.querySelector("#spin").onclick = spin;
  document.querySelector("#auto").onclick = () => { state.auto=!state.auto; renderGame(); if(state.auto) spin(); };
}

function spin() {
  if (state.spinning) return;
  const cost = state.freeSpins > 0 ? 0 : state.bet;
  if (cost > state.balance) { alert("Недостаточно виртуального баланса."); state.auto=false; return; }
  state.spinning = true;
  state.balance -= cost;
  const reels = [...document.querySelectorAll(".reel")];
  reels.forEach((r,i) => r.classList.add("spinning"));
  setTimeout(() => {
    state.grid = makeGrid();
    state.lastWin = countWins(state.grid);
    state.balance += state.lastWin;
    if (state.freeSpins > 0 && cost === 0) state.freeSpins--;
    state.spinning = false;
    renderGame();
    if (state.auto && (state.balance >= state.bet || state.freeSpins > 0)) setTimeout(spin, 650);
    else if (state.auto) { state.auto=false; renderGame(); }
  }, 850);
}

function openGame() {
  state.screen="game";
  state.grid=[];
  renderGame();
}

renderLobby();
