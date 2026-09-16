/* bridge.css sanity check: syntax, and that every selector it targets actually
 * exists in schedule_v6.html (a typo in a bridge selector fails silently). */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'bridge.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'schedule_v6.html'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'theme', 'one-psim.css'), 'utf8');
const native = fs.readFileSync(path.join(root, 'theme', 'native.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + x : '')); } };

console.log('== syntax');
const noComments = bridge.replace(/\/\*[\s\S]*?\*\//g, '');
const open = (noComments.match(/\{/g) || []).length, close = (noComments.match(/\}/g) || []).length;
ok('braces balanced', open === close, open + ' { vs ' + close + ' }');
ok('@import rules come first',
  /^\s*(@import[^;]+;\s*)+/.test(noComments.trimStart()) ||
  noComments.trimStart().startsWith('@import'));
ok('both theme files imported', /@import\s+"theme\/one-psim\.css"/.test(bridge)
  && /@import\s+"theme\/native\.css"/.test(bridge));
ok('one-psim imported before native',
  bridge.indexOf('one-psim.css') < bridge.indexOf('native.css'));
ok('imported files exist on disk',
  fs.existsSync(path.join(root, 'theme', 'one-psim.css')) &&
  fs.existsSync(path.join(root, 'theme', 'native.css')));

console.log('\n== token references resolve');
const declared = new Set([...theme.matchAll(/(--one-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
const used = new Set([...bridge.matchAll(/var\((--one-[a-z0-9-]+)/g)].map(m => m[1]));
const unknown = [...used].filter(t => !declared.has(t));
ok(used.size + ' --one-* tokens used, all declared in the theme', !unknown.length, unknown.join(', '));
const nativeUsed = new Set([...native.matchAll(/var\((--one-[a-z0-9-]+)/g)].map(m => m[1]));
const nativeUnknown = [...nativeUsed].filter(t => !declared.has(t));
ok('native.css tokens all declared too', !nativeUnknown.length, nativeUnknown.join(', '));

console.log('\n== the scheme wiring (the prototype switches [data-scheme], the DS [data-theme])');
ok('theme light block also matches [data-scheme=light]', /\[data-scheme="light"\]\s*\{/.test(theme));
ok('theme dark block also matches [data-scheme=dark]', /\[data-scheme="dark"\]\s*\{/.test(theme));
ok('prototype really uses body[data-scheme]', /<body data-scheme="light">/.test(html)
  && /setAttribute\('data-scheme'/.test(html));
const darkBlock = theme.slice(theme.indexOf('[data-scheme="dark"]'));
ok('dark block carries the dark values', darkBlock.includes('--one-canvas: #141517'));

console.log('\n== every bridge selector exists in the prototype');
/* collect selectors, drop the token blocks and at-rules */
const rules = [...noComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ sel:m[1].trim(), body:m[2] }))
  .filter(r => !r.sel.startsWith('@'));
const tokens = new Set(['--font','--mono','--bg-canvas','--bg-surface','--bg-muted','--bg-subtle',
  '--bg-popup','--fg-default','--fg-muted','--fg-subtle','--fg-disabled','--border-strong',
  '--border-popup','--border-default','--control-bg','--control-hover','--control-selected','--accent',
  '--accent-hover','--accent-pressed','--accent-on','--accent-soft','--accent-half','--status-info',
  '--status-warning','--status-success','--danger','--fb-info','--fb-success','--fb-warning',
  '--fb-danger','--grid-line','--grid-line-strong','--track-bg','--scrim','--shadow-popup',
  '--shadow-dialog','--r-ctl','--r-box','--r-win','--r-pill']);

/* prototype vocabulary: classes and attributes present in CSS or emitted by JS */
const protoClasses = new Set([...html.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m => m[1]));
[...html.matchAll(/class="([^"$]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => protoClasses.add(c)));
[...html.matchAll(/class="([^"]*)\$\{/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && protoClasses.add(c)));

const missing = [];
for(const r of rules){
  for(const one of r.sel.split(',')){
    const s = one.trim();
    if(!s) continue;
    if(/^(:root|body|html|\*)/.test(s)) continue;
    const cls = [...s.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
    const el  = /^([a-z]+)[.:\[\s]|^([a-z]+)$/.exec(s);
    if(cls.length){
      const bad = cls.filter(c => !protoClasses.has(c));
      if(bad.length) missing.push(s + '  (unknown class: ' + bad.join(', ') + ')');
    } else if(el){
      const tag = el[1] || el[2];
      if(!new RegExp('<' + tag + '[\\s>]|' + tag + '\\{|' + tag + '\\.', 'i').test(html))
        missing.push(s + '  (unknown element: ' + tag + ')');
    }
  }
}
ok(rules.length + ' rules, every selector matches prototype vocabulary', !missing.length,
  '\n        ' + missing.join('\n        '));

console.log('\n== token-block coverage: which prototype variables were re-pointed');
const protoVars = new Set([...html.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])
  .filter(v => !v.startsWith('--one-')));
const remapped = new Set([...bridge.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(--one/g)].map(m => m[1]));
const derived  = new Set([...bridge.matchAll(/(--[a-z0-9-]+)\s*:\s*color-mix/g)].map(m => m[1]));
const colourVars = [...protoVars].filter(v => /^--(bg|fg|border|control|accent|danger|status|fb|grid|track|scrim|shadow|font|mono)/.test(v));
const notRemapped = colourVars.filter(v => !remapped.has(v) && !derived.has(v));
console.log('     prototype colour/font variables: ' + colourVars.length);
console.log('     re-pointed to --one-*: ' + [...remapped].length + ', derived: ' + [...derived].length);
ok('every colour/font variable of the prototype is re-pointed', !notRemapped.length,
  notRemapped.join(', '));

console.log('\n' + '─'.repeat(52));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
