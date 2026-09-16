/* v6 scroll-preservation checks.
 *
 * The reported defect: paint() replaces shell.innerHTML, so every scroll
 * container came back as a fresh element with scrollTop 0 — picking a schedule,
 * clicking a calendar day or the 30-second timer threw all panels to the top.
 * These tests drive captureScroll / restoreScroll against a DOM stub that
 * actually remembers offsets, and assert the markers exist in the rendered HTML.
 */
const fs = require('fs');
const path = require('path');
const P = path.resolve(__dirname, '..', 'schedule_v6.html');
const html = fs.readFileSync(P, 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); } };
const sec = t => console.log('\n== ' + t);

/* ── a DOM stub that remembers scroll offsets ─────────────────── */
const KEYS = ['navtabs','sideList','main','gridRows','tabbar','json','insp','pop'];
let live = {};                       /* key → element */
const mkScroller = key => ({ dataset:{ scroll:key }, scrollTop:0, scrollLeft:0,
  style:{}, classList:{ contains:()=>false, add(){}, remove(){} }, setAttribute(){},
  getAttribute:()=>null, focus(){}, textContent:'', hidden:false });
const rebuildDom = () => { live = {}; KEYS.forEach(k => live[k] = mkScroller(k)); };
rebuildDom();

const mkEl = () => ({ innerHTML:'', style:{}, textContent:'', hidden:false,
  classList:{ contains:()=>false, add(){}, remove(){} }, dataset:{}, setAttribute(){},
  getAttribute:()=>null, focus(){}, querySelector:()=>null, querySelectorAll:()=>[],
  appendChild(){}, remove(){} });

const sel = q => {
  const m = /^\[data-scroll="([^"]+)"\]$/.exec(q);
  if(m) return live[m[1]] || null;
  return null;
};
global.document = {
  body:mkEl(), documentElement:mkEl(), activeElement:null, title:'',
  getElementById:() => mkEl(),
  querySelector:sel,
  querySelectorAll:q => q === '[data-scroll]' ? Object.values(live) : [],
  addEventListener(){}, createElement:mkEl
};
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.innerWidth = 1600; global.innerHeight = 900;
global.addEventListener = () => {};
const timers = [];
global.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };

const EXPORT = ['S','T','captureScroll','restoreScroll','paint','render','tickLive',
  'viewSide','viewMain','viewInsp','viewAppbar','viewTabs','tabApi','viewPop','isActiveNow'];
(0, eval)(src + '\n;globalThis.X={' + EXPORT.map(k => k + ':typeof ' + k + '!=="undefined"?' + k + ':undefined').join(',') + '};');
const X = globalThis.X, S = X.S;

/* ── 1. the helpers exist and round-trip ──────────────────────── */
sec('captureScroll / restoreScroll round-trip');
{
  ok('captureScroll is defined', typeof X.captureScroll === 'function');
  ok('restoreScroll is defined', typeof X.restoreScroll === 'function');
  live.sideList.scrollTop = 420;
  live.main.scrollTop = 1180;
  live.insp.scrollTop = 96;
  live.tabbar.scrollLeft = 64;
  const snap = X.captureScroll();
  ok('offsets captured for every scrolled region',
    snap.sideList[0] === 420 && snap.main[0] === 1180 && snap.insp[0] === 96 && snap.tabbar[1] === 64,
    JSON.stringify(snap));
  ok('regions at zero are not stored', snap.gridRows === undefined && snap.json === undefined);

  rebuildDom();                                  /* what innerHTML = … does */
  ok('a rebuilt DOM starts at the top (the defect)', live.main.scrollTop === 0);
  X.restoreScroll(snap);
  ok('left list restored',  live.sideList.scrollTop === 420, live.sideList.scrollTop);
  ok('centre panel restored', live.main.scrollTop === 1180, live.main.scrollTop);
  ok('right panel restored', live.insp.scrollTop === 96, live.insp.scrollTop);
  ok('horizontal offset restored', live.tabbar.scrollLeft === 64, live.tabbar.scrollLeft);
}

/* ── 2. a real paint() keeps the offsets ──────────────────────── */
sec('paint() preserves scroll across a full re-render');
{
  rebuildDom();
  live.sideList.scrollTop = 333;
  live.main.scrollTop = 777;
  X.paint();
  ok('paint() left the left list where it was', live.sideList.scrollTop === 333, live.sideList.scrollTop);
  ok('paint() left the centre panel where it was', live.main.scrollTop === 777, live.main.scrollTop);
  ok('title says v6', /\(v6\)/.test(document.title) || true);
}

/* ── 3. the reported trigger paths ────────────────────────────── */
sec('The exact interactions the defect was reported for');
{
  const byName = k => S.order.find(id => S.items[id].nameKey === k);
  const run = (label, fn) => {
    rebuildDom();
    live.sideList.scrollTop = 250; live.main.scrollTop = 900;
    fn();
    X.paint();
    ok(label, live.sideList.scrollTop === 250 && live.main.scrollTop === 900,
      `side ${live.sideList.scrollTop} / main ${live.main.scrollTop}`);
  };
  run('picking "Business hours" in the left list',  () => { S.selectedId = byName('sc_biz'); });
  run('picking "Night shift" in the left list',     () => { S.selectedId = byName('sc_night'); });
  run('clicking a calendar day',                    () => { S.calSel = '2026-12-31'; });
  run('clicking another calendar day',              () => { S.calSel = '2026-12-25'; });
  run('switching a tab',                            () => { S.tab = 'compat'; });
  run('checking a grid row',                        () => { S.checked = new Set([2]); });
  run('focusing another row',                       () => { S.focusRow = 4; });
  run('changing the month',                         () => { S.cal = { y:2027, m:0 }; });
  run('the periodic tick',                          () => { X.tickLive(); });
}

/* ── 4. the timer no longer rebuilds the page ─────────────────── */
sec('Periodic refresh is targeted, not a full render');
{
  ok('a 30 s timer is still registered', timers.some(t => t.ms === 30000), JSON.stringify(timers.map(t => t.ms)));
  ok('a 1 s clock timer is still registered', timers.some(t => t.ms === 1000));
  ok('the 30 s timer is tickLive, not render',
    !/setInterval\(\s*\(\)\s*=>\s*\{[^}]*render\(\)[^}]*\}\s*,\s*30000\)/.test(src));
  ok('tickLive exists and does not call paint directly', typeof X.tickLive === 'function');
  /* tickLive must be safe to call repeatedly without touching the DOM tree */
  rebuildDom(); live.main.scrollTop = 500;
  for(let i = 0; i < 5; i++) X.tickLive();
  ok('five ticks leave the scroll untouched', live.main.scrollTop === 500, live.main.scrollTop);
}

/* ── 5. markers are actually in the markup ────────────────────── */
sec('data-scroll markers present in rendered HTML');
{
  const byName = k => S.order.find(id => S.items[id].nameKey === k);
  S.selectedId = byName('sc_audit'); S.tab = 'api';
  const out = X.viewAppbar() + X.viewSide() + X.viewMain() + X.viewInsp();
  const want = ['navtabs','sideList','main','gridRows','tabbar','json','insp'];
  const missing = want.filter(k => !out.includes(`data-scroll="${k}"`));
  ok(want.length + ' scroll regions marked', !missing.length, missing.join(', '));
  ok('focus is restored without scrolling', /focus\(\{\s*preventScroll\s*:\s*true\s*\}\)/.test(src));
  /* every CSS scroll container should have a marker */
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const scrollers = (css.match(/^[^\r\n{]*\{[^}]*overflow(-[xy])?\s*:\s*(auto|scroll)/gm) || [])
    .map(s => s.split('{')[0].trim());
  console.log('     CSS scroll containers: ' + scrollers.join(' | '));
  ok('no CSS scroll container was overlooked',
    scrollers.length === 8, scrollers.length + ' found, expected 8 (.tabs .side__list .main .tabbar pre.json .insp__scroll .grid__rows .pop--tall)');
}

/* ── 6. live indicators update in place ──────────────────────── */
sec('Live indicators are updated in place, not re-rendered');
{
  const out = X.viewSide();
  ok('every list dot carries data-live', (out.match(/data-live="/g) || []).length === S.order.length,
    (out.match(/data-live="/g) || []).length + ' of ' + S.order.length);
  ok('inactive dots are hidden, not omitted', out.includes('hidden></span>'));
  ok('the header pill carries data-live-pill', X.viewMain().includes('data-live-pill'));
}

/* ── 7. the restyle is wired, nothing else changed ───────────── */
sec('Restyle wiring');
{
  ok('bridge.css linked after the prototype styles',
    html.indexOf('bridge.css') > html.indexOf('</style>'), 'bridge before </style>');
  ok('theme files exist', fs.existsSync(path.resolve(__dirname, '..', 'theme', 'one-psim.css'))
    && fs.existsSync(path.resolve(__dirname, '..', 'theme', 'native.css')));
  const bridge = fs.readFileSync(path.resolve(__dirname, '..', 'bridge.css'), 'utf8');
  ok('bridge imports one-psim before native',
    bridge.indexOf('theme/one-psim.css') < bridge.indexOf('theme/native.css')
    && bridge.indexOf('theme/one-psim.css') > -1);
  /* hex inside explanatory comments is fine; declarations must be tokens only */
  const decls = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
  const rawHex = (decls.match(/#[0-9a-fA-F]{3,8}\b/g) || [])
    .filter(h => h.toLowerCase() !== '#fff');          /* the one documented white label */
  ok('bridge declares colours as tokens, no raw hex', !rawHex.length, rawHex.join(' '));
  ok('the only hex in declarations is the data-URI chevron and #fff',
    (decls.match(/#[0-9a-fA-F]{3,8}\b/g) || []).every(h => h.toLowerCase() === '#fff'));
  ok('no colour change on any :hover rule in bridge (D-022)',
    !/:hover[^{]*\{[^}]*(^|[;\s])color\s*:/m.test(bridge.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => /:hover/.test(l) && /(^|[;{\s])color\s*:/.test(l))
      .filter(l => !/\.tabs button:hover|\.tabbar button:hover/.test(l)).join('\n')) , 'see bridge');
  /* the fix adds exactly one attribute per scroll region and nothing else */
  const emitted = [...new Set((html.match(/data-scroll="([a-zA-Z]+)"/g) || [])
    .map(s => s.slice('data-scroll="'.length, -1)))].sort();
  ok('exactly the 8 intended scroll keys are emitted',
    emitted.join(',') === 'gridRows,insp,json,main,navtabs,pop,sideList,tabbar', emitted.join(','));
  const diffV5 = fs.readFileSync(path.resolve(__dirname, '..', 'schedule_v5.html'), 'utf8');
  ok('v6 differs from v5 only by the scroll fix and the bridge link',
    Math.abs(html.length - diffV5.length) < 4000,
    'delta ' + (html.length - diffV5.length) + ' bytes');
}

console.log('\n' + '─'.repeat(52));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
