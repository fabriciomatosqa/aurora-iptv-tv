// Conservative XMLTV subset. Never infer a result or a score from broadcast titles.
// A size bound protects TV browsers from enormous remote payloads.
export const MAX_EPG_CHARS = 12_000_000;
function xmlText(value = "") {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (full, numeric, named) => {
      if (numeric) {
        const n = numeric[0].toLowerCase() === "x" ? parseInt(numeric.slice(1), 16) : Number(numeric);
        return Number.isInteger(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : "";
      }
      return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"})[named.toLowerCase()] || full;
    }).replace(/<[^>]*>/g, "").trim();
}
function attrs(tag = "") {
  const out = Object.create(null);
  for (const x of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[x[1].toLowerCase()] = xmlText(x[2] ?? x[3]);
  return out;
}
function innerTag(body, tag) {
  const match = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + "\\s*>", "i").exec(body);
  return match ? xmlText(match[1]) : "";
}
export function parseXmltvTime(value) {
  // XMLTV dates are YYYYMMDDHHMMSS +/-HHMM. Seconds and the timezone may be omitted.
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2})(\d{2}))?$/.exec(String(value || "").trim());
  if (!m) return null;
  const [,year,month,day,hour,minute,second="00",sign,zoneHour="00",zoneMinute="00"] = m;
  const Y=+year,M=+month,D=+day,h=+hour,min=+minute,sec=+second,zH=+zoneHour,zM=+zoneMinute;
  if (M<1||M>12||D<1||D>31||h>23||min>59||sec>59||zH>23||zM>59) return null;
  const utc = Date.UTC(Y,M-1,D,h,min,sec);
  const check=new Date(utc);
  if (check.getUTCFullYear()!==Y || check.getUTCMonth()!==M-1 || check.getUTCDate()!==D) return null;
  const offset=(zH*60+zM)*60_000*(sign==="-"?-1:1);
  // No offset in source: UTC is assumed; document source-defined timezone limitations.
  return utc-offset;
}
export function parseXMLTV(xml) {
  if(typeof xml!=="string" || xml.length>MAX_EPG_CHARS) throw new Error("Guia XMLTV vazio ou acima do limite desta prévia.");
  if (!/<tv(?:\s|>)/i.test(xml)) throw new Error("Documento XMLTV inválido.");
  const channels=[];
  const programs=[];
  for(const match of xml.matchAll(/<channel\b([^>]*)>([\s\S]*?)<\/channel\s*>/gi)){
    const a=attrs(match[1]);
    if(!a.id)continue;
    channels.push({id:a.id,name:innerTag(match[2],"display-name")||a.id});
  }
  for(const match of xml.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme\s*>/gi)){
    const a=attrs(match[1]);
    const start=parseXmltvTime(a.start),stop=parseXmltvTime(a.stop);
    if(!a.channel || !Number.isFinite(start) || !Number.isFinite(stop) || stop<=start)continue;
    programs.push({channel:a.channel,start,stop,title:innerTag(match[2],"title") || "Sem título",
      description:innerTag(match[2],"desc"),category:innerTag(match[2],"category")});
  }
  programs.sort((a,b)=>a.start-b.start);
  return {channels,programs};
}
const canon = value => String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g," ").trim();
export function matchGuideChannel(item, guide) {
  const channels=guide?.channels||[], programs=guide?.programs||[];
  const id=String(item?.tvgId||"").trim();
  if(id && programs.some(x=>x.channel===id))return id;
  // Only exact normalized display name match; never approximate unrelated channels.
  const name=canon(item?.title);
  if(!name)return null;
  const matched=channels.filter(c=>canon(c.name)===name);
  return matched.length===1 ? matched[0].id : null;
}
export function currentAndNext(item, guide, now=Date.now()) {
  const channel=matchGuideChannel(item,guide);
  if(!channel)return {current:null,next:null};
  const list=guide.programs.filter(p=>p.channel===channel && p.stop>now);
  return {current:list.find(p=>p.start<=now&&now<p.stop)||null,next:list.find(p=>p.start>now)||null};
}
export function extractFixture(title) {
  // Explicit "A x B", "A vs B", or "A × B" patterns only.
  const clean=String(title||"").replace(/^\s*(?:futebol|football|jogo|partida|ao vivo|reprise)\s*[:\-]\s*/i,"").trim();
  const m=/^(.{2,55}?)\s+(?:x|vs?\.?|×)\s+(.{2,55}?)(?:\s*(?:[-|–]\s*.+))?$/i.exec(clean);
  if(!m)return null;
  const home=m[1].trim(),away=m[2].trim();
  if(home.toLocaleLowerCase("pt-BR")===away.toLocaleLowerCase("pt-BR"))return null;
  return {home,away};
}
export function footballFromEpg(items,guide,now=Date.now()) {
  const byId=new Map();
  for(const p of guide?.programs||[]){
    if(p.stop<now-60*60_000 || p.start>now+21*24*60*60_000)continue;
    const teams=extractFixture(p.title);
    if(!teams)continue;
    const item=(items||[]).find(i=>i.type==="live"&&matchGuideChannel(i,guide)===p.channel);
    if(!item)continue;
    const key=p.channel+"|"+p.start+"|"+p.title;
    if(byId.has(key))continue;
    byId.set(key,{...teams,channel:item,program:p,isReprise:/\breprise\b|retransmiss[aã]o/i.test(p.title+" "+p.description)});
  }
  return [...byId.values()].sort((a,b)=>a.program.start-b.program.start);
}
