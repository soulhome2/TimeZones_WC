/* How much the admin sees at once: counts controls and text blocks that the
 * default screen of a prototype renders, per zone. Used as the baseline for the
 * UI simplification proposal (specification/Efficiency_Analysis_v2.MD).
 *   node tests/ui_density.js [file]   — defaults to schedule_v6.html
 */
const fs = require('fs');
const path = require('path');
const P = path.resolve(__dirname, '..', 'prototypes', process.argv[2] || 'schedule_v6.html');
const html = fs.readFileSync(P, 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

const mkEl = () => ({ innerHTML:'', style:{}, textContent:'', hidden:false, dataset:{},
  classList:{ contains:()=>false, add(){}, remove(){} }, setAttribute(){}, getAttribute:()=>null,
  focus(){}, querySelector:()=>null, querySelectorAll:()=>[], appendChild(){}, remove(){} });
global.document = { body:mkEl(), documentElement:mkEl(), activeElement:null, title:'',
  getElementById:()=>mkEl(), querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, createElement:mkEl };
global.requestAnimationFrame = () => 0;
global.innerWidth = 1440; global.innerHeight = 900;
global.addEventListener = () => {};
global.setInterval = () => 0;
global.setTimeout = () => 0;

const EXPORT = ['S','viewAppbar','viewSide','viewMain','viewInsp','viewRail','viewEditor','viewPanel','viewStatus'];
(0, eval)(src + '\n;globalThis.X={' + EXPORT.map(k => k + ':typeof ' + k + '!=="undefined"?' + k + ':undefined').join(',') + '};');
const X = globalThis.X, S = X.S;

const count = h => {
  const strip = h.replace(/<option[\s\S]*?<\/option>/g, '');
  return {
    buttons: (strip.match(/<button\b/g) || []).length,
    inputs:  (strip.match(/<input\b/g) || []).length,
    selects: (strip.match(/<select\b/g) || []).length,
    hints:   (strip.match(/class="hint[ "]/g) || []).length,
    words:   strip.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(w => /\p{L}/u.test(w)).length
  };
};
const zones = s => {
  S.selectedId = S.order.find(id => S.items[id].nameKey === s);
  S.tab = 'days'; S.calSel = null; S.sel = null; S.checked = new Set();
  if(X.viewEditor){                                   /* v7 workbench */
    const out = { appbar:count(X.viewAppbar()), rail:count(X.viewRail()), side:count(X.viewSide()) };
    const ed = X.viewEditor(), at = k => ed.indexOf(k);
    const tools = at('class="toolbar'), body = ed.indexOf('</div>', tools) >= 0 ? at('class="grid') >= 0 ? at('class="grid') : at('class="calwrap') : -1;
    out['main: header'] = count(ed.slice(0, tools));
    out['main: tools'] = count(ed.slice(tools, body));
    out['main: grid'] = count(ed.slice(body));
    out.panel = count(X.viewPanel());
    out.inspector = count(X.viewInsp());
    out.status = count(X.viewStatus());
    return out;
  }
  const main = X.viewMain();
  /* split the centre into its vertical bands */
  const at = k => main.indexOf(k);
  const bands = [
    ['header',   0,                        at('class="patbar"')],
    ['type+tools', at('class="patbar"'),   at('class="grid')],
    ['grid+hints', at('class="grid'),      at('class="calwrap')],
    ['calendar', at('class="calwrap'),     at('class="tabbox"')],
    ['tabs',     at('class="tabbox"'),     main.length]
  ].filter(b => b[1] >= 0 && b[2] > b[1]);
  const out = { appbar:count(X.viewAppbar()), side:count(X.viewSide()) };
  bands.forEach(([n, a, b]) => out['main: ' + n] = count(main.slice(a, b)));
  out.inspector = count(X.viewInsp());
  return out;
};

/* Controls that exist in the DOM but are invisible until hover or keyboard
   focus. The same rule for every version: kebabs of non-selected cards were
   hidden already in v6; v7 adds the "quiet" grid (row checkboxes and menus). */
function hoverOnly(){
  const side = X.viewSide(), grid = X.viewEditor ? X.viewEditor() : X.viewMain();
  const kebabs = (side.match(/sched__kebab/g) || []).length;
  const selKebab = /aria-selected="true"[\s\S]*?(sched__kebab|<\/div>\s*<div class="sched)/.exec(side);
  let n = Math.max(0, kebabs - (selKebab && selKebab[1] === 'sched__kebab' ? 1 : 0));
  if(grid.includes('grid--quiet'))
    n += (grid.match(/data-act="check"/g) || []).length + (grid.match(/data-act="rowMenu"/g) || []).length;
  return n;
}
for(const [label, key] of [['Weekly «Business hours»', 'sc_biz'], ['Shift cycle «Guard crews 2/2»', 'sc_shift']]){
  const z = zones(key);
  const hidden = hoverOnly();
  const tot = { buttons:0, inputs:0, selects:0, hints:0, words:0 };
  console.log('\n' + label + ' — ' + path.basename(P));
  console.log('  zone               btn  inp  sel  hint  words');
  for(const [n, c] of Object.entries(z)){
    for(const k in tot) tot[k] += c[k];
    console.log('  ' + n.padEnd(18) + String(c.buttons).padStart(4) + String(c.inputs).padStart(5)
      + String(c.selects).padStart(5) + String(c.hints).padStart(6) + String(c.words).padStart(7));
  }
  console.log('  ' + 'TOTAL'.padEnd(18) + String(tot.buttons).padStart(4) + String(tot.inputs).padStart(5)
    + String(tot.selects).padStart(5) + String(tot.hints).padStart(6) + String(tot.words).padStart(7)
    + '   → ' + (tot.buttons + tot.inputs + tot.selects) + ' controls, '
    + (tot.buttons + tot.inputs + tot.selects - hidden) + ' visible at rest (' + hidden + ' on hover)');
}
