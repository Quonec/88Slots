import { SCALE } from "./rtp.js";

export const RTP_TARGET = 0.95;

const LINES = {
  3: [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
  10: [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]
  ]
};

// Base pay tables by symbol tier, in "units" (see engine.js).
const PAY = {
  lines: {
    l: { 3: 0.3, 4: 1, 5: 2.5 }, m: { 3: 0.6, 4: 2, 5: 6 },
    h: { 3: 1.2, 4: 5, 5: 15 }, x: { 3: 3, 4: 15, 5: 60 }
  },
  ways: {
    l: { 3: 0.1, 4: 0.3, 5: 0.8 }, m: { 3: 0.2, 4: 0.6, 5: 2 },
    h: { 3: 0.4, 4: 1.5, 5: 5 }, x: { 3: 1, 4: 5, 5: 20 }
  },
  cluster: {
    l: { 4: 0.05, 5: 0.15, 7: 0.5, 9: 1.5, 12: 5, 15: 15 }, m: { 4: 0.08, 5: 0.25, 7: 0.8, 9: 2.5, 12: 8, 15: 25 },
    h: { 4: 0.12, 5: 0.4, 7: 1.5, 9: 5, 12: 15, 15: 50 }, x: { 4: 0.2, 5: 0.8, 7: 3, 9: 10, 12: 30, 15: 100 }
  }
};

const LOW_COLORS = { A: "#ffcf3e", K: "#5ac7ff", Q: "#ff5e89", J: "#a678ff", 10: "#64e8a2" };

const txt = (id, weight = 14) => ({ id, glyph: id, tier: "l", weight, color: LOW_COLORS[id], text: true });
const sym = (id, glyph, tier, weight) => ({ id, glyph, tier, weight });
const gem = (id, color, tier, weight) => ({ id, glyph: "", gem: color, tier, weight });
const wild = (id, glyph, weight, extra = {}) => ({ id, glyph, kind: "wild", tier: "x", weight, ...extra });
const scatter = (id, glyph, weight, extra = {}) => ({ id, glyph, kind: "scatter", weight, ...extra });

function define(cfg) {
  const set = PAY[cfg.payset || cfg.mode];
  const symbols = cfg.symbols.map(s => (s.tier && !s.pay && set) ? { ...s, pay: set[s.tier] } : s);
  const unit = cfg.unit || (cfg.paylines ? cfg.paylines.length : 1);
  return { rows: 3, cols: 5, ...cfg, symbols, unit, scale: SCALE[cfg.id] ?? 1 };
}

const FS_10 = { spins: { 3: 10, 4: 15, 5: 20 }, retrigger: { 3: 5, 4: 8, 5: 10 } };
const FS_8 = { spins: { 3: 8, 4: 12, 5: 15 }, retrigger: { 3: 4, 4: 6, 5: 8 } };

export const GAMES = [
  define({
    id: "gold", title: "Book of Gold", category: "casino", icon: "📖", accent: "gold",
    tag: "10 линий · Expanding", theme: { a: "#ffd14b", b: "#5b3505" },
    mode: "lines", paylines: LINES[10],
    symbols: [
      txt("10", 14), txt("J", 14), txt("Q", 13), txt("K", 12), txt("A", 12),
      sym("vase", "🏺", "m", 10), sym("scarab", "🪲", "m", 9),
      sym("eagle", "🦅", "h", 7), sym("eye", "👁️", "h", 6), sym("pharaoh", "👑", "x", 4),
      { id: "book", glyph: "📖", kind: "both", tier: "x", weight: 2.8 }
    ],
    scatterPay: { 3: 2, 4: 20, 5: 200 },
    fs: { spins: { 3: 10 }, retrigger: { 3: 10 } },
    features: { book: { min: 3, candidates: ["10", "J", "Q", "K", "A", "vase", "scarab", "eagle", "eye", "pharaoh"] } },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии слева направо. Книга — Wild и Scatter одновременно.",
      "3+ Книги запускают 10 Free Spins. Перед бонусом выбирается особый символ.",
      "В Free Spins особый символ, выпавший на 3+ барабанах, раскрывается на весь барабан и платит в любом месте поля."
    ]
  }),

  define({
    id: "sweet", title: "Candy Cascade", category: "club", icon: "🍭", accent: "pink",
    tag: "Кластеры · Tumble", theme: { a: "#ff7ac6", b: "#6a153f" },
    mode: "cluster", cols: 6, rows: 5, unit: 1,
    symbols: [
      sym("grape", "🍇", "l", 18), sym("melon", "🍉", "l", 17), sym("banana", "🍌", "l", 16), sym("apple", "🍎", "l", 15),
      sym("candy", "🍬", "m", 12), sym("donut", "🍩", "m", 10), sym("lolly", "🍭", "h", 8), sym("straw", "🍓", "x", 5),
      scatter("cake", "🎂", 2.4)
    ],
    scatterPay: { 4: 3, 5: 5, 6: 100 },
    fs: { spins: { 4: 10, 5: 12, 6: 15 }, retrigger: { 3: 5, 4: 8, 5: 10 } },
    features: { tumble: true, fsPersistMult: { inc: 1, cap: 15 } },
    rules: [
      "Выигрыш — кластер из 5+ одинаковых символов, соединённых по горизонтали или вертикали.",
      "Выигравшие символы исчезают, остальные падают вниз, сверху добавляются новые (Tumble).",
      "4+ Scatter 🎂 запускают 10 Free Spins. В бонусе множитель растёт на +1 после каждого выигрышного каскада и не сбрасывается до конца бонуса."
    ]
  }),

  define({
    id: "olympus", title: "Olympus Storm", category: "casino", icon: "⚡", accent: "blue",
    tag: "243 ways · Wild ×", theme: { a: "#6fb7ff", b: "#164a8e" },
    mode: "ways", unit: 20,
    symbols: [
      txt("J", 15), txt("Q", 15), txt("K", 14), txt("A", 14),
      sym("shield", "🛡️", "m", 10), sym("sword", "⚔️", "m", 9),
      sym("temple", "🏛️", "h", 7), sym("owl", "🦉", "h", 6), sym("trident", "🔱", "x", 4),
      wild("storm", "🌩️", 5, { reels: [1, 2, 3], fsWeight: 8 }),
      scatter("bolt", "⚡", 2.5)
    ],
    scatterPay: { 3: 1, 4: 5, 5: 20 },
    fs: { spins: { 3: 10, 4: 15, 5: 20 }, retrigger: { 3: 5, 4: 7, 5: 10 } },
    features: { wildMult: { base: [[1, 1]], fs: [[2, 6], [3, 3], [5, 1]] } },
    rules: [
      "243 способа выиграть: символы платят слева направо на соседних барабанах, количество совпадений перемножается.",
      "Wild 🌩️ выпадает на барабанах 2–4. В Free Spins он приносит множитель ×2, ×3 или ×5, множители Wild в выигрыше складываются.",
      "3+ Scatter ⚡ запускают 10 Free Spins."
    ]
  }),

  define({
    id: "bass", title: "Big Catch", category: "bar", icon: "🐟", accent: "cyan",
    tag: "10 линий · Растущий ×", theme: { a: "#4fe0f0", b: "#08717e" },
    mode: "lines", paylines: LINES[10],
    symbols: [
      txt("J", 15), txt("Q", 15), txt("K", 14), txt("A", 14),
      sym("crab", "🦀", "m", 10), sym("octo", "🐙", "m", 9),
      sym("puffer", "🐡", "h", 7), sym("shark", "🦈", "h", 6), sym("whale", "🐋", "x", 4),
      wild("rod", "🎣", 5, { reels: [1, 2, 3], fsWeight: 9 }),
      scatter("fish", "🐟", 2.7)
    ],
    scatterPay: { 3: 2, 4: 10, 5: 50 },
    fs: FS_10,
    features: { fsProgress: true },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии слева направо. Wild 🎣 заменяет всё, кроме Scatter.",
      "3+ Scatter 🐟 запускают 10 Free Spins.",
      "В Free Spins каждый выпавший Wild 🎣 увеличивает общий множитель на +1 до конца бонуса."
    ]
  }),

  define({
    id: "piggy", title: "Lucky Piggy", category: "bar", icon: "🐷", accent: "rose",
    tag: "10 линий · Sticky Wild", theme: { a: "#ff9aa8", b: "#71332d" },
    mode: "lines", paylines: LINES[10],
    symbols: [
      txt("J", 15), txt("Q", 15), txt("K", 14), txt("A", 14),
      sym("corn", "🌽", "m", 10), sym("carrot", "🥕", "m", 9),
      sym("hen", "🐔", "h", 7), sym("cow", "🐄", "h", 6), sym("pig", "🐷", "x", 4),
      wild("clover", "🍀", 5, { reels: [1, 2, 3], fsWeight: 6 }),
      scatter("medal", "🥇", 2.7)
    ],
    scatterPay: { 3: 2, 4: 10, 5: 50 },
    fs: FS_8,
    features: { stickyWilds: true },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии слева направо. Wild 🍀 заменяет всё, кроме Scatter.",
      "3+ Scatter 🥇 запускают 8 Free Spins.",
      "В Free Spins выпавшие Wild остаются на своих местах до конца бонуса."
    ]
  }),

  define({
    id: "dog", title: "Hound House", category: "club", icon: "🐶", accent: "orange",
    tag: "243 ways · Sticky ×", theme: { a: "#ffb35c", b: "#774016" },
    mode: "ways", unit: 20,
    symbols: [
      txt("J", 15), txt("Q", 15), txt("K", 14), txt("A", 14),
      sym("bone", "🦴", "m", 10), sym("ball", "🎾", "m", 9),
      sym("poodle", "🐩", "h", 7), sym("guide", "🦮", "h", 6), sym("dog", "🐕", "x", 4),
      wild("house", "🏠", 5, { reels: [1, 2, 3], fsWeight: 6 }),
      scatter("paw", "🐾", 2.6)
    ],
    scatterPay: { 3: 1, 4: 5, 5: 20 },
    fs: FS_10,
    features: { stickyWilds: true, wildMult: { base: [[1, 1]], fs: [[2, 6], [3, 3], [5, 1]] } },
    rules: [
      "243 способа выиграть: символы платят слева направо на соседних барабанах.",
      "Wild 🏠 выпадает на барабанах 2–4. 3+ Scatter 🐾 запускают 10 Free Spins.",
      "В Free Spins Wild становятся липкими и получают множитель ×2, ×3 или ×5. Множители всех Wild в выигрыше складываются."
    ]
  }),

  define({
    id: "star", title: "Cosmic Gems", category: "space", icon: "💎", accent: "purple",
    tag: "10 линий · Both ways · Respin", theme: { a: "#b98bff", b: "#432078" },
    mode: "lines", paylines: LINES[10], bothWays: true,
    symbols: [
      gem("ruby", "#e3263f", "l", 16), gem("amber", "#ff8a1f", "l", 16), gem("lime", "#c8e02a", "l", 15), gem("emerald", "#17c25f", "m", 14),
      gem("sapphire", "#2f7bff", "m", 14), gem("aqua", "#12c8d8", "m", 12), gem("amethyst", "#a24bff", "h", 11),
      { id: "7", glyph: "7", text: true, color: "#ff4d5e", tier: "h", weight: 8 },
      sym("diamond", "💎", "x", 6),
      wild("star", "⭐", 4, { reels: [1, 2, 3] })
    ],
    features: { respin: { max: 3, expand: true, reels: [1, 2, 3] } },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии, в обе стороны: слева направо и справа налево.",
      "Wild ⭐ выпадает на барабанах 2–4, растягивается на весь барабан и даёт Re-spin.",
      "Растянувшиеся Wild остаются на месте, пока идёт Re-spin (до 3 подряд)."
    ]
  }),

  define({
    id: "nova", title: "Nova Reels", category: "space", icon: "🪐", accent: "teal",
    tag: "Динамические барабаны", theme: { a: "#52f0d4", b: "#075f69" },
    mode: "ways", unit: 40, rows: 6,
    varRows: {
      base: [[2, 1], [3, 2], [4, 3], [5, 3], [6, 2]],
      fs: [[3, 1], [4, 2], [5, 3], [6, 3]]
    },
    symbols: [
      txt("10", 15), txt("J", 15), txt("Q", 14), txt("K", 14), txt("A", 13),
      sym("moon", "🌙", "m", 10), sym("comet", "☄️", "m", 9),
      sym("rocket", "🚀", "h", 7), sym("earth", "🌍", "h", 6), sym("planet", "🪐", "x", 4),
      wild("galaxy", "🌌", 5, { reels: [1, 2, 3], fsWeight: 7 }),
      scatter("meteor", "🌠", 1.9)
    ],
    scatterPay: { 3: 1, 4: 5, 5: 20 },
    fs: FS_8,
    rules: [
      "На каждом спине число символов на барабане меняется от 2 до 6 — чем выше барабаны, тем больше способов выиграть (до 7776).",
      "Символы платят слева направо на соседних барабанах, количество совпадений перемножается.",
      "3+ Scatter 🌠 запускают 8 Free Spins, где высокие барабаны выпадают чаще."
    ]
  }),

  define({
    id: "dragon", title: "Dragon Fortune", category: "casino", icon: "🐉", accent: "red",
    tag: "1024 ways · Sticky Wild", theme: { a: "#ff6a5e", b: "#7a1410" },
    mode: "ways", unit: 20, rows: 4,
    symbols: [
      txt("10", 15), txt("J", 15), txt("Q", 14), txt("K", 14), txt("A", 13),
      sym("lantern", "🏮", "m", 10), sym("envelope", "🧧", "m", 9),
      sym("tiger", "🐯", "h", 7), sym("peacock", "🦚", "h", 6), sym("dragon", "🐉", "x", 4),
      wild("pearl", "🐲", 5, { reels: [1, 2, 3, 4], fsWeight: 6 }),
      scatter("tile", "🀄", 2)
    ],
    scatterPay: { 3: 1, 4: 5, 5: 20 },
    fs: FS_8,
    features: { stickyWilds: true },
    rules: [
      "1024 способа выиграть на поле 5×4: символы платят слева направо на соседних барабанах.",
      "Wild 🐲 выпадает на барабанах 2–5 и заменяет всё, кроме Scatter.",
      "3+ Scatter 🀄 запускают 8 Free Spins, где Wild остаются на своих местах до конца бонуса."
    ]
  }),

  define({
    id: "bounty", title: "Wild West Bounty", category: "club", icon: "🤠", accent: "orange",
    tag: "10 линий · Wild Re-spin", theme: { a: "#ffc15a", b: "#6b3a12" },
    mode: "lines", paylines: LINES[10],
    symbols: [
      txt("J", 15), txt("Q", 15), txt("K", 14), txt("A", 14),
      sym("cactus", "🌵", "m", 10), sym("boot", "🥾", "m", 9),
      sym("horse", "🐎", "h", 7), sym("gun", "🔫", "h", 6), sym("sheriff", "🤠", "x", 4),
      wild("badge", "⭐", 4),
      scatter("loot", "💰", 2.7)
    ],
    scatterPay: { 3: 2, 4: 10, 5: 50 },
    fs: FS_8,
    features: { respin: { max: 3, expand: false } },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии слева направо. Wild ⭐ заменяет всё, кроме Scatter.",
      "Каждый выпавший Wild фиксируется на месте и даёт Re-spin (до 3 подряд).",
      "3+ Scatter 💰 запускают 8 Free Spins."
    ]
  }),

  define({
    id: "frenzy", title: "Fruit Frenzy", category: "bar", icon: "🍓", accent: "rose",
    tag: "10 линий · Каскады ×", theme: { a: "#ff6f91", b: "#7a1d3a" },
    mode: "lines", paylines: LINES[10],
    symbols: [
      sym("cherry", "🍒", "l", 15), sym("lemon", "🍋", "l", 15), sym("orange", "🍊", "l", 14), sym("grapes", "🍇", "l", 14),
      sym("melon", "🍉", "m", 10), sym("berry", "🍓", "m", 9), sym("gem", "💎", "h", 6),
      { id: "7", glyph: "7", text: true, color: "#ff4d5e", tier: "x", weight: 4 },
      wild("joker", "🃏", 5, { reels: [1, 2, 3] }),
      scatter("bell", "🔔", 2.6)
    ],
    scatterPay: { 3: 2, 4: 10, 5: 50 },
    fs: FS_8,
    features: { tumble: true, cascade: { base: [1, 2, 3, 5, 8], fs: [2, 4, 6, 10, 15] } },
    rules: [
      "Выигрыш — 3+ одинаковых символа на линии слева направо. Wild 🃏 заменяет всё, кроме Scatter.",
      "Выигравшие символы исчезают, и сверху падают новые. Каждый следующий каскад увеличивает множитель: ×1, ×2, ×3, ×5, ×8.",
      "3+ Scatter 🔔 запускают 8 Free Spins, где множители каскадов удвоены: ×2 … ×15."
    ]
  }),

  define({
    id: "royal", title: "Royal Vegas 777", category: "casino", icon: "🎰", accent: "gold",
    tag: "Классика 3×3 · Wild ×", theme: { a: "#ff4d5e", b: "#5a0f18" },
    mode: "lines", cols: 3, rows: 3, paylines: LINES[3],
    symbols: [
      { id: "cherry", glyph: "🍒", weight: 20, pay: { 2: 0.5, 3: 2 } },
      { id: "lemon", glyph: "🍋", weight: 18, pay: { 3: 3 } },
      { id: "bell", glyph: "🔔", weight: 14, pay: { 3: 6 } },
      { id: "star", glyph: "⭐", weight: 10, pay: { 3: 12 } },
      { id: "diamond", glyph: "💎", weight: 6, pay: { 3: 30 } },
      { id: "7", glyph: "7", text: true, color: "#ff4d5e", weight: 4, pay: { 3: 80 } },
      wild("joker", "🃏", 6, { reels: [1], pay: { 3: 120 } })
    ],
    features: { wildMult: { base: [[2, 3], [3, 1]] } },
    rules: [
      "Классический автомат 3×3 с 5 линиями. Выигрыш — 3 одинаковых символа на линии слева направо.",
      "Две вишни 🍒 слева на линии тоже платят.",
      "Wild 🃏 выпадает на среднем барабане, заменяет все символы и приносит множитель ×2 или ×3."
    ]
  }),

  define({
    id: "alien", title: "Alien Hive", category: "space", icon: "👽", accent: "green",
    tag: "1024 ways · Каскады ×", theme: { a: "#7dff6a", b: "#1b5a1a" },
    mode: "ways", unit: 20, rows: 4,
    symbols: [
      txt("10", 15), txt("J", 15), txt("Q", 14), txt("K", 14), txt("A", 13),
      sym("flask", "🧪", "m", 10), sym("scope", "🔭", "m", 9),
      sym("sat", "🛰️", "h", 7), sym("robot", "🤖", "h", 6), sym("alien", "👽", "x", 4),
      wild("dna", "🧬", 5, { reels: [1, 2, 3] }),
      scatter("ufo", "🛸", 2)
    ],
    scatterPay: { 3: 1, 4: 5, 5: 20 },
    fs: FS_8,
    features: { tumble: true, cascade: { base: [1, 2, 3, 5], fs: [2, 4, 6, 10] } },
    rules: [
      "1024 способа выиграть на поле 5×4: символы платят слева направо на соседних барабанах.",
      "После выигрыша символы исчезают, сверху падают новые. Множитель каскадов растёт: ×1, ×2, ×3, ×5.",
      "3+ Scatter 🛸 запускают 8 Free Spins, где множители каскадов удвоены."
    ]
  })
];

export const gameById = id => GAMES.find(g => g.id === id);

// Popular first (matches the original lobby order), then the rest.
const ORDER = ["gold", "sweet", "olympus", "bass", "piggy", "dog"];
GAMES.sort((a, b) => {
  const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});
