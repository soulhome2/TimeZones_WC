/* After the folder reorganisation: every file path mentioned in the docs, in the
 * prototypes and in the stylesheets must actually resolve. A stale relative path
 * fails silently — a broken <img> in a README, an @import that loads nothing. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if(c){ pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (x !== undefined ? '  → ' + x : '')); } };

const walk = d => fs.readdirSync(d, { withFileTypes:true }).flatMap(e => {
  if(e.name === '.git' || e.name === 'node_modules') return [];
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
const files = walk(root);

/* ── 1. markdown image and link targets ───────────────────────── */
console.log('== markdown links and images');
{
  const bad = [];
  let checked = 0;
  for(const f of files.filter(f => /\.mdx?$|\.MD$/i.test(f))){
    const text = fs.readFileSync(f, 'utf8');
    for(const m of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)){
      const t = m[1];
      if(/^(https?:|mailto:|#)/.test(t)) continue;
      checked++;
      if(!fs.existsSync(path.resolve(path.dirname(f), decodeURI(t))))
        bad.push(path.relative(root, f) + ' → ' + t);
    }
  }
  ok(checked + ' local markdown targets resolve', !bad.length, '\n        ' + bad.join('\n        '));
}

/* ── 2. paths written in backticks inside the docs ────────────── */
console.log('\n== file paths quoted in the docs');
{
  const bad = [];
  let checked = 0;
  for(const f of files.filter(f => /\.mdx?$|\.MD$/i.test(f))){
    const text = fs.readFileSync(f, 'utf8');
    for(const m of text.matchAll(/`([^`\n]*?[\w-]+\/[\w./-]+\.(?:html|css|js|png|md|MD))`/g)){
      /* a backtick span may be a command, not a path: `node ../tests/x.js` */
      let t = m[1].trim().replace(/^(?:node|npm run \w+(?: --)?)\s+/, '').trim();
      if(/^(https?:|ONE\.PSIM|src\/|scripts\/|packages\/|apps\/|docs\/|dist\/|prototypes\/(lab|im-|showcase|pilot))/.test(t)) continue;
      if(t.includes('*') || t.includes('{')) continue;          /* globs like v5-*.png */
      if(t.startsWith('<')) continue;                           /* placeholders like <кит>/dist/… */
      checked++;
      if(!fs.existsSync(path.resolve(path.dirname(f), t)))
        bad.push(path.relative(root, f) + ' → ' + t);
    }
  }
  ok(checked + ' quoted paths resolve', !bad.length, '\n        ' + bad.join('\n        '));
}

/* ── 3. what the prototype and the bridge actually load ───────── */
console.log('\n== runtime references');
{
  const bridgePath = path.join(root, 'prototypes', 'bridge.css');
  const bridge = fs.readFileSync(bridgePath, 'utf8');
  const imports = [...bridge.matchAll(/@import\s+"([^"]+)"/g)].map(m => m[1]);
  ok(imports.length + ' @import targets exist',
    imports.length === 2 && imports.every(i => fs.existsSync(path.resolve(path.dirname(bridgePath), i))),
    imports.join(', '));

  const vers = fs.readdirSync(path.join(root, 'prototypes'))
    .map(n => /^schedule_v(\d+)\.html$/.exec(n)).filter(Boolean)
    .map(m => ({ n:+m[1], file:m[0] })).sort((a, b) => b.n - a.n);

  /* every version that loads the bridge must find what it links */
  for(const v of ['schedule.html'].concat(vers.filter(x => x.n >= 6).map(x => x.file))){
    const p = path.join(root, 'prototypes', v);
    const links = [...fs.readFileSync(p, 'utf8').matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]);
    ok(v + ' links only files that exist',
      links.length && links.every(h => fs.existsSync(path.resolve(path.dirname(p), h))), links.join(', '));
  }

  /* schedule.html is the stable entry point: always a copy of the newest version */
  const newest = path.join(root, 'prototypes', vers[0].file);
  const mirror = path.join(root, 'prototypes', 'schedule.html');
  ok('schedule.html is a copy of ' + vers[0].file,
    fs.existsSync(mirror) && fs.readFileSync(mirror, 'utf8') === fs.readFileSync(newest, 'utf8'),
    fs.existsSync(mirror) ? 'content differs — copy the newest version over it' : 'missing');

  for(const v of ['v3','v4','v5']){
    const p = path.join(root, 'prototypes', `schedule_${v}.html`);
    const t = fs.readFileSync(p, 'utf8');
    ok(`schedule_${v}.html is still self-contained`, !/<link[^>]+href=|<script[^>]+src=/.test(t));
  }
}

/* ── 4. the test scripts find what they read ──────────────────── */
console.log('\n== test scripts');
{
  const expect = ['test_v5.js','test_v6_scroll.js','check_bridge.js','check_contrast.js',
    'check_sun_vs_noaa.js','metrics.js','check_links.js','ui_density.js','test_v7_layout.js','shots_edge.mjs'];
  const have = fs.readdirSync(path.join(root, 'tests')).sort();
  ok('tests/ holds the expected scripts', expect.sort().join(',') === have.join(','), have.join(','));
  const bad = [];
  for(const s of have){
    const t = fs.readFileSync(path.join(root, 'tests', s), 'utf8');
    if(/['"]\.\.['"],\s*['"]schedule_v/.test(t)) bad.push(s + ': reads a prototype from the project root');
    if(/[A-Z]:\\\\/.test(t)) bad.push(s + ': contains an absolute Windows path');
  }
  ok('no script points at the old layout', !bad.length, bad.join('; '));
}

/* ── 5. nothing left behind at the root ───────────────────────── */
console.log('\n== root is clean');
{
  const rootFiles = fs.readdirSync(root, { withFileTypes:true })
    .filter(e => e.isFile()).map(e => e.name);
  ok('only README.md and .gitignore at the root',
    rootFiles.sort().join(',') === '.gitignore,README.md', rootFiles.join(', '));
  const dirs = fs.readdirSync(root, { withFileTypes:true })
    .filter(e => e.isDirectory() && e.name !== '.git').map(e => e.name).sort();
  ok('five folders, nothing stale',
    dirs.join(',') === 'prototypes,screenshots,sources,specification,tests', dirs.join(','));
  const counts = Object.fromEntries(dirs.map(d =>
    [d, walk(path.join(root, d)).length]));
  console.log('     ' + dirs.map(d => d + ' ' + counts[d]).join(' · '));
}

console.log('\n' + '─'.repeat(52));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
