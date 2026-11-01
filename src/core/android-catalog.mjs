// The native store is intentionally restricted to Android TV/Google TV APKs.
// Other platforms keep their established catalog implementation.
const pending=new Map();let sequence=0,migrationTail=Promise.resolve();
// A native reply may arrive after WebView reload. IDs must never restart at "1"
// and accidentally satisfy a different library's new request in that document.
const documentId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
export function hasAndroidCatalog(){return typeof window.AuroraNative?.catalogVersion==="function" && window.AuroraNative.catalogVersion()===1;}
window.auroraCatalogResponse=(id,result,error)=>{
  const record=pending.get(id);if(!record)return;
  pending.delete(id);clearTimeout(record.timer);
  if(error)record.reject(Error(error));else record.resolve(result);
};
export function androidCatalog(operation,payload){
  const ready=["refresh","delete"].includes(operation)?migrationTail:Promise.resolve();
  return ready.then(()=>send(operation,payload));
}
function send(operation,payload){
  return new Promise((resolve,reject)=>{
    const id=documentId+"-"+(++sequence);
    // Do not abandon a valid slow import and then start an overlapping replacement.
    // The native side always answers; a destroyed page releases its own callbacks.
    pending.set(id,{resolve,reject,timer:null});
    try{
      const text=JSON.stringify(payload);
      if(text.length>8_000_000)throw Error("Para listas grandes, use a URL da playlist em vez de colar o texto.");
      window.AuroraNative.catalogRequest(operation,text,id);
    }
    catch(error){pending.delete(id);reject(error);}
  });
}
export function migrateAndroidCatalog(playlist,legacy){
  const result=migrationTail.then(async()=>{
    const started=await send("legacyBegin",{playlist:playlist.id});
    if(started.ready)return;
    try{
      for(let offset=0;offset<legacy.length;offset+=256){
        await send("legacyAppend",{playlist:playlist.id,items:legacy.slice(offset,offset+256)});
      }
      await send("legacyCommit",{playlist:playlist.id,url:playlist.url||"",guideUrl:playlist.guideUrl||""});
    }catch(error){await send("legacyAbort",{playlist:playlist.id}).catch(()=>{});throw error;}
  });
  migrationTail=result.catch(()=>{});return result;
}
