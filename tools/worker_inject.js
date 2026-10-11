// Injected into PolyTrack's physics worker (same scope as its message handler) by tools/sim.js.
// Gives a single-car simulator with heap snapshots so runs can resume mid-way.
const __S={snaps:new Map(),K:1000,zero:null};
const __KEYS=["up","right","down","left","reset"];
function __pos(b){const v=new DataView(b);const u=new Uint8Array(b);const o=(u[11]&2)?17:14;return[v.getFloat32(o,!0),v.getFloat32(o+4,!0),v.getFloat32(o+8,!0)]}
function __go(L,h,cap,record){
  const idx={},ctl={};let last=null;
  const P=record?new Float32Array(3*(cap+1)):null,V=record?new Float32Array(cap+1):null;
  for(const k of __KEYS)idx[k]=0;
  while(!h.hasFinished&&h.frames<cap){
    const f=h.frames;
    for(const k of __KEYS){const a=L[k];let i=idx[k];while(i<a.length&&a[i]<=f)i++;idx[k]=i;ctl[k]=(i&1)==1}
    const b=n(h,ctl);h.hasFinished=Xo(new Uint8Array(b));h.frames++;last=b;
    if(record){const p=__pos(b);P.set(p,3*h.frames);V[h.frames]=new DataView(b).getFloat32(7,!0);
      if(h.frames%__S.K==0&&!h.hasFinished)__S.snaps.set(h.frames,new Uint8Array(t.HEAPU8));}
  }
  const r={op:"res",frames:h.frames,fin:h.hasFinished,last:new Uint8Array(last),pos:__pos(last),speed:new DataView(last).getFloat32(7,!0)};
  if(record){r.P=P.subarray(0,3*(h.frames+1));r.V=V.subarray(0,h.frames+1)}
  return r;
}
function __custom(m){
  if(m.op==="init"){
    const i=Ko.fromSaveString(m.trackData);const o=i.getStartTransform();
    s(0,m.mountainVertices,new R(m.mountainOffset.x,m.mountainOffset.y,m.mountainOffset.z),i,o);
    __S.zero=new Uint8Array(t.HEAPU8);__S.snaps.set(0,__S.zero);
    postMessage({op:"init",heap:t.HEAPU8.length});
  }else if(m.op==="setBase"){
    __S.snaps.clear();__S.snaps.set(0,__S.zero);t.HEAPU8.set(__S.zero);
    const r=__go(m.L,{id:0,hasFinished:false,frames:0},m.cap,true);r.id=m.id;postMessage(r);
  }else if(m.op==="eval"){
    let F=0;for(const k of __S.snaps.keys())if(k<=m.from&&k>F)F=k;
    t.HEAPU8.set(__S.snaps.get(F));
    const r=__go(m.L,{id:0,hasFinished:false,frames:F},m.cap,false);r.id=m.id;r.resumedFrom=F;postMessage(r);
  }
}
