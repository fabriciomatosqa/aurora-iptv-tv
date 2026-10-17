// LG-only M3U catalog diagnostics and conservative correction.
// Does not change the shared Android TV/Tizen classification rules.
const EPISODE = /(?:^|[\s._-])(?:S\d{1,3}[\s._-]*E\d{1,3}|\d{1,3}x\d{1,3})(?=$|[\s._-])/i;
const BROADCAST_QUALITY = /(?:^|[\s\[\]()_-])(?:FHD|HD|SD|UHD|4K|8K|H\s*265|H\s*264|HEVC)(?=$|[\s\[\]()_-])/i;
const LIVE_GROUP = /(?:^|[\s|/()[\]_-])(?:canais?|ao vivo|live tv|tv ao vivo|esportes?|noticias|notícias)(?:$|[\s|/()[\]_-])/i;
const SERIES_GROUP = /(?:^|[\s|/()[\]_-])(?:séries?|series|seriados|tv shows)(?:$|[\s|/()[\]_-])/i;
const MOVIE_GROUP = /(?:^|[\s|/()[\]_-])(?:filmes?|movies?|cinema|vod)(?:$|[\s|/()[\]_-])/i;

function typeFor(item) {
  const group=String(item?.group||""),title=String(item?.title||"");
  // An explicit episode pattern takes precedence over broadcaster-like quality text.
  if(EPISODE.test(title))return "series";
  if(LIVE_GROUP.test(group))return "live";
  if(MOVIE_GROUP.test(group))return "movies";
  // Some IPTV providers incorrectly label linear TV channel collections "Série".
  // Only override this when channel-style quality markers are present.
  if(SERIES_GROUP.test(group) && BROADCAST_QUALITY.test(title))return "live";
  if(SERIES_GROUP.test(group))return "series";
  return item.type || "unknown";
}

export function reclassifyLgItems(items) {
  let corrected=0;
  for (const item of items||[]) {
    const type=typeFor(item);
    if(type!==item.type) { item.type=type; corrected++; }
  }
  return corrected;
}

function unquotedComma(line) {
  let quoted=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='"') quoted=!quoted;
    else if(line[i]==="," && !quoted)return i;
  }
  return -1;
}

export function parseLgM3U(text) {
  if(typeof text!=="string" || !text.trimStart().startsWith("#EXTM3U"))
    throw new Error("A playlist precisa começar com #EXTM3U.");
  const items=[];
  let pending=null, groupOverride="", declared=0, invalid=0;
  const first=text.split(/\r?\n/,1)[0];
  const guideUrl=/(?:x-tvg-url|url-tvg)="([^"]*)"/i.exec(first)?.[1]||"";
  // Split handles CRLF and LF. Streaming and giant playlists still require a
  // future cursor-backed importer; this parser never silently caps card counts.
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();
    if(line.startsWith("#EXTINF:")){
      declared++;
      const split=unquotedComma(line);
      const metadata=split<0?line:line.slice(0,split);
      const attrs={};
      for(const x of metadata.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[x[1].toLowerCase()]=x[2];
      pending={
        title:(split<0?"":line.slice(split+1)).trim()||attrs["tvg-name"]||"Sem título",
        group:attrs["group-title"]||groupOverride||"",
        logo:attrs["tvg-logo"]||"",
        tvgId:attrs["tvg-id"]||""
      };
      groupOverride="";
    }else if(line.startsWith("#EXTGRP:")){
      const group=line.slice(8).trim();
      if(pending && !pending.group)pending.group=group;
      else groupOverride=group;
    }else if(pending && line && !line.startsWith("#")){
      try{
        const url=new URL(line);
        if(url.protocol!=="http:"&&url.protocol!=="https:")throw Error("unsupported");
        const item={...pending,url:line,type:"unknown"};
        item.type=typeFor(item);
        items.push(item);
      }catch{invalid++;}
      pending=null;
    }
  }
  if(pending)invalid++;
  return {items,count:items.length,declared,invalid,guideUrl};
}

export function auditLgCatalog(items) {
  const result={all:0,live:0,movies:0,series:0,unknown:0,episodes:0};
  for(const it of items||[]){
    result.all++;
    if(it.type==="live")result.live++;
    else if(it.type==="movies")result.movies++;
    else if(it.type==="series"){result.episodes++;result.series++;}
    else result.unknown++;
  }
  return result;
}
