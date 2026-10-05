/* v7 layout checks: the workbench regions, the contextual inspector, developer
 * mode, keyboard shortcuts, remembered layout, and — the promise of
 * specification/Efficiency_Analysis_v2.MD — that every action of v6 is still
 * reachable somewhere in v7.
 *   node tests/test_v7_layout.js [file]   — defaults to schedule.html, the newest version
 */
const fs = require('fs');
const path = require('path');
const proto = path.resolve(__dirname, '..', 'prototypes');
const html = fs.readFileSync(path.join(proto, process.argv[2] || 'schedule.html'), 'utf8');
const v6 = fs.readFileSync(path.join(proto, 'schedule_v6.html'), 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + x : '')); } };
const sec = t => console.log('\n== ' + t);

/* ── DOM stub that keeps the listeners so events can be dispatched ── */
const listeners = {};
const mkEl = () => ({ innerHTML:'', style:{}, textContent:'', hidden:false, dataset:{}, className:'',
  classList:{ contains:()=>false, add(){}, remove(){}, toggle(){} }, setAttribute(){}, getAttribute:()=>null,
  hasAttribute:()=>false, focus(){}, querySelector:()=>null, querySelectorAll:()=>[], appendChild(){}, remove(){} });
const els = { appbar:mkEl(), shell:mkEl(), statusline:mkEl(), overlays:mkEl() };
global.document = { body:mkEl(), documentElement:mkEl(), activeElement:null, title:'',
  getElementById:id => els[id] || mkEl(), querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener:(t, f) => (listeners[t] = listeners[t] || []).push(f), createElement:mkEl };
const store = {};
global.localStorage = { getItem:k => k in store ? store[k] : null, setItem:(k, v) => { store[k] = String(v); } };
global.location = { search:'' };
global.requestAnimationFrame = () => 0;
global.innerWidth = 1440; global.innerHeight = 900;
global.addEventListener = () => {};
global.setInterval = () => 0;
global.setTimeout = () => 0;

const EXPORT = ['S','T','paint','viewCenter','viewEditor','viewPanel','viewInsp','viewSide','viewRail','viewStatus',
  'viewPop','viewAppbar','inspContext','loadUi','saveUi','UI_DEF','UI_KEY','panelTabs'];
(0, eval)(src + '\n;globalThis.X={' + EXPORT.map(k => k + ':typeof ' + k + '!=="undefined"?' + k + ':undefined').join(',') + '};');
const X = globalThis.X, S = X.S;
const byKey = k => S.order.find(id => S.items[id].nameKey === k);

/* dispatch helpers */
const fake = (ds, extra) => Object.assign({ dataset:ds, closest(sel){ return sel === '[data-act]' ? this : null; },
  getBoundingClientRect:() => ({ left:100, top:100, right:200, bottom:130 }), classList:{ contains:()=>false },
  hasAttribute:()=>false, tagName:'BUTTON' }, extra || {});
const click = ds => listeners.click.forEach(f => f({ target:fake(ds) }));
const key = (code, mods, k) => listeners.keydown.forEach(f => f(Object.assign({ code, key:k || '', ctrlKey:false,
  metaKey:false, shiftKey:false, altKey:false, preventDefault(){}, target:{ tagName:'DIV', classList:{ contains:()=>false },
  hasAttribute:()=>false } }, mods || {})));
const draw = () => { X.paint(); return { shell:els.shell.innerHTML, status:els.statusline.innerHTML, pop:els.overlays.innerHTML }; };

/* ── 1. regions ───────────────────────────────────────────────── */
sec('Workbench regions');
{
  S.selectedId = byKey('sc_biz');
  let d = draw();
  ok('rail is drawn', d.shell.includes('class="rail"'));
  ok('schedule list is open by default', d.shell.includes('class="side"'));
  ok('inspector is open by default (owner decision)', d.shell.includes('class="insp"'));
  ok('bottom panel is folded to a tab strip', d.shell.includes('class="panel "') && !d.shell.includes('panel__body'));
  ok('status line lives outside the inspector', d.status.includes('data-clk="time"') && !d.shell.includes('data-clk="time"'));
  ok('language and 24/12 stay in the app bar (owner decision)', /data-act="lang"/.test(X.viewAppbar()) && /data-act="fmt"/.test(X.viewAppbar()));
  ok('Save and Cancel are hidden while nothing changed', !d.shell.includes('data-act="save"'));
  S.dirty = true; d = draw();
  ok('Save and Cancel appear once something changed', d.shell.includes('data-act="save"') && d.shell.includes('data-act="cancel"'));
  S.dirty = false;
  ok('only one projection at a time: grid, no calendar', d.shell.includes('class="grid') && !d.shell.includes('class="cal__grid"'));
  click({ act:'view', v:'cal' }); d = draw();
  ok('switching to Calendar replaces the grid', d.shell.includes('cal__grid') && !d.shell.includes('grid__rows'));
  click({ act:'view', v:'grid' });
  S.selectedId = byKey('sc_dark'); d = draw();
  ok('astronomical schedule has no grid, the calendar is its view', d.shell.includes('cal__grid') && !d.shell.includes('data-act="view"'));
  S.selectedId = byKey('sc_shift'); d = draw();
  ok('cycle settings fold into a one-line summary, no v6 pattern bar',
    d.shell.includes('class="summary"') && !d.shell.includes('class="patbar"'));
  S.selectedId = byKey('sc_biz');
}

/* ── 2. toggles and shortcuts ─────────────────────────────────── */
sec('Collapsing regions');
{
  key('KeyB', { ctrlKey:true }); ok('Ctrl+B folds the list', !S.ui.side && !draw().shell.includes('class="side"'));
  key('KeyB', { ctrlKey:true }); ok('Ctrl+B brings it back', S.ui.side);
  key('KeyB', { ctrlKey:true, altKey:true }); ok('Ctrl+Alt+B folds the inspector', !S.ui.insp && !draw().shell.includes('class="insp"'));
  ok('a folded inspector leaves a visible «show properties» button', draw().shell.includes('data-act="inspToggle"'));
  click({ act:'focusRow', i:'1' });
  ok('clicking a day name opens a folded inspector by itself', S.ui.insp && X.inspContext() === 'row');
  ok('the open inspector has its own fold button', X.viewInsp().includes('data-act="inspToggle"'));
  click({ act:'inspBack' });
  key('KeyJ', { ctrlKey:true }); ok('Ctrl+J opens the bottom panel', S.ui.panel && draw().shell.includes('panel__body'));
  key('KeyJ', { ctrlKey:true }); ok('Ctrl+J folds it again', !S.ui.panel);
  key('KeyK', { ctrlKey:true }); key('KeyZ');
  let d = draw();
  ok('Ctrl+K Z enters focus mode: no rail, list, inspector, panel',
    S.ui.focus && !d.shell.includes('class="rail"') && !d.shell.includes('class="side"') && !d.shell.includes('class="insp"') && !d.shell.includes('class="panel'));
  ok('focus mode keeps the editor and the status line', d.shell.includes('class="grid') && d.status.includes('data-clk'));
  key('', {}, 'Escape'); ok('Esc leaves focus mode', !S.ui.focus);
  click({ act:'activity', v:'schedules' }); ok('clicking the active rail item folds the list, as in VS Code', !S.ui.side);
  click({ act:'activity', v:'groups' });
  d = draw();
  ok('rail «Date groups» opens the library in the side panel', S.ui.side && S.ui.activity === 'groups' && d.shell.includes('side__list--groups'));
  ok('the library is no longer hidden inside a tab', !X.viewPanel().includes('data-act="libToggle"'));
  click({ act:'openSchedules' });
  ok('Ctrl works on a Russian layout too (matched by code, not key)',
    (() => { const was = S.ui.side; key('KeyB', { ctrlKey:true }, 'и'); const r = S.ui.side !== was; key('KeyB', { ctrlKey:true }, 'и'); return r; })());
  click({ act:'ptab', k:'compat' }); ok('a folded tab opens the panel on it', S.ui.panel && S.ui.panelTab === 'compat');
  click({ act:'ptab', k:'compat' }); ok('clicking the open tab folds the panel', !S.ui.panel);
}

/* ── 3. contextual inspector ──────────────────────────────────── */
sec('Inspector shows what is selected');
{
  S.selectedId = byKey('sc_biz'); S.sel = null; S.calSel = null; S.rowOpen = false; S.ui.view = 'grid';
  ok('nothing selected → schedule properties, not Monday (owner decision)', X.inspContext() === 'props' && X.viewInsp().includes(X.T('propsTitle')));
  ok('properties carry type, validity, time reference, audit', ['type','validity','tz','audit'].every(k => X.viewInsp().includes(`data-k="${k}"`)));
  ok('folded sections still show a summary', X.viewInsp().includes('isec__x'));
  click({ act:'focusRow', i:'2' });
  ok('clicking a day row → that row', X.inspContext() === 'row' && X.viewInsp().includes(X.T('intervals')));
  const r = S.items[S.selectedId].pattern.days[2][0];
  S.sel = { row:2, id:r.id };
  ok('selecting a block → that interval', X.inspContext() === 'iv' && X.viewInsp().includes('data-act="selFrom"'));
  ok('the v6 selection bar under the grid is gone', !X.viewEditor().includes('class="selbar'));
  key('', {}, 'Escape'); ok('Esc: interval → row', X.inspContext() === 'row');
  key('', {}, 'Escape'); ok('Esc: row → properties', X.inspContext() === 'props');
  click({ act:'view', v:'cal' }); click({ act:'calPick', d:'2026-12-31' });
  ok('clicking a calendar day → the explanation of that day', X.inspContext() === 'day' && X.viewInsp().includes(X.T('ovrAdd')));
  ok('the explanation strip under the calendar is gone', !X.viewEditor().includes('class="cal__sel"'));
  click({ act:'inspBack' }); ok('«‹ Properties» goes back', X.inspContext() === 'props');
  click({ act:'view', v:'grid' });
  S.selectedId = byKey('sc_shift'); click({ act:'editProps' });
  ok('✎ in the summary opens «Type and pattern» with the cycle fields',
    S.ui.sec.type && X.viewInsp().includes('data-act="cycLen"') && X.viewInsp().includes('data-act="crewCount"'));
  S.selectedId = byKey('sc_biz');
}

/* ── 4. developer mode ────────────────────────────────────────── */
sec('API preview behind developer mode (owner decision)');
{
  S.ui.dev = false;
  ok('API tab hidden by default', !X.panelTabs().some(t => t[0] === 'api') && !X.viewPanel().includes('data-k="api"'));
  key('KeyD', { ctrlKey:true, shiftKey:true });
  ok('Ctrl+Shift+D shows it', S.ui.dev && X.viewPanel().includes('data-k="api"'));
  ok('status line says developer mode is on', X.viewStatus().includes(X.T('devBadge')));
  click({ act:'ptab', k:'api' });
  ok('the API tab renders the payload', X.viewPanel().includes('data-scroll="json"'));
  click({ act:'devToggle' });
  ok('turning it off moves the panel back to a visible tab', !S.ui.dev && S.ui.panelTab === 'days');
  global.location = { search:'?dev=1' };
  ok('?dev=1 in the address turns it on for the session', X.loadUi().dev === true);
  global.location = { search:'' };
  S.ui.panel = false;
}

/* ── 5. remembered layout ─────────────────────────────────────── */
sec('Layout is remembered');
{
  S.ui.side = false; S.ui.panel = true; S.ui.panelTab = 'used'; S.ui.inspW = 340; S.ui.focus = true; X.saveUi();
  const u = X.loadUi();
  ok('side, panel, tab and widths survive a reload', u.side === false && u.panel === true && u.panelTab === 'used' && u.inspW === 340);
  ok('focus mode is never restored on load', u.focus === false);
  click({ act:'resetLayout' });
  ok('«Reset layout» returns every region to default', S.ui.side && S.ui.insp && !S.ui.panel && S.ui.inspW === X.UI_DEF.inspW);
  global.innerWidth = 1200;
  delete store[X.UI_KEY];
  ok('below 1280px the inspector starts folded', X.loadUi().insp === false);
  global.innerWidth = 900;
  ok('below 1000px the list starts folded too', X.loadUi().side === false);
  global.innerWidth = 1440;
}

/* ── 6. every v6 action is still reachable ────────────────────── */
sec('Nothing lost: every v6 action is reachable in v7');
{
  const acts = h => new Set([...h.matchAll(/data-act="([a-zA-Z]+)"/g)].map(m => m[1]));
  const v6acts = acts(v6);
  /* collect what v7 actually renders across its states and popovers — some
     actions are written through a variable, so the source alone is not enough */
  const seen = new Set(acts(src));
  for(const kind of ['tpl','newKind','kindMenu','group','row','sched','headMenu','listMenu','toolMenu','stepMenu',
                     'help','copyFrom','copyIv']){
    S.pop = { kind, x:0, y:0, at:0, ab:0, i:0, id:S.selectedId };
    acts(X.viewPop()).forEach(a => seen.add(a));
  }
  S.pop = null;
  const REPLACED = { kind:'kindPick', step:'stepPick', tab:'ptab', libToggle:'openGroups',
    crewsToggle:'editProps', calToggle:'view', del:'smDel' };
  const missing = [...v6acts].filter(a => !seen.has(a) && !(REPLACED[a] && seen.has(REPLACED[a])));
  ok(v6acts.size + ' v6 actions all reachable (' + Object.keys(REPLACED).length + ' under a new name)',
    !missing.length, missing.join(', '));
  Object.entries(REPLACED).forEach(([o, n]) => ok(`«${o}» → «${n}»`, seen.has(n)));
}

/* ── 7. scroll preservation still covers every region ─────────── */
sec('Scroll preservation (the v6 fix) covers the new regions');
{
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const keys = [...new Set([...src.matchAll(/data-scroll="([a-zA-Z]+)"/g)].map(m => m[1]))].sort();
  ok('the bottom panel body keeps its scroll', keys.includes('panel'));
  ok('all regions marked: ' + keys.join(','), ['gridRows','insp','json','main','navtabs','panel','pop','sideList','tabbar']
    .every(k => keys.includes(k)));
  ok('periodic tick does not re-render the page', !/setInterval\(\s*\(\)\s*=>\s*\{[^}]*render\(\)/.test(src));
  ok('popovers are placed from their real size (open question 7)', /function placePop/.test(src) && /placePop\(\);/.test(src));
}

/* ── 8. the bridge still dresses v7 ───────────────────────────── */
sec('ONE PSIM restyle wiring');
{
  ok('bridge.css linked after the prototype styles', html.indexOf('bridge.css') > html.indexOf('</style>'));
  const bridge = fs.readFileSync(path.join(proto, 'bridge.css'), 'utf8');
  ok('bridge has the v7 section', /v7 workbench/.test(bridge));
}

console.log('\n' + '─'.repeat(52));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
