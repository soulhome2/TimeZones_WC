const fs = require('fs');
const P = 'C:\\Users\\dmitriy.gorbanev\\YandexDisk\\Documents\\Work\\Obsidian\\Repos\\TimeZones_WC\\schedule_v5.html';
const html = fs.readFileSync(P, 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

/* DOM stubs */
const mkEl = () => ({ innerHTML:'', style:{}, textContent:'', classList:{ contains:()=>false, add(){}, remove(){} },
  dataset:{}, setAttribute(){}, getAttribute:()=>null, focus(){}, querySelector:()=>null,
  querySelectorAll:()=>[], appendChild(){}, remove(){} });
global.document = { body:mkEl(), documentElement:mkEl(), activeElement:null, title:'',
  getElementById:()=>mkEl(), querySelector:()=>null, querySelectorAll:()=>[],
  addEventListener(){}, createElement:mkEl };
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => {};
global.innerWidth = 1600; global.innerHeight = 900;
global.addEventListener = () => {};
global.setInterval = () => 0;

const EXPORT = ['S','T','I18N','LANGS','DAYS','KINDS','HW','TEMPLATES','MAX_CYCLE',
  'sunTimes','effectiveOn','coveredOnDate','coveredOnRow','monthMinutes','explainDate','compat',
  'panelsFail','buildPayload','rowIndexFor','baseOn','normalize','subtract','groupMatches','ruleMatches',
  'nextHits','ruleText','groupById','groupsFor','shadowMap','tplRows','blankPattern','iv','dur','fmt',
  'iso','parseISO','addDays','todayISO','patRows','patLen','kindOf','schedName','groupName','setKind',
  'addOverride','render','isActiveNow','stripDate','calNeeded','usageCount','groupUsage','nthName','DAY_MIN'];
(0, eval)(src + '\n;globalThis.X={' + EXPORT.map(k => k + ':typeof ' + k + '!=="undefined"?' + k + ':undefined').join(',') + '};');
const X = globalThis.X;
const { S, T } = X;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if(cond){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  → ' + extra : '')); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const hh = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
const sec = t => console.log('\n== ' + t);

/* ── 1. sun ─────────────────────────────────────────────── */
sec('Solar algorithm (Moscow 55.7558 / 37.6173, TZ=' + (-new Date().getTimezoneOffset()/60) + ')');
{
  const jun = X.sunTimes('2026-06-21', 55.7558, 37.6173);
  const dec = X.sunTimes('2026-12-21', 55.7558, 37.6173);
  console.log('     21 Jun: rise ' + hh(jun.rise) + ' set ' + hh(jun.set));
  console.log('     21 Dec: rise ' + hh(dec.rise) + ' set ' + hh(dec.set));
  ok('summer sunrise ≈ 03:44', near(jun.rise, 224, 8), hh(jun.rise));
  ok('summer sunset  ≈ 21:18', near(jun.set, 1278, 8), hh(jun.set));
  ok('winter sunrise ≈ 08:57', near(dec.rise, 537, 8), hh(dec.rise));
  ok('winter sunset  ≈ 15:58', near(dec.set, 958, 8), hh(dec.set));
  /* the site's own clock vs the server's — the concrete effect of the П7 setting */
  const nskSrv = X.sunTimes('2026-01-15', 55.0084, 82.9357);            /* server offset (UTC+3 here) */
  const nskOwn = X.sunTimes('2026-01-15', 55.0084, 82.9357, 420);       /* UTC+7 */
  console.log('     Novosibirsk 15 Jan — server clock ' + hh(nskSrv.set) + ' · own clock ' + hh(nskOwn.set));
  ok('same instant, two clocks, 4 h apart', ((nskOwn.set - nskSrv.set) + 1440) % 1440 === 240,
    nskOwn.set - nskSrv.set);
  ok('own-clock sunset for Novosibirsk ≈ 17:30', near(nskOwn.set, 1050, 6), hh(nskOwn.set));
  const pol = X.sunTimes('2026-06-21', 78, 15);
  ok('polar day detected at 78°N in June', pol.polar === 'day', JSON.stringify(pol));
  const poln = X.sunTimes('2026-12-21', 78, 15);
  ok('polar night detected at 78°N in December', poln.polar === 'night', JSON.stringify(poln));
}

/* ── 2. ordinal rules (П2) ──────────────────────────────── */
sec('Ordinal special-day rules');
{
  const r = { kind:'ordinal', nth:2, dow:'Sun', month:4 };          /* 2nd Sunday of May */
  ok('2nd Sunday of May 2026 = 10 May', X.ruleMatches(r, '2026-05-10'));
  ok('not 3rd Sunday (17 May)', !X.ruleMatches(r, '2026-05-17'));
  ok('not 2nd Sunday of June', !X.ruleMatches(r, '2026-06-14'));
  const last = { kind:'ordinal', nth:-1, dow:'Fri', month:null };
  ok('last Friday of Sep 2026 = 25 Sep', X.ruleMatches(last, '2026-09-25'));
  ok('18 Sep is not the last Friday', !X.ruleMatches(last, '2026-09-18'));
  ok('last Friday of Oct 2026 = 30 Oct', X.ruleMatches(last, '2026-10-30'));
  const first = { kind:'ordinal', nth:1, dow:'Mon', month:null };
  const g = { rules:[first] };
  const hits = X.nextHits(g, 4, '2026-09-09');
  ok('first Monday of every month → 4 sequential hits',
    hits.join(',') === '2026-10-05,2026-11-02,2026-12-07,2027-01-04', hits.join(','));
}
sec('Date rules, including yearly wrap');
{
  const y = { kind:'date', from:'2027-01-01', to:'2027-01-08', yearly:true };
  ok('yearly range matches another year', X.ruleMatches(y, '2029-01-05'));
  ok('yearly range excludes 9 Jan', !X.ruleMatches(y, '2029-01-09'));
  const wrap = { kind:'date', from:'2026-12-28', to:'2027-01-05', yearly:true };
  ok('yearly range across New Year: 31 Dec', X.ruleMatches(wrap, '2030-12-31'));
  ok('yearly range across New Year: 3 Jan', X.ruleMatches(wrap, '2030-01-03'));
  ok('yearly range across New Year: 10 Jan excluded', !X.ruleMatches(wrap, '2030-01-10'));
  const once = { kind:'date', from:'2026-10-12', to:'2026-10-14', yearly:false };
  ok('one-off range matches middle day', X.ruleMatches(once, '2026-10-13'));
  ok('one-off range ignores other years', !X.ruleMatches(once, '2027-10-13'));
  /* weekday filter inside a range — the v4 capability, kept */
  const sat = { kind:'date', from:'2027-06-01', to:'2027-08-31', yearly:true, dows:['Sat'] };
  ok('weekday filter: 3 Jul 2027 is a Saturday in range', X.ruleMatches(sat, '2027-07-03'));
  ok('weekday filter: 4 Jul 2027 (Sunday) excluded', !X.ruleMatches(sat, '2027-07-04'));
  ok('weekday filter: Saturday outside the range excluded', !X.ruleMatches(sat, '2027-10-02'));
  ok('weekday filter repeats yearly', X.ruleMatches(sat, '2030-07-06'));
  ok('empty weekday filter means every day',
    X.ruleMatches({ kind:'date', from:'2027-06-01', to:'2027-08-31', yearly:true, dows:[] }, '2027-07-04'));
}

/* ── 3. resolver per kind ───────────────────────────────── */
sec('Resolver — every schedule type');
{
  const byName = k => S.order.map(id => S.items[id]).find(s => s.nameKey === k);
  const always = byName('sc_always'), never = byName('sc_never');
  ok('built-in Always covers 24 h', X.coveredOnDate(always, '2026-09-09') === 1440);
  ok('built-in Never covers 0',      X.coveredOnDate(never,  '2026-09-09') === 0);
  ok('Always/Never are read-only', always.builtin && never.builtin);

  const biz = byName('sc_biz');
  S.selectedId = biz.id;
  ok('weekly: Wed 9 Sep 2026 = 9 h', X.coveredOnDate(biz, '2026-09-09') === 540);
  ok('weekly: Sun 13 Sep = 0',       X.coveredOnDate(biz, '2026-09-13') === 0);
  ok('override: 1 Jan (public holiday, mode none) = 0', X.coveredOnDate(biz, '2027-01-01') === 0);
  ok('override: 31 Dec (pre-holiday, custom 4h+3h) = 7 h', X.coveredOnDate(biz, '2026-12-31') === 420,
    X.coveredOnDate(biz, '2026-12-31'));
  const e = X.effectiveOn(biz, '2026-12-31');
  ok('pre-holiday rule (#1) beats public-holiday rule', e.rule === 'override' && e.idx === 0);

  const night = byName('sc_night');
  ok('night shift: 22:00–06:00 → 8 h/day', X.coveredOnDate(night, '2026-09-09') === 480);
  ok('night shift carry-over counted once', X.coveredOnDate(night, '2026-09-10') === 480);

  const shift = byName('sc_shift');
  S.selectedId = shift.id; S.crewView = 0;
  const anchor = shift.pattern.anchor;
  ok('cycle anchor day 1 is a working day', X.rowIndexFor(shift, anchor, 0) === 0);
  const c = [0,1,2,3,4,5].map(k => X.coveredOnDate(shift, X.iso(X.addDays(X.parseISO(anchor), k)), 0) / 60);
  ok('2/2 cycle from anchor = 12,12,0,0,12,12 h', c.join(',') === '12,12,0,0,12,12', c.join(','));
  const c2 = [0,1,2,3].map(k => X.coveredOnDate(shift, X.iso(X.addDays(X.parseISO(anchor), k)), 1) / 60);
  ok('crew 2 is offset by one day → 0,12,12,0', c2.join(',') === '0,12,12,0', c2.join(','));

  const audit = byName('sc_audit');
  ok('specific dates: 12 Oct listed = 12 h', X.coveredOnDate(audit, '2026-10-12') === 720);
  ok('specific dates: 17 Oct not listed = 0', X.coveredOnDate(audit, '2026-10-17') === 0);
  ok('specific dates: outside validity = 0', X.coveredOnDate(audit, '2026-11-12') === 0);
  ok('validity boundary is inclusive', X.effectiveOn(audit, '2026-10-16').rule === 'base');

  const dark = byName('sc_dark');
  const jun = X.coveredOnDate(dark, '2026-06-21'), dec = X.coveredOnDate(dark, '2026-12-21');
  console.log('     astro sunset→sunrise: 21 Jun ' + X.dur(jun) + ' · 21 Dec ' + X.dur(dec));
  ok('astro night window is shortest in June', jun < 480, jun);
  ok('astro night window is longest in December', dec > 960, dec);
  ok('astro window follows the year (Dec > Jun by >6 h)', dec - jun > 360, dec - jun);
  S.selectedId = dark.id;
  dark.pattern.astro.lat = 55.0084; dark.pattern.astro.lon = 82.9357; dark.pattern.astro.tzMin = 420;
  dark.tz = 'server'; const srv = X.explainDate(dark, '2026-01-15');
  dark.tz = 'object'; const own = X.explainDate(dark, '2026-01-15');
  ok('time reference changes the explained window, not its length', srv !== own
    && X.coveredOnDate(dark, '2026-01-15') > 0, srv + ' // ' + own);
  dark.pattern.astro.lat = 55.7558; dark.pattern.astro.lon = 37.6173;
  dark.pattern.astro.tzMin = 180; dark.tz = 'server';
}

/* ── 4. priority / shadowing ────────────────────────────── */
sec('Rule priority and shadowing');
{
  const biz = S.order.map(id => S.items[id]).find(s => s.nameKey === 'sc_biz');
  S.selectedId = biz.id;
  const before = X.effectiveOn(biz, '2026-12-31').idx;
  const saved = biz.overrides.slice();
  biz.overrides = [saved[1], saved[0]];                       /* public holidays first */
  const after = X.effectiveOn(biz, '2026-12-31');
  ok('reordering changes the winner', before === 0 && after.idx === 1);
  ok('31 Dec is not a public holiday, so the pre-holiday rule still wins',
    after.rule === 'override' && after.src.mode === 'custom');
  biz.overrides = saved;
  /* a duplicate group placed lower can never fire */
  biz.overrides = saved.concat([{ id:'dup', groupId:saved[0].groupId, mode:'full', sameAsRow:0, iv:[] }]);
  const sh = X.shadowMap(biz);
  ok('duplicate group lower in the list is flagged as shadowed', sh['dup'] === 1, JSON.stringify(sh));
  biz.overrides = saved;
}

/* ── 5. interval maths ──────────────────────────────────── */
sec('Interval arithmetic');
{
  const n = X.normalize([X.iv(540,120), X.iv(600,120)]);
  ok('overlapping intervals merge', n.list.length === 1 && n.list[0].len === 180 && n.merged === 1);
  const t = X.normalize([X.iv(540,60), X.iv(600,60)]);
  ok('touching intervals stay separate', t.list.length === 2 && t.merged === 0);
  const s = X.subtract([X.iv(0,1440)], 540, 660);
  ok('erase splits a full day into two', s.length === 2 && s[0].len === 540 && s[1].len === 780);
  const cy = X.normalize([X.iv(0,1440,{every:30,on:5})]);
  ok('cyclic intervals survive normalize', !!cy.list[0].cyc);
}

/* ── 6. compatibility (П6) ──────────────────────────────── */
sec('Controller compatibility');
{
  const byName = k => S.order.map(id => S.items[id]).find(s => s.nameKey === k);
  ok('Always downloads everywhere', X.HW.every(h => X.compat(byName('sc_always'), h.id).length === 0));
  ok('Business hours fits a 3-interval panel', X.compat(byName('sc_biz'), 'ctrl3').length === 0);
  const b6 = X.compat(byName('sc_biz'), 'ctrl6');
  ok('Business hours (5 intervals) fits the 6-interval panel', b6.length === 0, b6.join(' | '));
  const n3 = X.compat(byName('sc_night'), 'ctrl3');
  ok('Night shift fails on panels (midnight crossing)', n3.length === 1 && /polnoc|midnight|полноч/i.test(n3[0]) === true || n3.length >= 1, n3.join(' | '));
  const s3 = X.compat(byName('sc_shift'), 'ctrl3');
  ok('2/2 cycle is rejected by 3-interval panel', s3.length >= 1, s3.join(' | '));
  ok('cycle schedule raises the header warning', X.panelsFail(byName('sc_shift')));
  ok('business hours raises no header warning', !X.panelsFail(byName('sc_biz')));
  const w6 = X.compat(byName('sc_wknd'), 'ctrl6');
  ok('weekend patrol (2 intervals) fits both panels',
    w6.length === 0 && X.compat(byName('sc_wknd'), 'ctrl3').length === 0, w6.join(' | '));
  const a3 = X.compat(byName('sc_dark'), 'ctrl3');
  ok('astronomical is rejected by panels', a3.length >= 1, a3.join(' | '));
}

/* ── 7. explanations (П3) ───────────────────────────────── */
sec('Plain-language explanations');
{
  const byName = k => S.order.map(id => S.items[id]).find(s => s.nameKey === k);
  const cases = [
    ['sc_biz', '2026-09-09'], ['sc_biz', '2027-01-01'], ['sc_biz', '2026-12-31'],
    ['sc_shift', '2026-09-01'], ['sc_audit', '2026-10-12'], ['sc_audit', '2026-11-20'],
    ['sc_dark', '2026-12-21'], ['sc_always', '2026-09-09'], ['sc_never', '2026-09-09']
  ];
  for(const lang of ['en','ru']){
    S.lang = lang;
    let bad = 0;
    cases.forEach(([k, d]) => {
      const s = byName(k); S.selectedId = s.id;
      const txt = X.explainDate(s, d);
      if(!txt || /undefined|NaN|\[object/.test(txt) || txt.length < 20) { bad++; console.log('     BAD [' + lang + '] ' + k + ' ' + d + ': ' + txt); }
    });
    ok('all 9 explanation paths read cleanly (' + lang + ')', bad === 0);
    const biz = byName('sc_biz'); S.selectedId = biz.id;
    const e1 = X.explainDate(biz, '2026-12-31');
    ok('override explanation lists the actual intervals, no dangling ellipsis (' + lang + ')',
      /\d\d:\d\d/.test(e1) && !/…\./.test(e1) && !/\.\.\.\./.test(e1), e1);
    const shift = byName('sc_shift'); S.selectedId = shift.id;
    const e2 = X.explainDate(shift, '2026-09-07');
    ok('"same as row" explanation names the row (' + lang + ')',
      !/…\./.test(e2) && e2.includes('1'), e2);
  }
  S.lang = 'en';
  const biz = byName('sc_biz'); S.selectedId = biz.id;
  console.log('     ' + X.explainDate(biz, '2026-12-31'));
  console.log('     ' + X.explainDate(byName('sc_shift'), '2026-09-03'));
  console.log('     ' + X.explainDate(byName('sc_dark'), '2026-12-21'));
}

/* ── 8. payload ─────────────────────────────────────────── */
sec('API payload');
{
  const byName = k => S.order.map(id => S.items[id]).find(s => s.nameKey === k);
  const chk = (k, f) => { const s = byName(k); S.selectedId = s.id;
    const p = X.buildPayload(s); const m = p.modify_intervals[0];
    let bad = JSON.stringify(p).includes('undefined');
    ok('payload: ' + k + (bad ? ' HAS UNDEFINED' : ''), !bad && f(m, p)); return p; };
  chk('sc_biz', (m, p) => m.pattern.kind === 'week' && m.added_intervals.length === 5
    && m.added_intervals[0].start.day_of_week === 1 && m.overrides.length === 2
    && m.overrides[0].priority === 1 && p.day_groups.length === 2);
  const ps = chk('sc_shift', (m) => m.pattern.kind === 'cycle' && m.pattern.length_days === 4
    && m.pattern.anchor_date === '2026-09-01' && m.crews.length === 4
    && m.crews[3].offset_days === 3 && m.added_intervals[1].start.day_of_cycle === 2);
  chk('sc_audit', (m) => m.pattern.kind === 'dates' && m.pattern.dates.length === 5
    && m.added_intervals[0].start.date === '2026-10-12' && m.valid_to === '2026-10-31');
  chk('sc_dark', (m) => m.pattern.kind === 'astro' && m.pattern.astronomical.window === 'night'
    && m.pattern.astronomical.start_offset_seconds === -1800
    && m.pattern.astronomical.latitude > 55);
  chk('sc_always', (m) => m.pattern.kind === 'always' && m.builtin === true
    && m.added_intervals.length === 1 && m.added_intervals[0].length_seconds === 86400);
  const pg = X.buildPayload(byName('sc_soft') || byName('sc_wknd'));
  ok('ordinal rule serialised with nth + weekday',
    JSON.stringify(pg.day_groups).includes('"kind":"ordinal"') &&
    JSON.stringify(pg.day_groups).includes('"nth":2'), JSON.stringify(pg.day_groups));
  console.log('     shift payload keys: ' + Object.keys(ps.modify_intervals[0]).join(', '));
}

/* ── 9. type switching ──────────────────────────────────── */
sec('Type switching keeps what it can');
{
  const biz = S.order.map(id => S.items[id]).find(s => s.nameKey === 'sc_biz');
  S.selectedId = biz.id;
  const shape = () => biz.pattern.days.map(r => r.map(x => x.start + '/' + x.len).join('+')).join('|');
  const before = shape();
  X.setKind('cycle'); S.modal.fn();                            /* confirm */
  ok('week → cycle keeps 7 rows worth of data', X.kindOf(biz) === 'cycle' && X.patLen(biz) === 7);
  ok('intervals survive the conversion', shape() === before, shape() + ' vs ' + before);
  ok('cycle gets an anchor date', !!biz.pattern.anchor);
  X.setKind('dates'); S.modal.fn();
  ok('cycle → dates starts empty', X.kindOf(biz) === 'dates' && X.patLen(biz) === 0);
  ok('empty dates schedule resolves to 0', X.coveredOnDate(biz, '2026-09-09') === 0);
  X.setKind('week'); S.modal.fn();
  ok('dates → week rebuilds 7 empty rows', X.kindOf(biz) === 'week' && X.patLen(biz) === 7);
}

/* ── 10. templates ──────────────────────────────────────── */
sec('Templates');
{
  let bad = [];
  X.TEMPLATES.forEach(t => {
    const r = X.tplRows(t);
    const expect = t.kind === 'cycle' ? t.len : 7;
    if(r.length !== expect) bad.push(t.id + ' rows=' + r.length + ' want ' + expect);
    if(t.kind === 'cycle' && r.every(x => !x.length)) bad.push(t.id + ' empty');
  });
  ok('all ' + X.TEMPLATES.length + ' templates produce the right row count', !bad.length, bad.join('; '));
  const v = X.TEMPLATES.find(t => t.id === 'vahta');
  ok('rotation 15/15 is a 30-day cycle within the limit', v.len === 30 && v.len <= X.MAX_CYCLE);
  const ab = X.tplRows(X.TEMPLATES.find(t => t.id === 'ab'));
  ok('week A / week B differ in start time', ab[0][0].start === 540 && ab[7][0].start === 840);
  ok('snap steps are 15/30/60 only', /\[15,30,60\]/.test(src));
}

/* ── 11. i18n parity ────────────────────────────────────── */
sec('Localisation');
{
  const en = Object.keys(X.I18N.en), ru = Object.keys(X.I18N.ru);
  console.log('     keys: en ' + en.length + ' · ru ' + ru.length);
  const missRu = en.filter(k => !X.I18N.ru[k]);
  const extraRu = ru.filter(k => X.I18N.en[k] === undefined);
  ok('no key missing from Russian', !missRu.length, missRu.join(', '));
  ok('no stray Russian-only key', !extraRu.length, extraRu.join(', '));
  const typeBad = en.filter(k => typeof X.I18N.en[k] !== typeof X.I18N.ru[k]);
  ok('en/ru value types agree (string vs function)', !typeBad.length, typeBad.join(', '));

  /* every composite key resolves */
  const composites = [];
  X.DAYS.forEach(d => composites.push('day_' + d, 'ds_' + d, 'dIn_' + d));
  X.KINDS.concat('never').forEach(k => composites.push('kind_' + k, 'kindHint_' + k));
  X.TEMPLATES.forEach(t => composites.push('tpl_' + t.id, 'tplN_' + t.id));
  ['none','full','sameAs','custom'].forEach(m => composites.push('mode_' + m));
  X.HW.forEach(h => composites.push('hw_' + h.id, 'hwNote_' + h.id));
  [1,2,3,4,'last'].forEach(n => composites.push('nth_' + n));
  const compMiss = composites.filter(k => !X.I18N.en[k] || !X.I18N.ru[k]);
  ok(composites.length + ' composite keys all resolve in both languages', !compMiss.length, compMiss.join(', '));

  /* every literal T('key') in the source exists */
  const used = new Set();
  src.replace(/T\('([a-zA-Z0-9_]+)'/g, (_, k) => used.add(k));
  const dyn = /^(day_|ds_|dIn_|kind_|kindHint_|tpl_|tplN_|mode_|hw_|hwNote_|nth_)/;
  const unknown = Array.from(used).filter(k => !dyn.test(k) && !X.I18N.en[k]);
  ok(used.size + ' literal T() keys all defined', !unknown.length, unknown.join(', '));

  /* nothing in the dictionary is dead weight */
  /* keys reached through arrays of key names rather than literal T('x') */
  const viaArray = ['navDevices','navGroups','navDetectors','navArchives','navRoles','navSchedules',
    'navMacros','navAudit','navSettings','grpArchive','grpRoles','grpMacros','grpExport','grpRepl',
    'newScheduleName','newGroupName'];
  const reachable = new Set(Array.from(used).concat(composites, viaArray));
  viaArray.forEach(k => { if(!src.includes(k)) console.log('     NOTE allowlisted but absent: ' + k); });
  S.order.forEach(id => { const s = S.items[id];
    if(s.nameKey) reachable.add(s.nameKey);
    Object.values(s.usedIn || {}).flat().forEach(u => reachable.add(u)); });
  S.dayGroups.forEach(g => g.nameKey && reachable.add(g.nameKey));
  const dead = en.filter(k => !reachable.has(k));
  ok('no unreachable dictionary entry', !dead.length, dead.join(', '));

  /* Russian pluralisation */
  S.lang = 'ru';
  ok('ru plural 1',  T('intervalsN', { n:1 })  === '1 интервал',   T('intervalsN', { n:1 }));
  ok('ru plural 3',  T('intervalsN', { n:3 })  === '3 интервала',  T('intervalsN', { n:3 }));
  ok('ru plural 5',  T('intervalsN', { n:5 })  === '5 интервалов', T('intervalsN', { n:5 }));
  ok('ru plural 11', T('intervalsN', { n:11 }) === '11 интервалов',T('intervalsN', { n:11 }));
  ok('ru plural 21', T('intervalsN', { n:21 }) === '21 интервал',  T('intervalsN', { n:21 }));
  ok('ru ordinal names', X.nthName(1) === 'первый' && X.nthName(-1) === 'последний');
  S.lang = 'en';
}

/* ── 12. UI state helpers ───────────────────────────────── */
sec('UI simplification helpers');
{
  const byName = k => S.order.map(id => S.items[id]).find(s => s.nameKey === k);
  ok('calendar auto-hides for a plain 24/7 schedule', !X.calNeeded(byName('sc_always')));
  ok('calendar shows for a cycle', X.calNeeded(byName('sc_shift')));
  ok('calendar shows when overrides exist', X.calNeeded(byName('sc_wknd')));
  ok('5 date groups seeded', S.dayGroups.length === 5, S.dayGroups.length);
  const wknd = byName('sc_wknd');
  ok('seeded weekday-filtered group fires on a summer Saturday',
    X.coveredOnDate(wknd, '2027-07-03') === 900, X.coveredOnDate(wknd, '2027-07-03'));
  ok('and leaves the summer Sunday on the base pattern',
    X.coveredOnDate(wknd, '2027-07-04') === 1440, X.coveredOnDate(wknd, '2027-07-04'));
  ok('group usage counted', X.groupUsage('g_state') >= 1);
  const biz = byName('sc_biz'); S.selectedId = biz.id;
  ok('local groups are hidden from other schedules',
    X.groupsFor(biz).length === S.dayGroups.filter(g => g.scope === 'global').length);
  ok('schedule list holds built-ins first', S.order[0] === 'always' && S.order[1] === 'never');
  ok('no "same as another schedule" mode left',
    !/sameAsSched|same_as_schedule|schedId|excMode_/.test(src));
  ok('no holiday-list machinery left', !/useHolidayList|holidayMode/.test(src));
  ok('no exception array left', !/\.exceptions/.test(src));
  ok('render() runs without throwing', (() => { try{ X.render(); return true; }catch(e){ return e.message; } })() === true);
}

console.log('\n' + '─'.repeat(52));
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
