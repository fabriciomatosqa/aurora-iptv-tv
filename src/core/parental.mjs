// TV preview parental controls: salted PBKDF2 SHA-256. PIN is never persisted.
const ROUNDS = 180_000;
export function isRestricted(item) {
  const src = [item?.group||"",item?.title||"",...(item?.episodes||[]).map(x=>x.group||"")].join(" ");
  return /(?:^|[\s|/()[\]_-])(?:\+18|18\+|adult[oa]?s?|xxx|porn[ôo]|er[oó]tic[oa]s?)(?=$|[\s|/()[\]_-])/i.test(src);
}
export function validatePin(pin) { return /^\d{4,12}$/.test(String(pin||"")); }
function bytesToHex(bytes) { return [...bytes].map(b=>b.toString(16).padStart(2,"0")).join(""); }
function hexToBytes(hex) {
  if(typeof hex!=="string" || !/^(?:[0-9a-f]{2})+$/i.test(hex)) throw Error("Invalid PIN hash format");
  return Uint8Array.from(hex.match(/.{2}/g),n=>parseInt(n,16));
}
async function hash(pin,salt) {
  if(!globalThis.crypto?.subtle) throw new Error("A criptografia necessária não está disponível neste dispositivo.");
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:ROUNDS,hash:"SHA-256"},material,256);
  return bytesToHex(new Uint8Array(bits));
}
export async function createPin(pin){
  if(!validatePin(pin)) throw Error("O PIN deve conter de 4 a 12 números.");
  const salt=crypto.getRandomValues(new Uint8Array(16));
  return {salt:bytesToHex(salt),hash:await hash(pin,salt),rounds:ROUNDS};
}
export async function verifyPin(pin,record) {
  if(!validatePin(pin) || !record?.salt || !record?.hash || record.rounds!==ROUNDS)return false;
  let derived;
  try { derived=await hash(pin,hexToBytes(record.salt)); }
  catch{return false;}
  if(derived.length!==record.hash.length)return false;
  let mismatch=0;
  for(let i=0;i<derived.length;i++)mismatch|=derived.charCodeAt(i)^record.hash.charCodeAt(i);
  return mismatch===0;
}
