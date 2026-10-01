// Pure slot math — no DOM. Shared by the UI (main.js) and tools/sim.mjs.
//
// Board: grid[c][r] holds symbol ids, c = reel (left→right), r = row (top→bottom).
// Win amounts are "pay × unit", where unit = bet / game.unit × game.scale.
// game.scale is calibrated by tools/sim.mjs so that RTP lands on the target.

const clone = g => g.map(c => c.slice());
const r2 = x => Math.round(x * 100) / 100;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function newSession() {
  return { fsLeft: 0, fsTotal: 0, fsWin: 0, fsMult: 1, sticky: [], special: null };
}

export function prepare(game) {
  if (game._p) return game._p;
  const wild = game.symbols.find(s => s.kind === "wild" || s.kind === "both") || null;
  const scatter = game.symbols.find(s => s.kind === "scatter" || s.kind === "both") || null;
  const sym = {};
  for (const s of game.symbols) sym[s.id] = s;
  const picks = [false, true].map(fs => Array.from({ length: game.cols }, (_, c) => {
    const ids = [], cum = [];
    let total = 0;
    for (const s of game.symbols) {
      if (s.reels && !s.reels.includes(c)) continue;
      const w = fs && s.fsWeight != null ? s.fsWeight : s.weight;
      if (w <= 0) continue;
      total += w; ids.push(s.id); cum.push(total);
    }
    return { ids, cum, total };
  }));
  const payers = game.symbols.filter(s => !s.kind && s.pay);
  const keys = {};
  for (const s of payers) keys[s.id] = Object.keys(s.pay).map(Number).sort((a, b) => b - a);
  game._p = { wild, scatter, wildId: wild ? wild.id : null, scatterId: scatter ? scatter.id : null, sym, picks, payers, keys };
  return game._p;
}

function pick(p, c, fs, rng) {
  const t = p.picks[fs ? 1 : 0][c];
  const r = rng() * t.total;
  for (let i = 0; i < t.cum.length; i++) if (r < t.cum[i]) return t.ids[i];
  return t.ids[t.ids.length - 1];
}

function rollWeighted(list, rng) {
  let t = 0;
  for (const e of list) t += e[1];
  let r = rng() * t;
  for (const e of list) { if (r < e[1]) return e[0]; r -= e[1]; }
  return list[list.length - 1][0];
}

function wildMult(game, fs, rng) {
  const wm = game.features && game.features.wildMult;
  if (!wm) return 1;
  const list = (fs && wm.fs) || wm.base;
  return list ? rollWeighted(list, rng) : 1;
}

function fresh(game, p, c, fs, rng) {
  const id = pick(p, c, fs, rng);
  return [id, id === p.wildId ? wildMult(game, fs, rng) : 1];
}

function rollRows(game, fs, rng) {
  if (!game.varRows) return Array(game.cols).fill(game.rows);
  const list = (fs && game.varRows.fs) || game.varRows.base;
  return Array.from({ length: game.cols }, () => rollWeighted(list, rng));
}

// Lookup in a {count: value} table: nothing below the smallest key, capped at the largest.
function tbl(table, n) {
  if (!table) return 0;
  const ks = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (n < ks[0]) return 0;
  return table[Math.min(n, ks[ks.length - 1])];
}

export function randomReel(game, c, n, rng = Math.random) {
  const p = prepare(game);
  return Array.from({ length: n }, () => pick(p, c, false, rng));
}

export function randomGrid(game, rng = Math.random) {
  return rollRows(game, false, rng).map((n, c) => randomReel(game, c, n, rng));
}

// ---------- evaluation ----------

function runWin(game, p, grid, mult, line, rev, skip) {
  const cols = line.length;
  let base = null, n = 0, lead = 0, leading = true;
  for (let i = 0; i < cols; i++) {
    const c = rev ? cols - 1 - i : i;
    const id = grid[c][line[c]];
    if (id === p.wildId) { n++; if (leading) lead++; continue; }
    if (id === p.scatterId || id === skip) break;
    leading = false;
    if (base === null) base = id; else if (id !== base) break;
    n++;
  }
  let pay = 0, sym = null, cnt = 0;
  if (base !== null) {
    const v = p.sym[base].pay[n];
    if (v) { pay = v; sym = base; cnt = n; }
  }
  if (lead && p.wild && p.wild.pay) {
    const v = p.wild.pay[lead];
    if (v && v > pay) { pay = v; sym = p.wildId; cnt = lead; }
  }
  if (!pay) return null;
  const wm = game.features && game.features.wildMult;
  const cells = [];
  let m = 1;
  for (let i = 0; i < cnt; i++) {
    const c = rev ? cols - 1 - i : i;
    const r = line[c];
    cells.push([c, r]);
    if (wm && grid[c][r] === p.wildId) m *= mult[c][r];
  }
  return { sym, n: cnt, pay, cells, m };
}

function evalLines(game, p, grid, mult, U, skip) {
  const wins = [];
  const cols = game.cols;
  game.paylines.forEach((line, li) => {
    const f = runWin(game, p, grid, mult, line, false, skip);
    if (f) wins.push({ sym: f.sym, n: f.n, line: li, cells: f.cells, amount: f.pay * f.m * U });
    if (game.bothWays) {
      const b = runWin(game, p, grid, mult, line, true, skip);
      // a full-length line is the same win from both sides: count it once
      if (b && !(f && f.n === cols && b.n === cols)) {
        wins.push({ sym: b.sym, n: b.n, line: li, cells: b.cells, amount: b.pay * b.m * U });
      }
    }
  });
  return wins;
}

function evalWays(game, p, grid, mult, U, skip) {
  const wins = [];
  const wm = game.features && game.features.wildMult;
  for (const s of p.payers) {
    if (s.id === skip) continue;
    let ways = 1, len = 0, bonus = 0;
    const cells = [];
    for (let c = 0; c < game.cols; c++) {
      let k = 0;
      const col = grid[c];
      for (let r = 0; r < col.length; r++) {
        const id = col[r];
        if (id === s.id || id === p.wildId) {
          k++; cells.push([c, r]);
          if (wm && id === p.wildId) bonus += mult[c][r] - 1;
        }
      }
      if (!k) break;
      ways *= k; len++;
    }
    const pay = s.pay[len];
    if (!pay) continue;
    wins.push({ sym: s.id, n: len, ways, cells, amount: pay * ways * U * (1 + bonus) });
  }
  return wins;
}

function evalCluster(game, p, grid, U) {
  const wins = [];
  const cols = grid.length;
  const seen = grid.map(col => col.map(() => false));
  for (let c0 = 0; c0 < cols; c0++) {
    for (let r0 = 0; r0 < grid[c0].length; r0++) {
      if (seen[c0][r0]) continue;
      const id = grid[c0][r0];
      seen[c0][r0] = true;
      const s = p.sym[id];
      if (!s || s.kind || !s.pay) continue;
      const cells = [];
      const stack = [[c0, r0]];
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        for (const d of DIRS) {
          const nc = cur[0] + d[0], nr = cur[1] + d[1];
          if (nc < 0 || nc >= cols || nr < 0 || nr >= grid[nc].length || seen[nc][nr] || grid[nc][nr] !== id) continue;
          seen[nc][nr] = true;
          stack.push([nc, nr]);
        }
      }
      const k = p.keys[id].find(x => x <= cells.length);
      if (k === undefined) continue;
      wins.push({ sym: id, n: cells.length, cells, amount: s.pay[k] * U });
    }
  }
  return wins;
}

function evaluate(game, p, grid, mult, U, skip) {
  if (game.mode === "lines") return evalLines(game, p, grid, mult, U, skip);
  if (game.mode === "ways") return evalWays(game, p, grid, mult, U, skip);
  return evalCluster(game, p, grid, U);
}

// Winning cells vanish, the rest fall down, new symbols drop in from the top.
function collapse(game, p, grid, mult, cells, fs, rng) {
  const gone = grid.map(() => new Set());
  for (const [c, r] of cells) gone[c].add(r);
  for (let c = 0; c < grid.length; c++) {
    const keepId = [], keepM = [];
    for (let r = 0; r < grid[c].length; r++) {
      if (!gone[c].has(r)) { keepId.push(grid[c][r]); keepM.push(mult[c][r]); }
    }
    const fillId = [], fillM = [];
    for (let i = grid[c].length - keepId.length; i > 0; i--) {
      const f = fresh(game, p, c, fs, rng);
      fillId.push(f[0]); fillM.push(f[1]);
    }
    grid[c] = fillId.concat(keepId);
    mult[c] = fillM.concat(keepM);
  }
}

function makeStep(grid, mult, wins, m, kind, locked) {
  let sum = 0;
  for (const w of wins) sum += w.amount;
  return { grid: clone(grid), mult: clone(mult), wins, stepMult: m, amount: r2(sum * m), kind, locked: locked || [] };
}

// ---------- one spin ----------

export function spin(game, bet, session, rng = Math.random) {
  const p = prepare(game);
  const f = game.features || {};
  const inFS = session.fsLeft > 0;
  if (inFS) session.fsLeft--;
  const sc = game.scale == null ? 1 : game.scale;
  const U = (bet / game.unit) * sc;

  const rows = rollRows(game, inFS, rng);
  const grid = [], mult = [];
  for (let c = 0; c < game.cols; c++) {
    const g = [], m = [];
    for (let r = 0; r < rows[c]; r++) {
      const x = fresh(game, p, c, inFS, rng);
      g.push(x[0]); m.push(x[1]);
    }
    grid.push(g); mult.push(m);
  }

  if (inFS && f.stickyWilds) {
    for (const s of session.sticky) { grid[s.c][s.r] = p.wildId; mult[s.c][s.r] = s.m; }
    for (let c = 0; c < grid.length; c++) {
      for (let r = 0; r < grid[c].length; r++) {
        if (grid[c][r] === p.wildId && !session.sticky.some(s => s.c === c && s.r === r)) {
          session.sticky.push({ c, r, m: mult[c][r] });
        }
      }
    }
  }
  if (inFS && f.fsProgress) {
    for (const col of grid) for (const id of col) if (id === p.wildId) session.fsMult += 1;
  }

  const scatterCells = [];
  if (p.scatterId) {
    for (let c = 0; c < grid.length; c++) {
      for (let r = 0; r < grid[c].length; r++) if (grid[c][r] === p.scatterId) scatterCells.push([c, r]);
    }
  }

  // Expanding special symbol (free spins only)
  let preGrid = null, expandReels = [], bookWin = 0, skip = null;
  if (inFS && f.book && session.special) {
    skip = session.special;
    const reels = [];
    for (let c = 0; c < grid.length; c++) if (grid[c].includes(skip)) reels.push(c);
    if (reels.length >= (f.book.min || 3)) {
      preGrid = clone(grid);
      expandReels = reels;
      for (const c of reels) { grid[c].fill(skip); mult[c].fill(1); }
      bookWin = r2((p.sym[skip].pay[reels.length] || 0) * bet * sc);
    }
  }

  const gm = () => (inFS && (f.fsProgress || f.fsPersistMult)) ? session.fsMult : 1;
  const steps = [];

  if (f.respin) {
    // Wilds lock (optionally expanding over the reel) and award a respin.
    const R = f.respin;
    const locked = new Set();
    const key = (c, r) => R.expand ? c : c + "," + r;
    const lockNew = () => {
      let n = 0;
      for (let c = 0; c < grid.length; c++) {
        for (let r = 0; r < grid[c].length; r++) {
          if (grid[c][r] !== p.wildId || (R.reels && !R.reels.includes(c))) continue;
          const k = key(c, r);
          if (locked.has(k)) continue;
          locked.add(k); n++;
          if (R.expand) grid[c].fill(p.wildId);
        }
      }
      return n;
    };
    const lockedCells = () => {
      const out = [];
      for (let c = 0; c < grid.length; c++) for (let r = 0; r < grid[c].length; r++) if (locked.has(key(c, r))) out.push([c, r]);
      return out;
    };
    let newly = lockNew();
    let respins = 0;
    for (;;) {
      steps.push(makeStep(grid, mult, evaluate(game, p, grid, mult, U, skip), gm(), respins ? "respin" : "spin", lockedCells()));
      if (!newly || respins >= R.max) break;
      respins++;
      for (let c = 0; c < grid.length; c++) {
        for (let r = 0; r < grid[c].length; r++) {
          if (locked.has(key(c, r))) continue;
          const x = fresh(game, p, c, inFS, rng);
          grid[c][r] = x[0]; mult[c][r] = x[1];
        }
      }
      newly = lockNew();
    }
  } else {
    let idx = 0;
    for (;;) {
      const wins = evaluate(game, p, grid, mult, U, skip);
      let cm = 1;
      if (f.cascade) {
        const list = (inFS && f.cascade.fs) || f.cascade.base;
        cm = list[Math.min(idx, list.length - 1)];
      }
      steps.push(makeStep(grid, mult, wins, gm() * cm, idx ? "tumble" : "spin"));
      if (!wins.length || !f.tumble || idx >= 40) break;
      if (inFS && f.fsPersistMult) session.fsMult = Math.min(f.fsPersistMult.cap, session.fsMult + f.fsPersistMult.inc);
      const cells = [];
      for (const w of wins) for (const cell of w.cells) cells.push(cell);
      collapse(game, p, grid, mult, cells, inFS, rng);
      idx++;
    }
  }

  const nScat = scatterCells.length;
  const scatterWin = r2(tbl(game.scatterPay, nScat) * bet * sc);
  let total = bookWin + scatterWin;
  for (const s of steps) total += s.amount;
  total = Math.min(r2(total), bet * (game.maxWin || 5000));

  let fsAwarded = 0;
  if (game.fs && p.scatterId) {
    fsAwarded = tbl(inFS ? game.fs.retrigger : game.fs.spins, nScat);
    if (inFS && session.fsTotal >= 100) fsAwarded = 0;
  }
  if (fsAwarded) {
    if (inFS) {
      session.fsLeft += fsAwarded;
      session.fsTotal += fsAwarded;
    } else {
      session.fsLeft = fsAwarded; session.fsTotal = fsAwarded;
      session.fsWin = 0; session.fsMult = 1; session.sticky = [];
      session.special = f.book ? f.book.candidates[Math.floor(rng() * f.book.candidates.length)] : null;
    }
  }

  let fsEnded = false, fsTotalWin = 0;
  if (inFS) {
    session.fsWin += total;
    if (!session.fsLeft) { fsEnded = true; fsTotalWin = r2(session.fsWin); }
  }

  const out = {
    steps, total, rows, inFS, scatterCount: nScat, scatterCells, scatterWin, fsAwarded,
    fsLeft: session.fsLeft, fsTotal: session.fsTotal, fsMult: session.fsMult, special: session.special,
    fsEnded, fsTotalWin, preGrid, expandReels, bookWin
  };
  if (fsEnded) {
    session.fsMult = 1; session.sticky = []; session.special = null; session.fsTotal = 0; session.fsWin = 0;
  }
  return out;
}
