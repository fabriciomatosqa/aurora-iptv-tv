// Store potentially large catalogs separately from the small localStorage settings.
// IndexedDB uses the origin storage quota. This first version still holds the parsed list
// in memory when rendering; production-scale playlists need cursor-based pagination.
const DB_NAME="aurora-tv-catalogs";
const DB_VERSION=1;
let ready=null;
function openDatabase(){
  if(ready)return ready;
  if(typeof indexedDB==="undefined")return Promise.reject(Error("IndexedDB não disponível."));
  ready=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const name of ["catalogs","guides"])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:"id"});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || Error("Erro abrindo IndexedDB."));
    request.onblocked=()=>reject(Error("Outra janela bloqueou o banco de dados."));
  }).catch(e=>{ready=null;throw e;});
  return ready;
}
async function getStore(name,id){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,"readonly");
    const request=tx.objectStore(name).get(id);
    request.onsuccess=()=>resolve(request.result?.value||null);
    request.onerror=()=>reject(request.error || Error("Erro de leitura."));
  });
}
async function putStore(name,id,value){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,"readwrite");
    tx.oncomplete=()=>resolve(true);
    tx.onabort=()=>reject(tx.error || Error("Armazenamento indisponível ou cheio."));
    tx.onerror=()=>reject(tx.error || Error("Erro de armazenamento."));
    tx.objectStore(name).put({id,value});
  });
}
async function deleteStore(name,id){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(name,"readwrite");
    tx.oncomplete=()=>resolve(true);
    tx.onerror=()=>reject(tx.error || Error("Erro de exclusão."));
    tx.objectStore(name).delete(id);
  });
}
export const loadCatalog=id=>getStore("catalogs",id);
export const saveCatalog=(id,items)=>putStore("catalogs",id,items);
export const loadGuide=id=>getStore("guides",id);
export const saveGuide=(id,guide)=>putStore("guides",id,guide);
export const deletePlaylistData=async id=>{
  await Promise.all([deleteStore("catalogs",id),deleteStore("guides",id)]);
};
