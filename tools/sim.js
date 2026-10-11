// Offline simulator: runs PolyTrack's own physics worker + wasm in Node.
// Needs (see tools/fetch_sim_assets.sh): sim_assets/{worker.js,polytrack_physics.js,polytrack_physics.wasm,msgs.json}
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = path.join(__dirname, '..', 'sim_assets');
const dec = v => {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    if (v.__t && v.b64 !== undefined) { const b = Buffer.from(v.b64, 'base64'); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.length); return new globalThis[v.__t](ab); }
    const o = {}; for (const k in v) o[k] = dec(v[k]); return o;
  }
  return v;
};

async function createSim() {
  const msgs = JSON.parse(fs.readFileSync(path.join(A, 'msgs.json')));
  const init = dec(msgs.find(m => m.messageType === 0 && m.isRealtime === false));
  const create = dec(msgs.find(m => m.messageType === 3));
  let src = fs.readFileSync(path.join(A, 'worker.js'), 'utf8');
  // report the final state buffer too
  src = src.replace('function r(i){const r=i.data;switch(r.messageType){case Ki.Init:', '\nconst __S={snaps:new Map(),K:1000,zero:null};\nconst __KEYS=["up","right","down","left","reset"];\nfunction __go(L,h,cap,record){\n  const idx={},ctl={};let last=null;\n  for(const k of __KEYS)idx[k]=0;\n  while(!h.hasFinished&&h.frames<cap){\n    const f=h.frames;\n    for(const k of __KEYS){const a=L[k];let i=idx[k];while(i<a.length&&a[i]<=f)i++;idx[k]=i;ctl[k]=(i&1)==1}\n    const b=n(h,ctl);h.hasFinished=Xo(new Uint8Array(b));h.frames++;last=b;\n    if(record&&h.frames%__S.K==0&&!h.hasFinished)__S.snaps.set(h.frames,new Uint8Array(t.HEAPU8));\n  }\n  return{op:"res",frames:h.frames,fin:h.hasFinished,last:new Uint8Array(last)};\n}\nfunction __custom(m){\n  if(m.op==="init"){\n    const i=Ko.fromSaveString(m.trackData);const o=i.getStartTransform();\n    s(0,m.mountainVertices,new R(m.mountainOffset.x,m.mountainOffset.y,m.mountainOffset.z),i,o);\n    __S.zero=new Uint8Array(t.HEAPU8);__S.snaps.set(0,__S.zero);\n    postMessage({op:"init",heap:t.HEAPU8.length});\n  }else if(m.op==="setBase"){\n    __S.snaps.clear();__S.snaps.set(0,__S.zero);t.HEAPU8.set(__S.zero);\n    const r=__go(m.L,{id:0,hasFinished:false,frames:0},m.cap,true);r.id=m.id;postMessage(r);\n  }else if(m.op==="eval"){\n    let F=0;for(const k of __S.snaps.keys())if(k<=m.from&&k>F)F=k;\n    t.HEAPU8.set(__S.snaps.get(F));\n    const r=__go(m.L,{id:0,hasFinished:false,frames:F},m.cap,false);r.id=m.id;r.resumedFrom=F;postMessage(r);\n  }\n}\n' + 'function r(i){const r=i.data;if(r.messageType===77){__custom(r);return}switch(r.messageType){case Ki.Init:');
  src = src.replace('postMessage({messageType:Ki.VerifyResult,carId:l,result:A})',
    'postMessage({messageType:Ki.VerifyResult,carId:l,result:A,frames:h.frames,last:new Uint8Array(h.last)})');
  src = src.replace('h.hasFinished=Xo(new Uint8Array(t)),h.frames++', 'h.last=t,h.hasFinished=Xo(new Uint8Array(t)),h.frames++');
  const g = globalThis;
  g.self = g; g.addEventListener = () => {}; g.onmessage = null;
  g.location = { href: 'https://x/0.6.3/simulation_worker.bundle.js' };
  const realProcess = g.process;
  const asBrowser = fn => { Object.defineProperty(g, 'process', { value: undefined, configurable: true, writable: true }); try { return fn(); } finally { Object.defineProperty(g, 'process', { value: realProcess, configurable: true, writable: true }); } };
  g.importScripts = f => asBrowser(() => vm.runInThisContext(fs.readFileSync(path.join(A, 'polytrack_physics.js'), 'utf8')));
  g.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => { const b = fs.readFileSync(path.join(A, 'polytrack_physics.wasm')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } });
  let resolveNext;
  const waiters = new Map();
  g.postMessage = m => { if (m.op) { const key = m.id !== undefined ? m.id : m.op; const w = waiters.get(key); if (w) { waiters.delete(key); w(m); } return; } if (m.messageType === 8 && resolveNext) { const r = resolveNext; resolveNext = null; r(m); } };
  g.requestAnimationFrame = undefined;
  asBrowser(() => vm.runInThisContext(src));
  await new Promise(r => setTimeout(r, 1000));            // wasm init
  g.onmessage({ data: init });
  const run = (recordingB64, targetFrames) => new Promise(res => {
    resolveNext = res;
    g.onmessage({ data: { messageType: 1, carId: 0, trackData: create.trackData, mountainVertices: create.mountainVertices,
      mountainOffset: create.mountainOffset, carRecording: recordingB64, targetFrames } });
  });
  let cid = 1;
  const call = (msg, key) => new Promise(res => { waiters.set(key, res); g.onmessage({ data: { messageType: 77, ...msg } }); });
  const initFast = () => call({ op: 'init', trackData: create.trackData, mountainVertices: create.mountainVertices, mountainOffset: create.mountainOffset }, 'init');
  const setBase = (L, cap) => { const id = cid++; return call({ op: 'setBase', L, cap, id }, id); };
  const evalFrom = (L, from, cap) => { const id = cid++; return call({ op: 'eval', L, from, cap, id }, id); };
  return { run, initFast, setBase, evalFrom };
}
module.exports = { createSim };

// ---- recording encode/decode (format reverse-engineered from the game) ----
const zlib = require('zlib');
const LISTS = ['up', 'right', 'down', 'left', 'reset'];
function encodeRecording(lists) {            // lists: {up:[frames],...}; frames strictly increasing
  const parts = [];
  for (const k of LISTS) {
    const l = lists[k] || [], b = Buffer.alloc(3 + 3 * l.length);
    b.writeUIntLE(l.length, 0, 3);
    let prev = 0;
    l.forEach((f, i) => { b.writeUIntLE(i === 0 ? f : f - prev, 3 + 3 * i, 3); prev = f; });
    parts.push(b);
  }
  return zlib.deflateSync(Buffer.concat(parts)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodePos(last) {                   // car position from the worker state buffer
  const b = Buffer.from(last);
  const off = (b[11] & 2) ? 17 : 14;
  return [b.readFloatLE(off), b.readFloatLE(off + 4), b.readFloatLE(off + 8)];
}
module.exports.encodeRecording = encodeRecording;
module.exports.decodePos = decodePos;
