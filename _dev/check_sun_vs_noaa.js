/* Independent cross-check: NOAA Solar Calculator spreadsheet formulas.
   If this agrees with schedule_v5.html's sunTimes(), the prototype is right
   and my hand-remembered reference table was wrong. */
const fs = require('fs');
const P = 'C:\\Users\\dmitriy.gorbanev\\YandexDisk\\Documents\\Work\\Obsidian\\Repos\\TimeZones_WC\\schedule_v5.html';
const h = fs.readFileSync(P, 'utf8');
const DAY_MIN = 1440;
const p2 = n => (n < 10 ? '0' : '') + n;
const parseISO = s => { const [y,m,d] = String(s).split('-').map(Number); return new Date(y,(m||1)-1,d||1); };
eval(h.slice(h.indexOf('function sunTimes'), h.indexOf('/* ── interval maths')));

/* ---- NOAA ---- */
const R = Math.PI / 180;
function noaa(dISO, lat, lon, tzHours){
  const d = parseISO(dISO);
  const jd = Math.floor(d.getTime()/86400000 + 2440587.5 + 0.5) - 0.5;   /* JD at 00:00 UT */
  const t = (jd + 0.5 - 2451545) / 36525;                                /* julian century at 12 UT */
  const L0 = (280.46646 + t*(36000.76983 + t*0.0003032)) % 360;
  const M  = 357.52911 + t*(35999.05029 - 0.0001537*t);
  const e  = 0.016708634 - t*(0.000042037 + 0.0000001267*t);
  const C  = Math.sin(M*R)*(1.914602 - t*(0.004817 + 0.000014*t))
           + Math.sin(2*M*R)*(0.019993 - 0.000101*t) + Math.sin(3*M*R)*0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136*t;
  const lambda = trueLong - 0.00569 - 0.00478*Math.sin(omega*R);
  const eps0 = 23 + (26 + ((21.448 - t*(46.815 + t*(0.00059 - t*0.001813))))/60)/60;
  const eps = eps0 + 0.00256*Math.cos(omega*R);
  const decl = Math.asin(Math.sin(eps*R)*Math.sin(lambda*R)) / R;
  const y = Math.tan(eps/2*R)**2;
  const eqTime = 4*(y*Math.sin(2*L0*R) - 2*e*Math.sin(M*R) + 4*e*y*Math.sin(M*R)*Math.cos(2*L0*R)
    - 0.5*y*y*Math.sin(4*L0*R) - 1.25*e*e*Math.sin(2*M*R)) / R;
  const cosHA = Math.cos(90.833*R)/(Math.cos(lat*R)*Math.cos(decl*R)) - Math.tan(lat*R)*Math.tan(decl*R);
  if(cosHA > 1 || cosHA < -1) return null;
  const ha = Math.acos(cosHA) / R;
  const noonUTC = 720 - 4*lon - eqTime;                                  /* minutes UT */
  return { rise:Math.round(noonUTC - ha*4 + tzHours*60), set:Math.round(noonUTC + ha*4 + tzHours*60) };
}

const hh = m => p2(Math.floor(m/60)) + ':' + p2(m%60);
const dates = ['2026-01-15','2026-03-20','2026-05-01','2026-06-21','2026-08-01',
               '2026-09-09','2026-09-23','2026-11-01','2026-12-21'];
const sites = [['Moscow', 55.7558, 37.6173, 3], ['Novosibirsk', 55.0084, 82.9357, 7],
               ['Murmansk', 68.9585, 33.0827, 3]];
let worst = 0, worstAt = '';
for(const [name, lat, lon, tz] of sites){
  console.log('\n' + name + '  (' + lat + ', ' + lon + ', UTC+' + tz + ')');
  console.log('  date         prototype      NOAA           delta');
  for(const dISO of dates){
    const a = sunTimes(dISO, lat, lon), b = noaa(dISO, lat, lon, tz);
    if(a.polar || !b){ console.log('  ' + dISO + '  ' + (a.polar ? 'polar ' + a.polar : '?') + '   ' + (b ? 'has times' : 'polar')); continue; }
    const dr = a.rise - b.rise, ds = a.set - b.set;
    if(Math.abs(dr) > worst){ worst = Math.abs(dr); worstAt = name + ' ' + dISO + ' rise'; }
    if(Math.abs(ds) > worst){ worst = Math.abs(ds); worstAt = name + ' ' + dISO + ' set'; }
    console.log(`  ${dISO}  ${hh(a.rise)} ${hh(a.set)}    ${hh(b.rise)} ${hh(b.set)}    ${dr>0?'+':''}${dr} / ${ds>0?'+':''}${ds}`);
  }
}
console.log('\nworst disagreement with NOAA: ' + worst + ' min  (' + worstAt + ')');
console.log(worst <= 3 ? 'PASS — the two independent algorithms agree' : 'INVESTIGATE');
