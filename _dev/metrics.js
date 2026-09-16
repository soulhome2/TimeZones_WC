/* Counts comparable metrics across the prototype versions. */
const fs = require('fs');
const pl = (n, a, b, c) => a;
for(const f of ['schedule_v3.html','schedule_v4.html','schedule_v5.html','schedule_v6.html']){
  const h = fs.readFileSync(f, 'utf8');
  const js = h.slice(h.indexOf('<script>') + 8, h.lastIndexOf('</script>'));
  const m = js.match(/const I18N = \{[\s\S]*?\n\}\};/);
  let en = 0, ru = 0;
  if(m){ const I18N = eval('(' + m[0].replace(/^const I18N = /, '').replace(/;$/, '') + ')');
    en = Object.keys(I18N.en).length; ru = Object.keys(I18N.ru).length; }
  const tpl = (js.match(/\{ id:'[a-zA-Z0-9]+',\s*kind:'(week|cycle)'/g) || []).length;
  const kinds = (js.match(/const KINDS = \[[^\]]*\]/) || ['n/a'])[0];
  console.log(`${f.padEnd(19)} lines ${String(h.split('\n').length).padStart(5)}` +
    `  kb ${String(Math.round(Buffer.byteLength(h)/1024)).padStart(4)}` +
    `  i18n ${String(en).padStart(4)}/${ru}  templates ${String(tpl).padStart(3)}`);
  if(f.includes('v5')) console.log('  ' + kinds);
}
