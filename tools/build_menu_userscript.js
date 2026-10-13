// Builds tas-menu.user.js (all tracks, with a track menu and a Start button) from tas-menu.template.js.
// For each track it uses inputs/tracks/<slug>_opt.json if present, else <slug>_wr.json (the #1 replay);
// Summer 1 uses inputs/summer1_opt.json. Finish times are measured with the offline simulator.
// usage: node tools/build_menu_userscript.js [out=tas-menu.user.js]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'tas-menu.user.js');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim_assets/tracks/index.json')));
const finish = (slug, file) => {
  const code = `const fs=require('fs');const {createSim,encodeRecording}=require(${JSON.stringify(path.join(__dirname, 'sim.js'))});
const K={KeyW:'up',KeyD:'right',KeyS:'down',KeyA:'left',Reset:'reset'};(async()=>{const s=await createSim();const L={up:[],right:[],down:[],left:[],reset:[]};
for(const [f,k] of JSON.parse(fs.readFileSync(${JSON.stringify(file)})))L[K[k]].push(f);for(const k in L)L[k].sort((a,b)=>a-b);
const v=await s.run(encodeRecording(L),90000);console.log('FIN '+v.frames);process.exit(0)})()`;
  const out = execFileSync('node', ['-e', code], { env: { ...process.env, TRACK: slug === 'summer1' ? '' : slug }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return +out.match(/FIN (\d+)/)[1];
};
const tracks = {};
for (const [slug, { name }] of Object.entries(index)) {
  const file = slug === 'summer1' ? path.join(ROOT, 'inputs/summer1_opt.json')
    : [`inputs/tracks/${slug}_opt.json`, `inputs/tracks/${slug}_wr.json`].map(f => path.join(ROOT, f)).find(f => fs.existsSync(f));
  if (!file) continue;
  const f = finish(slug, file), time = `${Math.floor(f / 60000)}:${String(Math.floor(f / 1000) % 60).padStart(2, '0')}.${String(f % 1000).padStart(3, '0')}`;
  tracks[slug] = { name, time, s: JSON.parse(fs.readFileSync(file)).filter(e => e[1] !== 'Reset').map(([fr, k, p]) => [fr, { KeyW: 'up', KeyD: 'right', KeyS: 'down', KeyA: 'left' }[k], p]) };
  console.log(`${name}: ${time} (${path.relative(ROOT, file)})`);
}
const tpl = fs.readFileSync(path.join(ROOT, 'tas-menu.template.js'), 'utf8');
fs.writeFileSync(OUT, tpl.replace('/*TRACKS*/{}', JSON.stringify(tracks)));
console.log('wrote', OUT);
