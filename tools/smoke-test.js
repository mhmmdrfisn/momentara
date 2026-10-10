// Headless smoke-test for Momentara's canvas render pipeline.
// Extracts the inline <script> from index.html and executes every render path
// against a recording 2D-context stub, so pure-JS errors surface without a browser.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length < 2) throw new Error('expected at least 2 inline script blocks, found ' + blocks.length);
const appCode = blocks[blocks.length - 1];
const configCode = blocks[0];

// ---- 2D context stub -------------------------------------------------------
let ctxCount = 0;
function makeCtx() {
  ctxCount++;
  const noop = () => {};
  const base = {
    canvas: {}, globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    globalCompositeOperation: '', letterSpacing: '0px', filter: 'none',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    setTransform: noop, transform: noop, resetTransform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, ellipse: noop, rect: noop, quadraticCurveTo: noop,
    bezierCurveTo: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
    strokeText: noop, drawImage: noop,
    setLineDash: noop, getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null, measureText: () => ({ width: 10 })
  };
  return new Proxy(base, {
    get(t, p) { return p in t ? t[p] : undefined; },
    set(t, p, v) { t[p] = v; return true; },
    has() { return true; }
  });
}

// ---- minimal DOM ----------------------------------------------------------
function makeEl() {
  const el = {
    style: {}, dataset: {}, children: [], textContent: '', innerHTML: '',
    width: 0, height: 0, src: '', href: '',
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
      contains(c) { return this._s.has(c); }
    },
    append(...k) { k.forEach(x => this.children.push(x)); },
    appendChild(x) { this.children.push(x); return x; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    remove() {}, querySelector() { return makeEl(); },
    querySelectorAll() { return []; }, getContext() { return makeCtx(); },
    toDataURL() { return 'data:image/png;base64,stub'; },
    toBlob(cb) { cb(null); }
  };
  return el;
}
const byId = {};
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: fn => fn(),
  document: {
    getElementById: id => (byId[id] ||= makeEl()),
    querySelectorAll: () => [], createElement: () => makeEl(),
    addEventListener: () => {}, hidden: false,
    fonts: { load: () => Promise.resolve(), ready: Promise.resolve() },
    body: makeEl(), visibilityState: 'visible'
  },
  window: { addEventListener() {}, scrollTo() {}, devicePixelRatio: 2, isSecureContext: true },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { mediaDevices: null },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Proxy, Error
};
sandbox.tailwind = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Top-level `const`/`let` stay lexical inside a vm script, so hand out a
// small object that also exposes a setter for the render-time overlay list.
const EXPORTS = `
;globalThis.__X = {
  THEMES, OVERLAYS, composeStrip, renderStrip, drawPhoto,
  rr, seeded, W, H, PHOTO_W, PHOTO_H, slotY, TITLE_Y, FOOTER_Y,
  setOverlays(list) { OVERLAYS_ACTIVE = list; }
};
`;
new vm.Script(configCode, { filename: 'config.js' }).runInContext(sandbox);
new vm.Script(appCode + EXPORTS, { filename: 'app.js' }).runInContext(sandbox);
const X = sandbox.__X;

// ---- test driver ----------------------------------------------------------
const { THEMES, OVERLAYS, composeStrip, renderStrip, seeded, rr } = X;
const results = [];
const t = (name, fn) => { try { fn(); results.push(['OK', name]); } catch (e) { results.push(['FAIL', name, e && e.message]); } };

const fake = { width: 500, height: 375 };
const photos = [fake, fake, fake];

let themeCount = 0, overlayCount = 0;
for (const [id, theme] of Object.entries(THEMES)) {
  themeCount++;
  t('theme:' + id, () => composeStrip(makeCtx(), theme, photos));
  t('theme-nophoto:' + id, () => composeStrip(makeCtx(), theme, null));
  t('theme-partial:' + id, () => composeStrip(makeCtx(), theme, [fake]));
  // required-shape contract
  if (typeof theme.name !== 'string' || !theme.name) throw new Error(id + ' has no name');
  if (typeof theme.bg !== 'function') throw new Error(id + ' has no bg()');
  if (typeof theme.title !== 'object' || !theme.title.text || !theme.title.font || !theme.title.color)
    throw new Error(id + ' has a broken title spec');
  if (theme.photo && typeof theme.photo !== 'object') throw new Error(id + ' photo must be an object');
}
for (const [id, o] of Object.entries(OVERLAYS)) {
  overlayCount++;
  if (typeof o.fn !== 'function') throw new Error('overlay ' + id + ' has no fn()');
  t('ovl:' + id, () => o.fn(makeCtx(), 500, 375));
  t('ovl-tiny:' + id, () => o.fn(makeCtx(), 8, 6));
  sandbox.OVERLAYS_ACTIVE = [id];
  t('ovl-in-strip:' + id, () => composeStrip(makeCtx(), THEMES.toystory, photos));
  X.setOverlays([]);
}
X.setOverlays(['crown', 'shades', 'sparkles', 'blush', 'moustache']);
t('all-overlays-one-strip', () => composeStrip(makeCtx(), THEMES.aura, photos));
X.setOverlays([]);

t('renderStrip:photos', () => renderStrip(photos));
t('renderStrip:null', () => renderStrip(null));
t('renderStrip:empty', () => renderStrip([]));

// determinism: same seed must produce identical random sequence
t('seed-determinism', () => {
  const a = seeded('starswars'), b = seeded('starswars');
  for (let i = 0; i < 500; i++) if (a() !== b()) throw new Error('seed diverged at ' + i);
});
t('seed-distinct', () => {
  if (seeded('aura')() === seeded('linen')()) throw new Error('different ids produced same seed');
});

// roundRect helper must never emit NaN for degenerate sizes
for (const [w, h, r] of [[0, 0, 20], [1, 100, 50], [100, 1, 50], [-5, -5, 10], [500, 375, 0], [10, 10, 999]]) {
  t(`rr ${w}x${h} r=${r}`, () => { rr(makeCtx(), 0, 0, w, h, r); });
}

const fails = results.filter(r => r[0] === 'FAIL');
console.log('themes   :', themeCount);
console.log('overlays :', overlayCount);
console.log('contexts :', ctxCount);
console.log('cases    :', results.length);
console.log('FAILURES :', fails.length);
fails.forEach(f => console.log('   ✗', f[1], '::', f[2]));
process.exit(fails.length ? 1 : 0);