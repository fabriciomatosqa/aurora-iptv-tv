// Narrow bridge for an Android TV app whose WebView only loads packaged local UI.
// In normal browsers, the native path is not available and the standard fetch/video remains.
const callbacks = new Map();
let seq=0;
window.auroraNativeTextResponse=(id, content, error) => {
  const record=callbacks.get(id);
  if(!record)return;
  callbacks.delete(id);clearTimeout(record.timer);
  if(error) record.reject(new Error("Não foi possível acessar o endereço neste dispositivo."));
  else record.resolve(content);
};
export function hasNativePlayer(){return typeof window.AuroraNative?.play === "function";}
export function startNative(item,key,resumeSeconds=0){
  if(!hasNativePlayer())return false;
  window.AuroraNative.play(item.url,item.title,key,resumeSeconds);
  return true;
}
export function loadRemoteText(url) {
  if(typeof window.AuroraNative?.fetchText !== "function"){
    return fetch(url,{redirect:"follow"}).then(r=>{
      if(!r.ok)throw new Error("HTTP "+r.status);
      return r.text();
    });
  }
  return new Promise((resolve,reject)=>{
    const id=String(++seq);
    const timer=setTimeout(()=>{
      callbacks.delete(id);reject(new Error("Tempo de carregamento excedido."));
    },35000);
    callbacks.set(id,{resolve,reject,timer});
    try{window.AuroraNative.fetchText(url,id);}
    catch{clearTimeout(timer);callbacks.delete(id);reject(new Error("Falha na integração Android."));}
  });
}
