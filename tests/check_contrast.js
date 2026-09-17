/* WCAG contrast for every text-on-fill pair the bridge decides about (§2.2a:
 * "Проверять числом, не на глаз"). Values are read from theme/one-psim.css and
 * from the prototype's own layer, so the numbers cannot drift from the files. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'prototypes');
const theme = fs.readFileSync(path.join(root, 'theme', 'one-psim.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'schedule_v6.html'), 'utf8');

const block = (text, start) => {
  const i = text.indexOf(start);
  return text.slice(i, text.indexOf('\n}', i));
};
const tok = (scheme, name) => {
  const b = scheme === 'light'
    ? block(theme, ':root,')
    : block(theme, '[data-theme="dark"]');
  const m = new RegExp('--one-' + name + ':\\s*([^;]+)').exec(b);
  return m ? m[1].trim() : null;
};
/* the prototype's own v5/v6 values, for "was it already like this?" */
const proto = (scheme, name) => {
  const b = scheme === 'light'
    ? block(html, ':root,[data-scheme=light]{')
    : block(html, '[data-scheme=dark]{');
  const m = new RegExp('--' + name + ':\\s*([^;]+)').exec(b);
  return m ? m[1].trim() : null;
};

function parse(c){
  c = c.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(c);
  if(m){
    let h = m[1];
    if(h.length === 3) h = h.split('').map(x => x + x).join('');
    if(h.length === 4) h = h.split('').map(x => x + x).join('');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    const a = h.length === 8 ? parseInt(h.slice(6,8),16)/255 : 1;
    return [r,g,b,a];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if(m){ const p = m[1].split(',').map(s => parseFloat(s));
    return [p[0],p[1],p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('cannot parse ' + c);
}
const over = (fg, bg) => {          /* composite fg (with alpha) over opaque bg */
  const a = fg[3];
  return [fg[0]*a + bg[0]*(1-a), fg[1]*a + bg[1]*(1-a), fg[2]*a + bg[2]*(1-a), 1];
};
const lin = v => { v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
const lum = c => 0.2126*lin(c[0]) + 0.7152*lin(c[1]) + 0.0722*lin(c[2]);
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05); };
const r2 = n => n.toFixed(1).replace('.', ',');

const rows = [];
const check = (label, scheme, fgSpec, bgSpec, baseSpec) => {
  const base = parse(baseSpec);
  const bg = over(parse(bgSpec), base);
  const fg = over(parse(fgSpec), bg);
  rows.push({ label, scheme, r:ratio(fg, bg) });
};

for(const s of ['light','dark']){
  const surface = tok(s, 'surface'), muted = tok(s, 'surface-muted');
  /* 1. what v5 had, and what the bridge replaced it with */
  check('pill--warn  BEFORE (hue on its own tint)', s, proto(s,'status-warning'), proto(s,'fb-warning'), surface);
  check('pill--warn  AFTER  (warning triple)',      s, tok(s,'warning-text'),     tok(s,'warning-bg'),  surface);
  check('kindtag     BEFORE (accent on accent-soft)', s, proto(s,'accent'),       proto(s,'accent-soft'), surface);
  check('kindtag     AFTER  (badge-neutral)',       s, tok(s,'fg-muted'),         tok(s,'surface-subtle'), surface);
  /* 2. status text in the status bar */
  check('status text warning, §1 literal (--one-warning)', s, tok(s,'warning'),      '#00000000', muted);
  check('status text warning, applied (-icon)',            s, tok(s,'warning-icon'), '#00000000', muted);
  check('status text success, §1 literal (--one-success)', s, tok(s,'success'),      '#00000000', muted);
  check('status text success, applied (-icon)',            s, tok(s,'success-icon'), '#00000000', muted);
  check('status text danger',                              s, tok(s,'danger'),      '#00000000', muted);
  check('status text info',                                s, tok(s,'info'),        '#00000000', muted);
  /* 3. the filled marker badge left as the prototype had it (rule gap) */
  check('filled marker badge: #fff on --one-warning', s, '#ffffff', tok(s,'warning'), surface);
  /* 4. things the bridge relies on */
  check('accent-on on accent (primary button, block)', s, tok(s,'accent-on'), tok(s,'accent'), surface);
  check('fg on accent-soft (selected row label)',      s, tok(s,'fg'),        tok(s,'accent-soft'), surface);
  check('fg on warning-bg (special-day cell number)',  s, tok(s,'fg'),        tok(s,'warning-bg'), surface);
  check('nav-selected on surface (selected tab)',      s, tok(s,'nav-selected-text'), '#00000000', surface);
  check('fg-muted on surface-subtle (tab count badge)',s, tok(s,'fg-muted'),  tok(s,'surface-subtle'), surface);
}

const w = Math.max(...rows.map(r => r.label.length));
let cur = '';
for(const r of rows.filter(r => r.scheme === 'light')){
  const d = rows.find(x => x.scheme === 'dark' && x.label === r.label);
  if(!cur){ console.log('  ' + 'pair'.padEnd(w) + '   light    dark'); cur = '1'; }
  const flag = (v) => v >= 7 ? ' ' : (v >= 4.5 ? '·' : (v >= 3 ? '!' : 'X'));
  console.log('  ' + r.label.padEnd(w) + '  ' + r2(r.r).padStart(5) + flag(r.r)
    + '  ' + r2(d.r).padStart(5) + flag(d.r));
}
console.log('\n  legend:  blank ≥7:1   · ≥4.5:1   ! ≥3:1   X below 3:1');
